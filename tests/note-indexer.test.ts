import { afterEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { contentHash, reconcileNotes, writeNoteIndexed } from "../src/core/note-indexer.js";
import { type Note, serializeNote } from "../src/core/note-store.js";

const SAMPLE: Note = {
  id: "2024-01-01-auth-fix",
  summary: "Fixed auth middleware token caching",
  status: "current",
  created: "2024-01-01",
  updated: "2024-01-02",
  anchors: [
    { uri: "file:src/middleware/auth.ts", weight: "core" },
    { uri: "symbol:src/middleware/auth.ts::TokenCache", weight: "supporting" },
    { uri: "entity:AuthService", weight: "incidental" },
  ],
  body: "## What was done\n\nFixed token caching in auth middleware.",
};

describe("note-indexer", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup(): { notesDir: string } {
    dir = mkdtempSync(join(tmpdir(), "cms-ni-"));
    db = openIndex(join(dir, "index.db"));
    return { notesDir: join(dir, "notes") };
  }

  function countRows(table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }

  describe("reconcileNotes", () => {
    it("bootstrap: empty index → all notes indexed", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      const a: Note = { ...SAMPLE, id: "2024-01-01-aaa" };
      const b: Note = { ...SAMPLE, id: "2024-01-02-bbb" };
      writeFileSync(join(notesDir, "2024-01-01-aaa.md"), serializeNote(a));
      writeFileSync(join(notesDir, "2024-01-02-bbb.md"), serializeNote(b));
      reconcileNotes(db, notesDir);
      expect(countRows("notes")).toBe(2);
    });

    it("adds new note to index", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(SAMPLE));
      reconcileNotes(db, notesDir);
      const row = db.prepare("SELECT id, summary FROM notes WHERE id=?").get(SAMPLE.id) as
        | { id: string; summary: string }
        | undefined;
      expect(row?.id).toBe(SAMPLE.id);
      expect(row?.summary).toBe(SAMPLE.summary);
    });

    it("indexes all anchors with correct type", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(SAMPLE));
      reconcileNotes(db, notesDir);
      const anchors = db
        .prepare("SELECT uri, type, weight FROM anchors WHERE note_id=? ORDER BY uri")
        .all(SAMPLE.id) as { uri: string; type: string; weight: string }[];
      expect(anchors).toHaveLength(3);
      expect(anchors.find((a) => a.uri === "file:src/middleware/auth.ts")?.type).toBe("file");
      expect(anchors.find((a) => a.uri.startsWith("symbol:"))?.type).toBe("symbol");
      expect(anchors.find((a) => a.uri.startsWith("entity:"))?.type).toBe("entity");
    });

    it("note searchable via notes_fts after reconcile", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(SAMPLE));
      reconcileNotes(db, notesDir);
      const row = db
        .prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH ?")
        .get("caching") as { id: string } | undefined;
      expect(row?.id).toBe(SAMPLE.id);
    });

    it("edit → reindex updates body and content_hash", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(SAMPLE));
      reconcileNotes(db, notesDir);
      const hashBefore = (
        db.prepare("SELECT content_hash FROM notes WHERE id=?").get(SAMPLE.id) as {
          content_hash: string;
        }
      ).content_hash;

      const updated: Note = { ...SAMPLE, body: "## Updated\n\nNew body content here." };
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(updated));
      reconcileNotes(db, notesDir);

      expect(countRows("notes")).toBe(1);
      const row = db.prepare("SELECT body, content_hash FROM notes WHERE id=?").get(SAMPLE.id) as {
        body: string;
        content_hash: string;
      };
      expect(row.body).toBe(updated.body);
      expect(row.content_hash).not.toBe(hashBefore);
    });

    it("delete file → note removed from notes, anchors, notes_fts", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      writeFileSync(join(notesDir, `${SAMPLE.id}.md`), serializeNote(SAMPLE));
      reconcileNotes(db, notesDir);
      expect(countRows("notes")).toBe(1);

      unlinkSync(join(notesDir, `${SAMPLE.id}.md`));
      reconcileNotes(db, notesDir);

      expect(countRows("notes")).toBe(0);
      expect(countRows("anchors")).toBe(0);
      expect(db.prepare("SELECT id FROM notes_fts WHERE id=?").get(SAMPLE.id)).toBeUndefined();
    });

    it("unchanged note not reindexed — hash of untouched note stays same", () => {
      const { notesDir } = setup();
      mkdirSync(notesDir, { recursive: true });
      const a: Note = { ...SAMPLE, id: "2024-01-01-aaa" };
      const b: Note = { ...SAMPLE, id: "2024-01-02-bbb" };
      writeFileSync(join(notesDir, "2024-01-01-aaa.md"), serializeNote(a));
      writeFileSync(join(notesDir, "2024-01-02-bbb.md"), serializeNote(b));
      reconcileNotes(db, notesDir);

      const hashB = (
        db.prepare("SELECT content_hash FROM notes WHERE id=?").get(b.id) as {
          content_hash: string;
        }
      ).content_hash;

      const changed: Note = { ...a, body: "## Changed\n\nDifferent body." };
      writeFileSync(join(notesDir, "2024-01-01-aaa.md"), serializeNote(changed));
      reconcileNotes(db, notesDir);

      expect(countRows("notes")).toBe(2);
      const hashBAfter = (
        db.prepare("SELECT content_hash FROM notes WHERE id=?").get(b.id) as {
          content_hash: string;
        }
      ).content_hash;
      expect(hashBAfter).toBe(hashB);
    });

    it("reconcile on non-existent notesDir does not throw", () => {
      const { notesDir } = setup();
      expect(() => reconcileNotes(db, notesDir)).not.toThrow();
      expect(countRows("notes")).toBe(0);
    });
  });

  describe("writeNoteIndexed", () => {
    it("writes .md file and removes .tmp", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      expect(existsSync(join(notesDir, `${SAMPLE.id}.md`))).toBe(true);
      expect(existsSync(join(notesDir, `${SAMPLE.id}.md.tmp`))).toBe(false);
    });

    it("note appears in notes table with all anchors", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      expect(countRows("notes")).toBe(1);
      expect(countRows("anchors")).toBe(SAMPLE.anchors.length);
    });

    it("content_hash equals contentHash(serializeNote(note))", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      const expected = contentHash(serializeNote(SAMPLE));
      const row = db.prepare("SELECT content_hash FROM notes WHERE id=?").get(SAMPLE.id) as {
        content_hash: string;
      };
      expect(row.content_hash).toBe(expected);
    });

    it("idempotent: second call → single row in notes, no duplicate anchors", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      writeNoteIndexed(db, notesDir, SAMPLE);
      expect(countRows("notes")).toBe(1);
      expect(countRows("anchors")).toBe(SAMPLE.anchors.length);
    });

    it("updated anchors replace old ones", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      const updated: Note = {
        ...SAMPLE,
        anchors: [{ uri: "file:src/new-file.ts", weight: "core" }],
      };
      writeNoteIndexed(db, notesDir, updated);
      expect(countRows("anchors")).toBe(1);
      const row = db.prepare("SELECT uri FROM anchors WHERE note_id=?").get(SAMPLE.id) as {
        uri: string;
      };
      expect(row.uri).toBe("file:src/new-file.ts");
    });

    it("note searchable via notes_fts after writeNoteIndexed", () => {
      const { notesDir } = setup();
      writeNoteIndexed(db, notesDir, SAMPLE);
      const row = db
        .prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH ?")
        .get("middleware") as { id: string } | undefined;
      expect(row?.id).toBe(SAMPLE.id);
    });
  });
});
