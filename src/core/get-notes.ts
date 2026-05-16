import type { DatabaseSync } from "node:sqlite";
import type { AnchorWeight, NoteStatus } from "./note-store.js";

export type AnchorStatus = "ok" | "stale" | "unknown";

export interface AnchorMapEntry {
  uri: string;
  weight: AnchorWeight;
  status: AnchorStatus;
}

export interface AnchorGroup {
  weight: AnchorWeight;
  anchors: AnchorMapEntry[];
}

export interface MentionedNote {
  id: string;
  summary?: string;
  status?: NoteStatus;
  stale: boolean;
}

export interface ExpandedNote {
  id: string;
  summary: string;
  status: NoteStatus;
  body: string;
  anchorMap: AnchorGroup[];
  mentioned: MentionedNote[];
}

export interface GetNotesResult {
  notes: ExpandedNote[];
  missing: string[];
}

const WEIGHT_ORDER: AnchorWeight[] = ["critical", "core", "supporting", "incidental"];

function extractMentions(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const id = m[1].trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function getNotes(db: DatabaseSync, ids: string[]): GetNotesResult {
  // Deduplicate preserving first-appearance order
  const deduped = [...new Set(ids)];

  const noteStmt = db.prepare(
    "SELECT id, summary, status, body FROM notes WHERE id = ?"
  );
  const anchorStmt = db.prepare(
    `SELECT uri, weight, anchor_status FROM anchors
     WHERE note_id = ? AND type IN ('file','symbol') ORDER BY id`
  );

  const notes: ExpandedNote[] = [];
  const missing: string[] = [];

  for (const id of deduped) {
    const row = noteStmt.get(id) as
      | { id: string; summary: string; status: string; body: string }
      | undefined;

    if (!row) {
      missing.push(id);
      continue;
    }

    // Anchor map — file/symbol only, grouped by WEIGHT_ORDER, non-empty groups only
    const anchorRows = anchorStmt.all(id) as {
      uri: string;
      weight: string;
      anchor_status: string;
    }[];

    const byWeight = new Map<AnchorWeight, AnchorMapEntry[]>();
    for (const a of anchorRows) {
      const w = a.weight as AnchorWeight;
      let group = byWeight.get(w);
      if (!group) {
        group = [];
        byWeight.set(w, group);
      }
      group.push({ uri: a.uri, weight: w, status: a.anchor_status as AnchorStatus });
    }
    const anchorMap: AnchorGroup[] = [];
    for (const w of WEIGHT_ORDER) {
      const anchors = byWeight.get(w);
      if (anchors && anchors.length > 0) anchorMap.push({ weight: w, anchors });
    }

    // Mentioned notes — [[id]] extracted from body
    const mentionIds = extractMentions(row.body);
    const mentioned: MentionedNote[] = mentionIds.map((refId) => {
      const ref = noteStmt.get(refId) as
        | { id: string; summary: string; status: string }
        | undefined;
      if (!ref) return { id: refId, stale: true };
      const m: MentionedNote = { id: refId, summary: ref.summary, stale: false };
      if (ref.status !== "current") m.status = ref.status as NoteStatus;
      return m;
    });

    notes.push({
      id: row.id,
      summary: row.summary,
      status: row.status as NoteStatus,
      body: row.body,
      anchorMap,
      mentioned,
    });
  }

  return { notes, missing };
}
