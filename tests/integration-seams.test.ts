import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { reconcileEntities } from "../src/core/entity-indexer.js";
import { reconcileNotes, writeNoteIndexed } from "../src/core/note-indexer.js";
import { reconcileStructure } from "../src/core/structural-indexer.js";
import { verifyAnchors } from "../src/core/verifier.js";
import { search } from "../src/core/search.js";
import { getNotes } from "../src/core/get-notes.js";
import { createNote } from "../src/core/note-write.js";
import { NoteParseError, type Note } from "../src/core/note-store.js";
import { copyFixtureProject } from "./helpers/fixture-project.js";

// ── Seams covered by existing real-flow tests (no new tests needed) ──────────
//
// Шов indexer↔verifier — contract-anchors.test.ts (cmt-02): beforeAll runs
// real reconcileStructure→verifyAnchors; regression block proves dotted
// Class.method via parent column.
//
// Шов CLI-парсер↔core — cli.test.ts: buildProgram().parseAsync including
// anchor-only search (regression for search-bug). Deepened in cmt-04.
//
// createNote with server-generated ids — core-write.test.ts: repeated
// capture of identical content yields distinct notes (no replay no-op).
// Distinct-ids flow over a real withLock+writeNoteIndexed chain tested below.
//
// Inter-process lock contention — core-write.test.ts:320: LockTimeoutError
// against live pid 1. In-process serialisation tested below (Test 6).

// ── Test 1: flow createNote → search → getNotes ───────────────────────────────

describe("flow: createNote → search → getNotes", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("created note is findable by text and anchor; getNotes returns full view", async () => {
    dir = copyFixtureProject();
    const memoryDir = join(dir, ".memory");
    const notesDir = join(memoryDir, "notes");
    db = openIndex(join(memoryDir, "index.db"));

    reconcileEntities(db, memoryDir);
    reconcileNotes(db, notesDir);
    await reconcileStructure(db, dir);

    const anchors = [
      { uri: "file:src/order.ts", weight: "core" as const },
      { uri: "symbol:src/order.ts::Order.cancel", weight: "critical" as const },
    ];
    const body = "## Details\n\nSeam flow integration test note.\n\n[[2026-05-08-float-pricing]]";

    const note = createNote(db, memoryDir, "Seam flow note", body, anchors, "current", "2026-05-16");
    expect(note.id).toMatch(/^[a-z0-9]{5}$/);

    verifyAnchors(db, dir);

    // Text search finds the new note
    const byText = search(db, { query: "seam flow" });
    expect(byText.hits.some((h) => h.id === note.id)).toBe(true);

    // Anchor-only search finds the new note (critical pin guarantees inclusion)
    const byAnchor = search(db, { anchors: ["file:src/order.ts"] });
    expect(byAnchor.hits.some((h) => h.id === note.id)).toBe(true);

    // getNotes expands it with anchor map and [[id]] mentions
    const { notes, missing } = getNotes(db, [note.id]);
    expect(missing).toHaveLength(0);
    expect(notes).toHaveLength(1);

    const expanded = notes[0];
    expect(expanded.body).not.toBe("");

    // Anchor map: critical group (symbol) and core group (file), both ok
    const criticalGroup = expanded.anchorMap.find((g) => g.weight === "critical");
    expect(criticalGroup).toBeDefined();
    const criticalEntry = criticalGroup!.anchors.find(
      (a) => a.uri === "symbol:src/order.ts::Order.cancel"
    );
    expect(criticalEntry?.status).toBe("ok");

    const coreGroup = expanded.anchorMap.find((g) => g.weight === "core");
    expect(coreGroup).toBeDefined();
    const coreEntry = coreGroup!.anchors.find((a) => a.uri === "file:src/order.ts");
    expect(coreEntry?.status).toBe("ok");

    // [[id]] mention resolves to the fixture note (present in index via reconcileNotes)
    const mention = expanded.mentioned.find((m) => m.id === "2026-05-08-float-pricing");
    expect(mention).toBeDefined();
    expect(mention!.stale).toBe(false);
    expect(mention!.summary).toBeTruthy();
  });
});

// ── Test 2: identical content → distinct ids, separate notes ─────────────────

