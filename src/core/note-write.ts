import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  type Anchor,
  type Note,
  type NoteStatus,
  anchorType,
  listNotes,
  readNote,
} from "./note-store.js";
import { removeNoteFromIndex, writeNoteIndexed } from "./note-indexer.js";
import { entityExists } from "./entity-indexer.js";
import { type LockOpts, withLock } from "./lock.js";

export class UnregisteredEntityError extends Error {
  constructor(name: string) {
    super(`entity "${name}" is not registered`);
    this.name = "UnregisteredEntityError";
  }
}

export interface NoteUpdate {
  body?: string;
  anchors?: Anchor[];
  status?: NoteStatus;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "note";
}

export function makeNoteId(summary: string, date: string): string {
  return `${date}-${slugify(summary)}`;
}

function validateAnchors(db: DatabaseSync, anchors: Anchor[]): void {
  if (anchors.length === 0) {
    throw new Error("note must have at least one anchor");
  }
  for (const a of anchors) {
    const t = anchorType(a.uri); // throws on unknown type
    if (t === "entity") {
      const name = a.uri.slice(a.uri.indexOf(":") + 1);
      if (!entityExists(db, name)) {
        throw new UnregisteredEntityError(name);
      }
    }
  }
}

export function createNote(
  db: DatabaseSync,
  memoryDir: string,
  summary: string,
  body: string,
  anchors: Anchor[],
  status: NoteStatus,
  now: string = today(),
  opts?: LockOpts,
): Note {
  const notesDir = join(memoryDir, "notes");
  const id = makeNoteId(summary, now);
  return withLock(
    memoryDir,
    () => {
      if (existsSync(join(notesDir, id + ".md"))) {
        return readNote(notesDir, id);
      }
      validateAnchors(db, anchors);
      const note: Note = { id, summary, status, created: now, updated: now, anchors, body };
      writeNoteIndexed(db, notesDir, note);
      return note;
    },
    opts,
  );
}

export function updateNote(
  db: DatabaseSync,
  memoryDir: string,
  id: string,
  update: NoteUpdate,
  now: string = today(),
  opts?: LockOpts,
): Note {
  const notesDir = join(memoryDir, "notes");
  return withLock(
    memoryDir,
    () => {
      const existing = readNote(notesDir, id);
      const next: Note = {
        ...existing,
        body: update.body ?? existing.body,
        anchors: update.anchors ?? existing.anchors,
        status: update.status ?? existing.status,
        updated: now,
      };
      if (update.anchors) validateAnchors(db, next.anchors);
      writeNoteIndexed(db, notesDir, next);
      return next;
    },
    opts,
  );
}

export function deleteNote(
  db: DatabaseSync,
  memoryDir: string,
  id: string,
  opts?: LockOpts,
): boolean {
  const notesDir = join(memoryDir, "notes");
  return withLock(
    memoryDir,
    () => {
      const target = join(notesDir, id + ".md");
      if (!existsSync(target)) return false;
      db.exec("BEGIN");
      try {
        removeNoteFromIndex(db, id);
        unlinkSync(target);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return true;
    },
    opts,
  );
}

export function renameAnchor(
  db: DatabaseSync,
  memoryDir: string,
  oldUri: string,
  newUri: string,
  opts?: LockOpts,
): number {
  const notesDir = join(memoryDir, "notes");
  anchorType(newUri); // validate new URI type before acquiring lock
  return withLock(
    memoryDir,
    () => {
      let count = 0;
      for (const note of listNotes(notesDir)) {
        if (!note.anchors.some((a) => a.uri === oldUri)) continue;
        const next: Note = {
          ...note,
          anchors: note.anchors.map((a) => (a.uri === oldUri ? { ...a, uri: newUri } : a)),
        };
        writeNoteIndexed(db, notesDir, next);
        count++;
      }
      return count;
    },
    opts,
  );
}
