import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { createEntity } from "../src/core/entity-indexer.js";
import { LockTimeoutError, withLock } from "../src/core/lock.js";
import {
  InvalidSummaryError,
  UnregisteredEntityError,
  anchorCoverageWarning,
  createNote,
  deleteNote,
  renameAnchor,
  updateNote,
} from "../src/core/note-write.js";
import { NOTE_ID_RE, readNote } from "../src/core/note-store.js";

const BODY = "## What was done\n\nFixed token caching.";
const ANCHORS = [{ uri: "file:src/auth.ts", weight: "core" as const }];

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

  it("creates .md file with a server-generated hash id", () => {
    const { memoryDir, notesDir } = setup();
    const note = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(note.id).toMatch(NOTE_ID_RE);
    expect(existsSync(join(notesDir, note.id + ".md"))).toBe(true);
  });

  it("indexes note and anchors in SQLite", () => {
    const { memoryDir } = setup();
    const note = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(countRows("notes")).toBe(1);
    expect(countRows("anchors")).toBe(1);
    const row = db.prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH ?").get("caching") as
      | { id: string }
      | undefined;
    expect(row?.id).toBe(note.id);
  });

  it("repeated capture of same content creates distinct notes (no replay no-op)", () => {
    const { memoryDir } = setup();
    const n1 = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    const n2 = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    expect(n2.id).not.toBe(n1.id);
    expect(countRows("notes")).toBe(2);
    expect(countRows("anchors")).toBe(2);
  });

  it("rejects entity: anchor for unregistered entity", () => {
    const { memoryDir } = setup();
    const anchors = [{ uri: "entity:Foo", weight: "core" as const }];
    expect(() =>
      createNote(db, memoryDir, "Auth fix", BODY, anchors, "current", "2024-01-01"),
    ).toThrow(UnregisteredEntityError);
    expect(countRows("notes")).toBe(0);
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
    const note = createNote(db, memoryDir, "Auth fix", BODY, ANCHORS, "current", "2024-01-01");
    return { memoryDir, id: note.id };
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

  it("updates summary and persists it, preserving body", () => {
    const { memoryDir, id } = setup();
    const updated = updateNote(db, memoryDir, id, { summary: "Auth fix — video-first model" }, "2024-02-01");
    expect(updated.summary).toBe("Auth fix — video-first model");
    expect(updated.body).toBe(BODY);
    const onDisk = readNote(join(memoryDir, "notes"), id);
    expect(onDisk.summary).toBe("Auth fix — video-first model");
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

describe("summary validation", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    dir = mkdtempSync(join(tmpdir(), "cms-sv-"));
    db = openIndex(join(dir, "index.db"));
    return { memoryDir: dir, notesDir: join(dir, "notes") };
  }

  function countRows(table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }

  // Angle brackets and YAML flow/block indicators in a summary are the
  // documented corruption vector: < > open block scalars and carry the
  // tool-call </parameter> leak. The summary must be plain prose text.
  const FORBIDDEN: Array<[string, string]> = [
    ["angle open", "Fix <system> handling"],
    ["angle close", "Done body> wiring"],
    ["tool-call leak", 'Fix </parameter> <parameter name="body">'],
    ["curly open", "Map of {a merged"],
    ["curly close", "Map of a} merged"],
    ["square open", "List [item one"],
    ["square close", "List item] one"],
    ["pipe", "either | or"],
    ["backtick", "use `inline` code"],
  ];

  it.each(FORBIDDEN)("createNote rejects summary with %s", (_label, summary) => {
    const { memoryDir } = setup();
    expect(() => createNote(db, memoryDir, summary, BODY, ANCHORS, "current", "2024-01-01")).toThrow(
      InvalidSummaryError,
    );
  });

  it("createNote writes nothing on a rejected summary", () => {
    const { memoryDir, notesDir } = setup();
    expect(() =>
      createNote(db, memoryDir, "bad <system>", BODY, ANCHORS, "current", "2024-01-01"),
    ).toThrow(InvalidSummaryError);
    expect(existsSync(notesDir)).toBe(false);
    expect(countRows("notes")).toBe(0);
  });

  const ALLOWED: Array<[string, string]> = [
    ["colon + parens", "Refactor: split parser (phase 1/2)"],
    ["quotes + dash", `Fixed "token" cache — race resolved`],
    ["punctuation", "Done! Why? Maybe; later, etc."],
    ["unicode", "Кэш токенов — починили race ⚡"],
    ["slash + amp", "I/O retries & backoff @ startup"],
  ];

  it.each(ALLOWED)("createNote accepts plain-text summary: %s", (_label, summary) => {
    const { memoryDir } = setup();
    const note = createNote(db, memoryDir, summary, BODY, ANCHORS, "current", "2024-01-01");
    expect(readNote(join(memoryDir, "notes"), note.id).summary).toBe(summary);
  });

  it("updateNote rejects a summary with forbidden chars and leaves the note untouched", () => {
    const { memoryDir } = setup();
    const note = createNote(db, memoryDir, "Original", BODY, ANCHORS, "current", "2024-01-01");
    expect(() =>
      updateNote(db, memoryDir, note.id, { summary: "broken <system>" }, "2024-02-01"),
    ).toThrow(InvalidSummaryError);
    expect(readNote(join(memoryDir, "notes"), note.id).summary).toBe("Original");
  });

  it("updateNote allows a clean summary edit", () => {
    const { memoryDir } = setup();
    const note = createNote(db, memoryDir, "Original", BODY, ANCHORS, "current", "2024-01-01");
    const updated = updateNote(db, memoryDir, note.id, { summary: "Reworked: phase 2" }, "2024-02-01");
    expect(updated.summary).toBe("Reworked: phase 2");
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
    const a = createNote(db, memoryDir, "Note A", BODY, [{ uri: "file:old.ts", weight: "core" as const }], "current", "2024-01-01").id;
    const b = createNote(db, memoryDir, "Note B", BODY, [{ uri: "file:old.ts", weight: "supporting" as const }, { uri: "file:other.ts", weight: "core" as const }], "current", "2024-01-02").id;
    const c = createNote(db, memoryDir, "Note C", BODY, [{ uri: "file:other.ts", weight: "core" as const }], "current", "2024-01-03").id;
    return { memoryDir, a, b, c };
  }

  it("returns count of affected notes", () => {
    const { memoryDir } = setup();
    const count = renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    expect(count).toBe(2);
  });

  it("updates URI in .md files and in anchors table", () => {
    const { memoryDir, a: idA, b: idB } = setup();
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");

    const notesDir = join(memoryDir, "notes");
    const a = readNote(notesDir, idA);
    expect(a.anchors[0].uri).toBe("file:renamed.ts");

    const b = readNote(notesDir, idB);
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
    const { memoryDir, c: idC } = setup();
    const notesDir = join(memoryDir, "notes");
    const before = readNote(notesDir, idC);
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    const after = readNote(notesDir, idC);
    expect(after.anchors).toEqual(before.anchors);
  });

  it("returns 0 when oldUri not found", () => {
    const { memoryDir } = setup();
    expect(renameAnchor(db, memoryDir, "file:nonexistent.ts", "file:x.ts")).toBe(0);
  });

  it("does not bump updated on renamed notes", () => {
    const { memoryDir, a: idA } = setup();
    const notesDir = join(memoryDir, "notes");
    const before = readNote(notesDir, idA);
    renameAnchor(db, memoryDir, "file:old.ts", "file:renamed.ts");
    const after = readNote(notesDir, idA);
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

describe("anchorCoverageWarning", () => {
  const c = (uri: string) => ({ uri, weight: "core" as const });

  it("returns null when both axes are present", () => {
    expect(
      anchorCoverageWarning([c("entity:Order"), c("file:src/order.ts")]),
    ).toBeNull();
    expect(
      anchorCoverageWarning([c("entity:Order"), c("symbol:src/order.ts::Order")]),
    ).toBeNull();
  });

  it("warns when the conceptual axis is missing", () => {
    expect(anchorCoverageWarning([c("file:src/order.ts")])).toMatch(/entity:/);
  });

  it("warns when the implementation axis is missing", () => {
    expect(anchorCoverageWarning([c("entity:Order")])).toMatch(/file:\/symbol:/);
  });

  it("warns when only env: anchors are present (neither axis)", () => {
    expect(anchorCoverageWarning([c("env:STRIPE_KEY")])).toMatch(/neither axis/);
  });
});
