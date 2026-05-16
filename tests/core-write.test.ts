import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { createEntity } from "../src/core/entity-indexer.js";
import { LockTimeoutError, withLock } from "../src/core/lock.js";
import {
  UnregisteredEntityError,
  createNote,
  deleteNote,
  makeNoteId,
  renameAnchor,
  slugify,
  updateNote,
} from "../src/core/note-write.js";
import { readNote } from "../src/core/note-store.js";

const BODY = "## What was done\n\nFixed token caching.";
const ANCHORS = [{ uri: "file:src/auth.ts", weight: "core" as const }];

describe("slugify / makeNoteId", () => {
  it("lowercases and replaces non-alphanum with dashes", () => {
    expect(slugify("Fixed Auth Middleware Bug")).toBe("fixed-auth-middleware-bug");
  });

  it("collapses consecutive separators", () => {
    expect(slugify("hello   world!!")).toBe("hello-world");
  });

  it("falls back to 'note' for empty result", () => {
    expect(slugify("!!!")).toBe("note");
  });

  it("makeNoteId combines date and slug", () => {
    expect(makeNoteId("Auth fix", "2024-01-15")).toBe("2024-01-15-auth-fix");
  });
});

describe("createNote", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-cw-"));
    db = openIndex(join(dir, "index.db"));
    return { memoryDir: dir, notesDir: join(dir, "notes") };
  }

  function countRows(table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }

  it("creates .md file with id YYYY-MM-DD-slug", () => {
    const { memoryDir, notesDir } = setup();
    const note = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(note.id).toBe("2024-01-01-auth-fix");
    expect(existsSync(join(notesDir, "2024-01-01-auth-fix.md"))).toBe(true);
  });

  it("indexes note and anchors in SQLite", () => {
    const { memoryDir } = setup();
    createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(countRows("notes")).toBe(1);
    expect(countRows("anchors")).toBe(1);
    const row = db.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH ?").get("caching") as
      | { id: string }
      | undefined;
    expect(row?.id).toBe("2024-01-01-auth-fix");
  });

  it("idempotent: second call with same summary+now → no-op, no duplicates", () => {
    const { memoryDir } = setup();
    const n1 = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    const n2 = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(n1.id).toBe(n2.id);
    expect(countRows("notes")).toBe(1);
    expect(countRows("anchors")).toBe(1);
  });

  it("rejects entity: anchor for unregistered entity", () => {
    const { memoryDir, notesDir } = setup();
    const anchors = [{ uri: "entity:Foo", weight: "core" as const }];
    expect(() =>
      createNote(db, memoryDir, "Auth fix", BODY, anchors, "current", "2024-01-01"),
    ).toThrow(UnregisteredEntityError);
    expect(existsSync(join(notesDir, "2024-01-01-auth-fix.md"))).toBe(false);
  });

  it("accepts entity: anchor after entity is registered", () => {
    const { memoryDir } = setup();
    createEntity(db, memoryDir, { name: "AuthService", description: "Handles auth." });
    const anchors = [{ uri: "entity:AuthService", weight: "core" as const }];
    expect(() =>
      createNote(db, memoryDir, "Auth fix", BODY, anchors, "current", "2024-01-01"),
    ).not.toThrow();
    expect(countRows("notes")).toBe(1);
  });

  it("rejects empty anchors array", () => {
    const { memoryDir } = setup();
    expect(() =>
      createNote(db, memoryDir, "Auth fix", BODY, [], "current", "2024-01-01"),
    ).toThrow("at least one anchor");
  });

  it("draft status is stored correctly", () => {
    const { memoryDir } = setup();
    const note = createNote(db, memoryDir, "Draft note", BODY, ANCHORS, "draft", "2024-01-01");
    expect(note.status).toBe("draft");
    const row = db.prepare("SELECT status FROM notes WHERE id=?").get(note.id) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe("draft");
  });
});

