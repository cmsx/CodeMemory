import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { type Note, anchorType, parseNote, serializeNote } from "./note-store.js";

export function contentHash(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function indexNote(db: DatabaseSync, note: Note, hash: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(note.id);
  db.prepare("DELETE FROM notes_fts WHERE id = ?").run(note.id);
  db.prepare(
    "INSERT INTO notes (id, summary, status, created, updated, body, content_hash) VALUES (?,?,?,?,?,?,?)"
  ).run(note.id, note.summary, note.status, note.created, note.updated, note.body, hash);
  const insertAnchor = db.prepare(
    "INSERT INTO anchors (note_id, uri, type, weight) VALUES (?,?,?,?)"
  );
  for (const anchor of note.anchors) {
    insertAnchor.run(note.id, anchor.uri, anchorType(anchor.uri), anchor.weight);
  }
  db.prepare("INSERT INTO notes_fts (id, summary, body) VALUES (?,?,?)").run(
    note.id,
    note.summary,
    note.body
  );
}

function removeNoteFromIndex(db: DatabaseSync, id: string): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  db.prepare("DELETE FROM notes_fts WHERE id = ?").run(id);
}

export function writeNoteIndexed(db: DatabaseSync, notesDir: string, note: Note): void {
  mkdirSync(notesDir, { recursive: true });
  const serialized = serializeNote(note);
  const hash = contentHash(serialized);
  const target = join(notesDir, note.id + ".md");
  const tmp = target + ".tmp";
  writeFileSync(tmp, serialized);
  db.exec("BEGIN");
  try {
    indexNote(db, note, hash);
    renameSync(tmp, target);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function reconcileNotes(db: DatabaseSync, notesDir: string): void {
  let files: string[];
  try {
    files = readdirSync(notesDir).filter(
      (f) => f.endsWith(".md") && !f.endsWith(".md.tmp")
    );
  } catch {
    files = [];
  }

  const indexed = new Map<string, string>();
  for (const row of db.prepare("SELECT id, content_hash FROM notes").all() as {
    id: string;
    content_hash: string;
  }[]) {
    indexed.set(row.id, row.content_hash);
  }

  const seen = new Set<string>();
  db.exec("BEGIN");
  try {
    for (const f of files) {
      const raw = readFileSync(join(notesDir, f), "utf8");
      const hash = contentHash(raw);
      const note = parseNote(f, raw);
      seen.add(note.id);
      if (indexed.get(note.id) !== hash) {
        indexNote(db, note, hash);
      }
    }
    for (const id of indexed.keys()) {
      if (!seen.has(id)) removeNoteFromIndex(db, id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
