import type { AnchorWeight, AnchorType } from "../../core/note-store.js";
import type { MentionedNote } from "../../core/get-notes.js";
import type { AnchorRow } from "./data.js";

const WEIGHT_ORDER: AnchorWeight[] = ["critical", "core", "supporting", "incidental"];

export type Loc =
  | { kind: "noteList" }
  | { kind: "searchResults"; query: string }
  | { kind: "anchorNotes"; uri: string }
  | { kind: "noteDetail"; id: string };

export interface HistEntry {
  loc: Loc;
  cursor: number;
}

export type DetailItem =
  | { kind: "anchor"; uri: string; type: AnchorType; weight: AnchorWeight; status: AnchorRow["status"] }
  | { kind: "mention"; id: string; summary?: string; stale: boolean };

export function initHistory(): HistEntry[] {
  return [{ loc: { kind: "noteList" }, cursor: 0 }];
}

export function top(stack: HistEntry[]): HistEntry {
  return stack[stack.length - 1];
}

export function navigate(stack: HistEntry[], loc: Loc): HistEntry[] {
  return [...stack, { loc, cursor: 0 }];
}

export function goBack(stack: HistEntry[]): HistEntry[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

export function setCursor(stack: HistEntry[], cursor: number): HistEntry[] {
  const next = [...stack];
  next[next.length - 1] = { ...next[next.length - 1], cursor };
  return next;
}

export function buildDetailItems(anchors: AnchorRow[], mentioned: MentionedNote[]): DetailItem[] {
  const sorted = [...anchors].sort(
    (a, b) => WEIGHT_ORDER.indexOf(a.weight) - WEIGHT_ORDER.indexOf(b.weight)
  );
  const anchorItems: DetailItem[] = sorted.map((a) => ({
    kind: "anchor" as const,
    uri: a.uri,
    type: a.type,
    weight: a.weight,
    status: a.status,
  }));
  const mentionItems: DetailItem[] = mentioned.map((m) => ({
    kind: "mention" as const,
    id: m.id,
    summary: m.summary,
    stale: m.stale,
  }));
  return [...anchorItems, ...mentionItems];
}