describe("updateNote", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-un-"));
    db = openIndex(join(dir, "index.db"));
    const memoryDir = dir;
    createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    return { memoryDir, id: "2024-01-01-auth-fix" };
  }

  it("updates body and bumps updated, preserves created and summary", () => {
    const { memoryDir, id } = setup();
    const newBody = "## Updated\n\nNew content.";
    const updated = updateNote(db, memoryDir, id, { body: newBody }, "2024-02-01");
    expect(updated.body).toBe(newBody);
    expect(updated.updated).toBe("2024-02-01");
    expect(updated.created).toBe("2024-01-01");
    expect(updated.summary).toBe("Auth fix");
    const onDisk = readNote(join(memoryDir, "notes"), id);
    expect(onDisk.body).toBe(newBody);
  });

  it("changes status to outdated", () => {
    const { memoryDir, id } = setup();
    const updated = updateNote(db, memoryDir, id, { status: "outdated" }, "2024-02-01");
    expect(updated.status).toBe("outdated");
    const row = db.prepare("SELECT status FROM notes WHERE id=?").get(id) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe("outdated");
  });

  it("replaces anchors and validates entity:", () => {
    const { memoryDir, id } = setup();
    const newAnchors = [{ uri: "file:src/new.ts", weight: "supporting" as const }];
    const updated = updateNote(db, memoryDir, id, { anchors: newAnchors }, "2024-02-01");
    expect(updated.anchors).toHaveLength(1);
    expect(updated.anchors[0].uri).toBe("file:src/new.ts");
    const rows = db.prepare("SELECT uri FROM anchors WHERE note_id=?").all(id) as {
      uri: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].uri).toBe("file:src/new.ts");
  });

  it("rejects entity: anchor in update for unregistered entity", () => {
    const { memoryDir, id } = setup();
    expect(() =>
      updateNote(
        db,
        memoryDir,
        id,
        { anchors: [{ uri: "entity:Unknown", weight: "core" as const }] },
        "2024-02-01",
      ),
    ).toThrow(UnregisteredEntityError);
  });

  it("throws for non-existent id", () => {
    const { memoryDir } = setup();
    expect(() => updateNote(db, memoryDir, "no-such-note", { body: "x" })).toThrow();
  });

  it("no-op fields: omitted fields stay unchanged", () => {
    const { memoryDir, id } = setup();
    const before = readNote(join(memoryDir, "notes"), id);
    const updated = updateNote(db, memoryDir, id, {}, "2024-02-01");
    expect(updated.body).toBe(before.body);
    expect(updated.anchors).toEqual(before.anchors);
    expect(updated.status).toBe(before.status);
    expect(updated.updated).toBe("2024-02-01");
  });
});

describe("renameAnchor", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-ra-"));
    db = openIndex(join(dir, "index.db"));
    const memoryDir = dir;
    createNote(db, memoryDir, "Note A", BODY, [{ uri: "file:old.ts", weight: "core" as const }], "current", "2024-01-01");
    createNote(db, memoryDir, "Note B", BODY, [{ uri: "file:old.ts", weight: "supporting" as const }, { uri: "file:other.ts", weight: "core" as const }], "current", "2024-01-02");
    createNote(db, memoryDir, "Note C", BODY, [{ uri: "file:other.ts", weight: "core" as const }], "current", "2024-01-03");
    return { memoryDir };
  }

  it("returns count of affected notes", () => {
    const { memoryDir } = setup();
    const count = renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    expect(count).toBe(2);
  });

  it("updates URI in .md files and in anchors table", () => {
    const { memoryDir } = setup();
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");

    const notesDir = join(memoryDir, "notes");
    const a = readNote(notesDir, "2024-01-01-note-a");
    expect(a.anchors[0].uri).toBe("file:renamed.ts");

    const b = readNote(notesDir, "2024-01-02-note-b");
    const renamed = b.anchors.find((x) => x.uri === "file:renamed.ts");
    expect(renamed).toBeDefined();
    expect(b.anchors.find((x) => x.uri === "file:old.ts")).toBeUndefined();

    const rows = db.prepare("SELECT uri FROM anchors WHERE uri=?").all("file:renamed.ts") as {
      uri: string;
    }[];
    expect(rows).toHaveLength(2);
    expect(
      db.prepare("SELECT uri FROM anchors WHERE uri=?").all("file:old.ts"),
    ).toHaveLength(0);
  });

  it("does not touch notes without oldUri", () => {
    const { memoryDir } = setup();
    const notesDir = join(memoryDir, "notes");
    const before = readNote(notesDir, "2024-01-03-note-c");
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    const after = readNote(notesDir, "2024-01-03-note-c");
    expect(after.anchors).toEqual(before.anchors);
  });

  it("returns 0 when oldUri not found", () => {
    const { memoryDir } = setup();
    expect(renameAnchor(db, memoryDir, "file:nonexistent.ts", "file:x.ts")).toBe(0);
  });

  it("does not bump updated on renamed notes", () => {
    const { memoryDir } = setup();
    const notesDir = join(memoryDir, "notes");
    const before = readNote(notesDir, "2024-01-01-note-a");
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    const after = readNote(notesDir, "2024-01-01-note-a");
    expect(after.updated).toBe(before.updated);
  });

  it("throws on invalid newUri type", () => {
    const { memoryDir } = setup();
    expect(() => renameAnchor(db, memoryDir, "file:old.ts", "bad:uri")).toThrow();
  });
});

