import type { ExpandedNote, GetNotesResult } from "../core/get-notes.js";
import type { SearchResult } from "../core/search.js";
import type { VerifyResult } from "../core/verifier.js";
import type { Entity } from "../core/entity-store.js";

export interface StatsData {
  totalNotes: number;
  byStatus: Record<string, number>;
  totalAnchors: number;
  staleAnchors: number;
  unknownAnchors: number;
  totalEntities: number;
  totalSymbols: number;
  totalFiles: number;
}

export function renderSearchResult(r: SearchResult): string {
  if (r.hits.length === 0) return "No results.";
  const lines = r.hits.map((h) => {
    const status = h.status ? `  [${h.status}]` : "";
    return `${h.id}  ${h.summary}${status}`;
  });
  const footer = r.truncated
    ? `${r.hits.length} results (truncated, total ${r.total})`
    : `${r.total} result${r.total !== 1 ? "s" : ""}`;
  return [...lines, "", footer].join("\n");
}

export function renderNote(n: ExpandedNote): string {
  const parts: string[] = [];
  const header = n.status !== "current" ? `${n.id}  [${n.status}]` : n.id;
  parts.push(`# ${header}`);
  parts.push(`Summary: ${n.summary}`);
  parts.push("");
  parts.push(n.body);

  if (n.anchorMap.length > 0) {
    parts.push("");
    parts.push("## Anchor Map");
    for (const group of n.anchorMap) {
      parts.push(`### ${group.weight}`);
      for (const a of group.anchors) {
        const flag = a.status !== "ok" ? `  [${a.status}]` : "";
        parts.push(`  ${a.uri}${flag}`);
      }
    }
  }

  if (n.mentioned.length > 0) {
    parts.push("");
    parts.push("## Mentioned Notes");
    for (const m of n.mentioned) {
      const desc = m.summary ? ` — ${m.summary}` : "";
      const staleFlag = m.stale ? "  [stale]" : "";
      const statusFlag = !m.stale && m.status && m.status !== "current" ? `  [${m.status}]` : "";
      parts.push(`  [[${m.id}]]${desc}${staleFlag}${statusFlag}`);
    }
  }

  return parts.join("\n");
}

export function renderGetNotes(r: GetNotesResult): string {
  const parts: string[] = [];
  for (const n of r.notes) {
    if (parts.length > 0) parts.push("", "---", "");
    parts.push(renderNote(n));
  }
  if (r.missing.length > 0) {
    if (parts.length > 0) parts.push("");
    parts.push(`Missing: ${r.missing.join(", ")}`);
  }
  return parts.join("\n");
}

export function renderNoteList(
  rows: { id: string; summary: string; status: string }[],
): string {
  if (rows.length === 0) return "No notes.";
  return rows
    .map((r) => {
      const status = r.status !== "current" ? `  [${r.status}]` : "";
      return `${r.id}  ${r.summary}${status}`;
    })
    .join("\n");
}

export function renderStats(s: StatsData): string {
  const statusLines = Object.entries(s.byStatus)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  return [
    `Notes: ${s.totalNotes}`,
    statusLines || "  (none)",
    `Anchors: ${s.totalAnchors} total, ${s.staleAnchors} stale, ${s.unknownAnchors} unknown`,
    `Entities: ${s.totalEntities}`,
    `Symbols: ${s.totalSymbols}`,
    `Indexed files: ${s.totalFiles}`,
  ].join("\n");
}

export function renderEntityList(es: Entity[]): string {
  if (es.length === 0) return "No entities.";
  return es.map((e) => `${e.name}  ${e.description.split("\n")[0]}`).join("\n");
}

export function renderEntity(e: Entity): string {
  return `## ${e.name}\n\n${e.description}`;
}

export function renderVerify(v: VerifyResult): string {
  return `checked ${v.checked}, ok ${v.ok}, stale ${v.stale}`;
}
