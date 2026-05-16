import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Note,
  NoteParseError,
  listNotes,
  parseNote,
  readNote,
  serializeNote,
  writeNote,
} from "../src/core/note-store.js";

const SAMPLE: Note = {
  id: "2024-01-01-auth-fix",
  summary: "Fixed auth middleware to cache tokens correctly",
  status: "current",
  created: "2024-01-01",
  updated: "2024-01-02",
  anchors: [
    { uri: "file:src/middleware/auth.ts", weight: "core" },
    { uri: "entity:AuthService", weight: "supporting" },
  ],
  body: "## What was done\n\nFixed token caching.",
};

describe("note-store", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function tmpDir(): string {
    dir = mkdtempSync(join(tmpdir(), "cms-ns-"));
    return dir;
  }

  describe("round-trip", () => {
    it("writeNote + readNote returns equal note", () => {
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, SAMPLE);
      expect(readNote(notesDir, SAMPLE.id)).toEqual(SAMPLE);
    });

    it("file exists at <notesDir>/<id>.md after writeNote", () => {
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, SAMPLE);
      expect(existsSync(join(notesDir, `${SAMPLE.id}.md`))).toBe(true);
    });

    it("no .tmp file left after writeNote", () => {
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, SAMPLE);
      expect(existsSync(join(notesDir, `${SAMPLE.id}.md.tmp`))).toBe(false);
    });

    it("round-trip preserves all anchor fields", () => {
      const note: Note = {
        ...SAMPLE,
        anchors: [
          { uri: "file:src/a.ts", weight: "critical" },
          { uri: "symbol:src/b.ts::MyClass", weight: "core" },
          { uri: "entity:Foo", weight: "supporting" },
          { uri: "env:DATABASE_URL", weight: "incidental" },
        ],
      };
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, note);
      expect(readNote(notesDir, note.id)).toEqual(note);
    });
  });

  describe("parseNote — invalid frontmatter", () => {
    it("throws on broken YAML", () => {
      expect(() => parseNote("x.md", "---\n: : : bad\n---\nbody")).toThrow();
    });

    it("throws NoteParseError on missing summary", () => {
      const raw = serializeNote({ ...SAMPLE });
      const broken = raw.replace(/summary:.*\n/, "");
      expect(() => parseNote(`${SAMPLE.id}.md`, broken)).toThrow(NoteParseError);
    });

    it("throws NoteParseError on missing id", () => {
      const raw = serializeNote(SAMPLE);
      const broken = raw.replace(/^id:.*\n/m, "");
      expect(() => parseNote(`${SAMPLE.id}.md`, broken)).toThrow(NoteParseError);
    });

    it("throws NoteParseError on invalid status", () => {
      const raw = serializeNote(SAMPLE).replace("current", "bogus");
      expect(() => parseNote(`${SAMPLE.id}.md`, raw)).toThrow(NoteParseError);
    });

    it("throws NoteParseError on invalid anchor weight", () => {
      const note: Note = {
        ...SAMPLE,
        anchors: [{ uri: "file:src/foo.ts", weight: "bogus" as never }],
      };
      const raw = serializeNote(note);
      expect(() => parseNote(`${note.id}.md`, raw)).toThrow(NoteParseError);
    });

    it("throws NoteParseError on invalid anchor type in uri", () => {
      const raw = serializeNote(SAMPLE).replace("file:src/middleware/auth.ts", "ftp:src/foo.ts");
      expect(() => parseNote(`${SAMPLE.id}.md`, raw)).toThrow(NoteParseError);
    });

    it("throws NoteParseError on empty anchors array", () => {
      const raw = serializeNote(SAMPLE).replace(/anchors:[\s\S]*?(?=\n\w|\n---)/m, "anchors: []\n");
      expect(() => parseNote(`${SAMPLE.id}.md`, raw)).toThrow(NoteParseError);
    });

    it("throws NoteParseError when id does not match filename", () => {
      const raw = serializeNote(SAMPLE);
      expect(() => parseNote("different-name.md", raw)).toThrow(NoteParseError);
    });
  });

  describe("YAML-Date normalization", () => {
    it("parses YAML dates (Date objects) to YYYY-MM-DD strings", () => {
      // gray-matter/js-yaml parses unquoted YYYY-MM-DD as JS Date
      const raw = `---
id: 2024-01-01-auth-fix
summary: test
status: current
created: 2024-01-01
updated: 2024-01-02
anchors:
  - uri: file:src/a.ts
    weight: core
---
body`;
      const note = parseNote("2024-01-01-auth-fix.md", raw);
      expect(typeof note.created).toBe("string");
      expect(note.created).toBe("2024-01-01");
      expect(typeof note.updated).toBe("string");
      expect(note.updated).toBe("2024-01-02");
    });
  });

  describe("listNotes", () => {
    it("returns empty array when notesDir does not exist", () => {
      expect(listNotes(join(tmpDir(), "nonexistent"))).toEqual([]);
    });

    it("returns empty array for empty notesDir", () => {
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, SAMPLE); // creates dir
      // remove the written file
      rmSync(join(notesDir, `${SAMPLE.id}.md`));
      expect(listNotes(notesDir)).toEqual([]);
    });

    it("returns all notes sorted by id", () => {
      const notesDir = join(tmpDir(), "notes");
      const a: Note = { ...SAMPLE, id: "2024-01-01-aaa" };
      const b: Note = { ...SAMPLE, id: "2024-01-02-bbb" };
      writeNote(notesDir, b);
      writeNote(notesDir, a);
      const result = listNotes(notesDir);
      expect(result.map((n) => n.id)).toEqual(["2024-01-01-aaa", "2024-01-02-bbb"]);
    });

    it("ignores .md.tmp files", () => {
      const notesDir = join(tmpDir(), "notes");
      writeNote(notesDir, SAMPLE);
      // write a stray .tmp file
      writeFileSync(join(notesDir, "stray.md.tmp"), "junk");
      const result = listNotes(notesDir);
      expect(result).toHaveLength(1);
    });
  });
});
