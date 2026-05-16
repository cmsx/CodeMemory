import type { DatabaseSync } from "node:sqlite";
import type { NoteStatus, AnchorWeight, AnchorType } from "../../core/note-store.js";

export interface NoteRow {
  id: string;
  summary: string;
  status: NoteStatus;
}

export interface AnchorRow {
  uri: string;
  type: AnchorType;
  weight: AnchorWeight;
  status: "ok" | "stale" | "unknown";
}

export function listAllNotes(db: DatabaseSync): NoteRow[] {
  return db
    .prepare("SELECT id, summary, status FROM notes ORDER BY updated DESC, id")
    .all() as unknown as NoteRow[];
}

export function noteAnchors(db: DatabaseSync, noteId: string): AnchorRow[] {
  return db
    .prepare(
      "SELECT uri, type, weight, anchor_status AS status FROM anchors WHERE note_id = ?"
    )
    .all(noteId) as unknown as AnchorRow[];
}
