import type { DatabaseSync } from "node:sqlite";
import { anchorType, type NoteStatus } from "./note-store.js";

const WEIGHT_MULT: Record<string, number> = {
  critical: 3, core: 3, supporting: 2, incidental: 1,
};
const NEUTRAL_IDF = 1;         // entity:/env: not IDF-penalised (specs/02,03)
const UBIQUITY_RATIO = 0.7;    // anchor used by ≥70% of notes = ubiquitous
const MIN_CORPUS_FOR_IDF = 5;  // need ≥5 notes for ubiquity check to be meaningful
// bm25() in SQLite returns very small values for small corpuses (~1e-6 for N=1).
// Default is effectively "any FTS5 match qualifies"; tune upward for large corpora
// to filter genuinely weak text hits.
const BM25_FLOOR = 1e-9;       // text relevance below this threshold = no match
const TEXT_WEIGHT = 1.0;
const CONTEXT_BONUS = 1.0;
const DEFAULT_LIMIT = 20;

export interface SearchParams {
  anchors?: string[];
  query?: string;
  context?: string[];
  include_archived?: boolean;
  include_drafts?: boolean;
  limit?: number;
}

export interface SearchHit {
  id: string;
  summary: string;
  status?: NoteStatus; // only present when !== 'current'
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;       // qualified count before truncation
  truncated: boolean;
}

interface Cand {
  anchorScore: number;
  textScore: number;
  contextHits: number;
  qualified: boolean;
  pinned: boolean;
}

export function search(db: DatabaseSync, params: SearchParams): SearchResult {
  const limit = params.limit ?? DEFAULT_LIMIT;
  const anchors = params.anchors ?? [];
  const query = params.query?.trim() ?? "";
  const context = params.context ?? [];
  const statuses = ["current"];
  if (params.include_archived) statuses.push("outdated");
  if (params.include_drafts) statuses.push("draft");
  const statusPlaceholders = statuses.map(() => "?").join(",");

  if (anchors.length === 0 && query === "") {
    return { hits: [], total: 0, truncated: false };
  }

  const map = new Map<string, Cand>();
  function getCand(id: string): Cand {
    let c = map.get(id);
    if (!c) {
      c = { anchorScore: 0, textScore: 0, contextHits: 0, qualified: false, pinned: false };
      map.set(id, c);
    }
    return c;
  }

  const totalNotes = (db.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
  const idfStmt = db.prepare("SELECT df FROM anchor_idf WHERE uri = ?");
  const anchorStmt = db.prepare(
    `SELECT a.note_id AS id, a.weight AS weight
     FROM anchors a JOIN notes n ON n.id = a.note_id
     WHERE a.uri = ? AND n.status IN (${statusPlaceholders})`
  );

  // --- Anchor path ---
  for (const uri of anchors) {
    let type: string;
    try {
      type = anchorType(uri);
    } catch {
      continue;
    }

    let idf: number;
    let df = 0;
    if (type === "entity" || type === "env") {
      idf = NEUTRAL_IDF;
    } else {
      const idfRow = idfStmt.get(uri) as { df: number } | undefined;
      if (!idfRow) continue; // anchor not used by any note
      df = idfRow.df;
      idf = Math.log(1 + totalNotes / df);
    }

    const rows = anchorStmt.all(uri, ...statuses) as { id: string; weight: string }[];
    for (const row of rows) {
      const c = getCand(row.id);
      c.anchorScore += (WEIGHT_MULT[row.weight] ?? 1) * idf;
      if (row.weight === "critical") {
        c.pinned = true;
        c.qualified = true;
      } else if (type === "entity" || type === "env") {
        // entity/env: always qualify (not penalised by IDF)
        c.qualified = true;
      } else {
        // file/symbol: qualify unless ubiquitous in a large-enough corpus
        const isUbiquitous =
          totalNotes >= MIN_CORPUS_FOR_IDF && df / totalNotes >= UBIQUITY_RATIO;
        if (!isUbiquitous) c.qualified = true;
      }
    }
  }

  // --- Text path ---
  if (query !== "") {
    const tokens = query.match(/[\p{L}\p{N}_]+/gu);
    if (tokens && tokens.length > 0) {
      const matchStr = tokens.join(" OR ");
      // Pure FTS5 query — no join/subquery so bm25() works correctly.
      // Status filtering done below via a separate lookup.
      const statusSet = new Set(statuses);
      const statusStmt = db.prepare("SELECT status FROM notes WHERE id = ?");
      const textRows = db.prepare(
        `SELECT id, bm25(notes_fts) AS rank FROM notes_fts WHERE notes_fts MATCH ?`
      ).all(matchStr) as { id: string; rank: number }[];

      for (const row of textRows) {
        const textRelevance = -row.rank; // bm25 returns negative; lower = better
        if (textRelevance < BM25_FLOOR) continue;
        const noteRow = statusStmt.get(row.id) as { status: string } | undefined;
        if (!noteRow || !statusSet.has(noteRow.status)) continue;
        const c = getCand(row.id);
        c.textScore += textRelevance * TEXT_WEIGHT;
        c.qualified = true;
      }
    }
  }

  // --- Context (confirming signal, not filter) ---
  const ctxStmt = db.prepare("SELECT DISTINCT note_id FROM anchors WHERE uri = ?");
  for (const uri of context) {
    const rows = ctxStmt.all(uri) as { note_id: string }[];
    for (const row of rows) {
      if (map.has(row.note_id)) {
        getCand(row.note_id).contextHits += 1;
      }
    }
  }

  // --- Filter, score, rank ---
  const qualified: Array<{ id: string; score: number; pinned: boolean }> = [];
  for (const [id, c] of map) {
    if (!c.qualified && !c.pinned) continue;
    const score = c.anchorScore + c.textScore + c.contextHits * CONTEXT_BONUS;
    qualified.push({ id, score, pinned: c.pinned });
  }

  if (qualified.length === 0) {
    return { hits: [], total: 0, truncated: false };
  }

  const idSet = qualified.map((q) => q.id);
  const placeholders = idSet.map(() => "?").join(",");
  const meta = new Map<string, { summary: string; status: string; updated: string }>();
  for (const row of db
    .prepare(`SELECT id, summary, status, updated FROM notes WHERE id IN (${placeholders})`)
    .all(...idSet) as { id: string; summary: string; status: string; updated: string }[]) {
    meta.set(row.id, row);
  }

  // Sort: score desc, updated desc (tiebreak)
  qualified.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ma = meta.get(a.id)?.updated ?? "";
    const mb = meta.get(b.id)?.updated ?? "";
    return mb.localeCompare(ma);
  });

  const total = qualified.length;

  // Truncate: pinned always kept, non-pinned fill up to limit
  const pinned = qualified.filter((q) => q.pinned);
  const nonPinned = qualified.filter((q) => !q.pinned);
  const kept = [...pinned];
  for (const q of nonPinned) {
    if (kept.length >= limit) break;
    kept.push(q);
  }
  // Re-sort kept (pinned + non-pinned may mix positions)
  kept.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ma = meta.get(a.id)?.updated ?? "";
    const mb = meta.get(b.id)?.updated ?? "";
    return mb.localeCompare(ma);
  });

  const truncated = total > kept.length;

  const hits: SearchHit[] = kept.map((q) => {
    const m = meta.get(q.id)!;
    const hit: SearchHit = { id: q.id, summary: m.summary };
    if (m.status !== "current") hit.status = m.status as NoteStatus;
    return hit;
  });

  return { hits, total, truncated };
}