describe("repeated capture of identical content yields distinct notes", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("two createNote calls with the same summary+body get distinct ids and two files", () => {
    dir = copyFixtureProject();
    const memoryDir = join(dir, ".memory");
    db = openIndex(join(memoryDir, "index.db"));

    const anchors = [{ uri: "file:src/order.ts", weight: "core" as const }];
    const body = "## Body\n\nContent.";

    const n1 = createNote(db, memoryDir, "Cache fix", body, anchors, "current", "2026-05-16");
    const n2 = createNote(db, memoryDir, "Cache fix", body, anchors, "current", "2026-05-16");

    // Server-generated ids — no replay no-op, the second is a separate note
    expect(n1.id).toMatch(/^[a-z0-9]{5}$/);
    expect(n2.id).toMatch(/^[a-z0-9]{5}$/);
    expect(n2.id).not.toBe(n1.id);

    // Both rows in index, both files on disk
    expect((db.prepare("SELECT COUNT(*) AS n FROM notes WHERE summary = ?").get("Cache fix") as { n: number }).n).toBe(2);
    expect(existsSync(join(memoryDir, "notes", n1.id + ".md"))).toBe(true);
    expect(existsSync(join(memoryDir, "notes", n2.id + ".md"))).toBe(true);
  });
});

// ── Test 3: atomicity — writeNoteIndexed failure rolls back both .md and index ─

describe("atomicity: writeNoteIndexed failure → rollback, no index/file desync", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("if renameSync throws, ROLLBACK leaves index empty for that note", () => {
    dir = copyFixtureProject();
    const notesDir = join(dir, ".memory", "notes");
    db = openIndex(join(dir, ".memory", "index.db"));

    // Force renameSync to fail: create a directory at the target path
    mkdirSync(join(notesDir, "2026-05-16-x.md"));

    const note: Note = {
      id: "2026-05-16-x",
      summary: "Atomicity test",
      status: "current",
      created: "2026-05-16",
      updated: "2026-05-16",
      anchors: [{ uri: "file:src/order.ts", weight: "core" }],
      body: "## Body\n\nTest.",
    };

    // renameSync onto a directory → EISDIR → ROLLBACK (note-indexer.ts:42-50)
    expect(() => writeNoteIndexed(db, notesDir, note)).toThrow();

    // No desync: notes table and anchors must have no rows for this id
    const noteRow = db.prepare("SELECT 1 FROM notes WHERE id = ?").get("2026-05-16-x");
    expect(noteRow).toBeUndefined();

    const anchorRows = db.prepare("SELECT 1 FROM anchors WHERE note_id = ?").all("2026-05-16-x");
    expect(anchorRows).toHaveLength(0);

    const ftsRows = db.prepare("SELECT 1 FROM notes_fts WHERE id = ?").all("2026-05-16-x");
    expect(ftsRows).toHaveLength(0);
  });
});

// ── Test 4: reconcileNotes fail-loud — broken .md aborts the whole transaction ─