describe("withLock", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-lk-"));
    return dir;
  }

  it("lock file is removed after withLock returns", () => {
    const memoryDir = setup();
    withLock(memoryDir, () => {});
    expect(existsSync(join(memoryDir, "lock"))).toBe(false);
  });

  it("lock file is removed even when fn throws", () => {
    const memoryDir = setup();
    expect(() => withLock(memoryDir, () => { throw new Error("boom"); })).toThrow("boom");
    expect(existsSync(join(memoryDir, "lock"))).toBe(false);
  });

  it("fn return value is propagated", () => {
    const memoryDir = setup();
    const result = withLock(memoryDir, () => 42);
    expect(result).toBe(42);
  });

  it("stale lock (dead pid) is stolen and withLock proceeds", () => {
    const memoryDir = setup();
    const lockPath = join(memoryDir, "lock");
    writeFileSync(lockPath, "999999999"); // dead pid
    let ran = false;
    withLock(memoryDir, () => { ran = true; });
    expect(ran).toBe(true);
  });

  it("throws LockTimeoutError when lock is held by alive process (pid 1 = init)", () => {
    const memoryDir = setup();
    const lockPath = join(memoryDir, "lock");
    writeFileSync(lockPath, "1"); // pid 1 is always alive on Linux
    expect(() =>
      withLock(memoryDir, () => {}, { timeoutMs: 150, pollMs: 30 }),
    ).toThrow(LockTimeoutError);
    // cleanup so afterEach rmSync works cleanly
    rmSync(lockPath, { force: true });
  });
});

describe("deleteNote", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-del-"));
    db = openIndex(join(dir, "index.db"));
    return { memoryDir: dir, notesDir: join(dir, "notes") };
  }

  it("removes .md file and index rows", () => {
    const { memoryDir, notesDir } = setup();
    const note = createNote(db, memoryDir, "To delete", BODY, ANCHORS, "current", "2024-01-10");
    const id = note.id;
    expect(existsSync(join(notesDir, id + ".md"))).toBe(true);

    const deleted = deleteNote(db, memoryDir, id);
    expect(deleted).toBe(true);
    expect(existsSync(join(notesDir, id + ".md"))).toBe(false);
    expect(db.prepare("SELECT 1 FROM notes WHERE id = ?").get(id)).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM anchors WHERE note_id = ?").get(id)).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM notes_fts WHERE id = ?").get(id)).toBeUndefined();
  });

  it("is idempotent — returns false for non-existent note", () => {
    const { memoryDir } = setup();
    expect(deleteNote(db, memoryDir, "no-such-note")).toBe(false);
  });

  it("does not affect other notes", () => {
    const { memoryDir } = setup();
    const n1 = createNote(db, memoryDir, "Keep this", BODY, ANCHORS, "current", "2024-01-01");
    const n2 = createNote(db, memoryDir, "Delete this", BODY, ANCHORS, "current", "2024-01-02");
    deleteNote(db, memoryDir, n2.id);
    expect(
      db.prepare("SELECT 1 FROM notes WHERE id = ?").get(n1.id),
    ).toBeDefined();
  });
});
