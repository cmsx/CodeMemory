import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  type Anchor,
  type Note,
  type NoteStatus,
  anchorType,
  generateNoteId,
  isValidNoteId,
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

export class InvalidSummaryError extends Error {
  constructor(found: string) {
    super(
      `summary must be plain text — it cannot contain ${found}. ` +
        "Angle brackets and YAML indicators (< > { } [ ] | `) corrupt the note's " +
        "frontmatter and are the signature of a broken tool-call boundary; " +
        "rewrite the summary as prose and put any markup in the body.",
    );
    this.name = "InvalidSummaryError";
  }
}

// Angle brackets open YAML block scalars and carry the </parameter> tool-call
// leak; the flow indicators { } [ ] and | ` likewise break the frontmatter
// scalar. The summary is a one-line prose field — keep it plain text and let
// the body hold any markup.
const FORBIDDEN_SUMMARY_CHARS = /[<>{}[\]|`]/g;

function validateSummary(summary: string): void {
  const hits = summary.match(FORBIDDEN_SUMMARY_CHARS);
  if (hits) {
    const unique = [...new Set(hits)].join(" ");
    throw new InvalidSummaryError(unique);
  }
}

export interface NoteUpdate {
  summary?: string;
  body?: string;
  anchors?: Anchor[];
  status?: NoteStatus;
}

// Soft signal, not a gate: a note anchored on a single axis is the most
// common capture defect. The full anchor set is an authoring judgement and
// is never forced — but axis *presence* is binary, so an empty axis is worth
// flagging back at the moment of capture.
export function anchorCoverageWarning(anchors: Anchor[]): string | null {
  const types = new Set(anchors.map((a) => anchorType(a.uri)));
  const hasConceptual = types.has("entity");
  const hasImplementation = types.has("file") || types.has("symbol");
  if (hasConceptual && hasImplementation) return null;
  if (!hasConceptual && !hasImplementation) {
    return "Note anchored on neither axis (no entity: and no file:/symbol: anchors) — under-anchored. Add entity: for every domain entity the note concerns and file:/symbol: for the code it centers on. See the anchor checklist in the mem skill.";
  }
  if (!hasConceptual) {
    return "Note has no entity: anchor — the conceptual axis is the main search axis and cannot be derived from code. Add entity:Name for every domain entity this note concerns. See the anchor checklist in the mem skill.";
  }
  return "Note has no file:/symbol: anchor — the implementation axis is missing. Anchor the class/file itself, not only its methods. See the anchor checklist in the mem skill.";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_ID_ATTEMPTS = 10;

// IDs are random, so a fresh note never replays onto an existing one. The
// loop only guards against the rare hash collision; the `.md` on disk is the
// source of truth for uniqueness. Dedup of overlapping notes is the skill's
// job (search → update_note), not this writer's.
function uniqueNoteId(notesDir: string): string {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = generateNoteId();
    if (!isValidNoteId(id)) continue;
    if (!existsSync(join(notesDir, id + ".md"))) return id;
  }
  throw new Error("could not generate a unique note id");
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
  return withLock(
    memoryDir,
    () => {
      validateSummary(summary);
      validateAnchors(db, anchors);
      const id = uniqueNoteId(notesDir);
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
      if (update.summary !== undefined) validateSummary(update.summary);
      const existing = readNote(notesDir, id);
      const next: Note = {
        ...existing,
        summary: update.summary ?? existing.summary,
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