describe("reconcileNotes fail-loud: broken .md rolls back entire transaction", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("NoteParseError aborts reconcile — new good note not partially committed", () => {
    dir = copyFixtureProject();
    const memoryDir = join(dir, ".memory");
    const notesDir = join(memoryDir, "notes");
    db = openIndex(join(memoryDir, "index.db"));

    // Bootstrap: index the 9 existing fixture notes
    reconcileNotes(db, notesDir);
    const countBefore = (db.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
    expect(countBefore).toBe(9);

    // Add a valid new note
    writeFileSync(
      join(notesDir, "2026-05-16-good.md"),
      `---
id: 2026-05-16-good
summary: Good note
status: current
created: 2026-05-16
updated: 2026-05-16
anchors:
  - uri: file:src/order.ts
    weight: core
---

## Body

Good note body.
`,
    );

    // Add a broken note (missing required field "summary")
    writeFileSync(
      join(notesDir, "2026-05-16-broken.md"),
      `---
id: 2026-05-16-broken
status: current
created: 2026-05-16
updated: 2026-05-16
anchors:
  - uri: file:src/order.ts
    weight: core
---

## Body

Broken note — missing summary field.
`,
    );

    // reconcileNotes must throw NoteParseError and roll back the transaction
    expect(() => reconcileNotes(db, notesDir)).toThrow(NoteParseError);

    // The good note must NOT be in the index — whole transaction rolled back
    const goodRow = db.prepare("SELECT 1 FROM notes WHERE id = ?").get("2026-05-16-good");
    expect(goodRow).toBeUndefined();

    // The pre-existing 9 notes remain unaffected
    const countAfter = (db.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
    expect(countAfter).toBe(9);
  });
});

// ── Test 5: IDF — entity: anchors escape the ubiquity cutoff ──────────────────
//
// specs/02 and specs/03: entity:/env: are not IDF-penalised. The anchor_idf
// VIEW (index-layer.ts:58) filters only file/symbol. search.ts:87 gives
// entity/env NEUTRAL_IDF and qualified=true unconditionally. This test proves
// that entity: notes qualify even when the anchor is "ubiquitous" (≥70% of a
// ≥5-note corpus) — a condition that would suppress file:/symbol: notes.

describe("IDF: entity: anchor escapes ubiquity cutoff", () => {
  let dir: string;
  let db: DatabaseSync;
  let notesDir: string;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("entity:Common on 5/6 notes (83% ≥ 70%) — all 5 qualify, none suppressed", () => {
    dir = mkdtempSync(join(tmpdir(), "cms-idf-"));
    notesDir = join(dir, "notes");
    db = openIndex(join(dir, "index.db"));

    // 5 notes with entity:Common — a "ubiquitous" entity anchor (83% corpus share)
    for (let i = 1; i <= 5; i++) {
      const id = `2026-01-0${i}-n`;
      const note: Note = {
        id,
        summary: `Note ${i}`,
        status: "current",
        created: "2026-01-01",
        updated: "2026-01-01",
        anchors: [
          { uri: "entity:Common", weight: "core" },
          { uri: `file:src/module-${i}.ts`, weight: "supporting" },
        ],
        body: `## Body ${i}`,
      };
      writeNoteIndexed(db, notesDir, note);
    }
    // 6th note without entity:Common — makes total corpus = 6 ≥ MIN_CORPUS_FOR_IDF
    writeNoteIndexed(db, notesDir, {
      id: "2026-01-06-n",
      summary: "Note 6",
      status: "current",
      created: "2026-01-01",
      updated: "2026-01-01",
      anchors: [{ uri: "file:src/module-6.ts", weight: "core" }],
      body: "## Body 6",
    });

    // entity:Common share: 5/6 ≈ 83% — exceeds UBIQUITY_RATIO of 70%.
    // For file:/symbol: this would suppress the anchor; entity: must NOT be suppressed.
    const result = search(db, { anchors: ["entity:Common"] });
    expect(result.total).toBe(5);
    for (let i = 1; i <= 5; i++) {
      expect(result.hits.some((h) => h.id === `2026-01-0${i}-n`)).toBe(true);
    }
  });
});

// ── Test 6: in-process lock serialisation ─────────────────────────────────────
//
// Inter-process contention is covered by core-write.test.ts:320 (pid-1 test).
// This test verifies that withLock releases cleanly between sequential operations
// so that a second createNote on the same memoryDir re-acquires the lock and
// succeeds — proving no lock-file leak.

describe("in-process lock serialisation: sequential createNote calls", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("two sequential createNote on same memoryDir both persist; lock file absent after", () => {
    dir = copyFixtureProject();
    const memoryDir = join(dir, ".memory");
    db = openIndex(join(memoryDir, "index.db"));

    const anchors = [{ uri: "file:src/order.ts", weight: "core" as const }];
    const body = "## Body\n\nContent.";

    const n1 = createNote(db, memoryDir, "Lock alpha", body, anchors, "current", "2026-05-16");
    const n2 = createNote(db, memoryDir, "Lock beta", body, anchors, "current", "2026-05-16");

    expect(n1.id).toMatch(/^[a-z0-9]{5}$/);
    expect(n2.id).toMatch(/^[a-z0-9]{5}$/);
    expect(n2.id).not.toBe(n1.id);

    // Both .md files on disk
    expect(existsSync(join(memoryDir, "notes", n1.id + ".md"))).toBe(true);
    expect(existsSync(join(memoryDir, "notes", n2.id + ".md"))).toBe(true);

    // Both rows in index
    const rows = db.prepare("SELECT id FROM notes WHERE id IN (?,?)").all(n1.id, n2.id);
    expect(rows).toHaveLength(2);

    // Lock file absent — lock.ts:79-81 removes it in the finally block
    expect(existsSync(join(memoryDir, "lock"))).toBe(false);
  });
});
