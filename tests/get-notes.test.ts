import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { writeNoteIndexed } from "../src/core/note-indexer.js";
import type { Note } from "../src/core/note-store.js";
import { verifyAnchors } from "../src/core/verifier.js";
import { getNotes } from "../src/core/get-notes.js";

let dir: string;
let db: DatabaseSync;

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function setup() {
  dir = mkdtempSync(join(tmpdir(), "cms-getnotes-"));
  db = openIndex(join(dir, "index.db"));
  return { notesDir: join(dir, "notes"), projectRoot: dir };
}

function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    summary: "summary for " + overrides.id,
    status: "current",
    created: "2024-01-01",
    updated: "2024-01-01",
    body: "## Body\n\nContent.",
    anchors: [{ uri: "entity:Test", weight: "core" }],
    ...overrides,
  };
}

// 1. Anchor map grouping by weight
describe("anchor map grouping", () => {
  it("groups file/symbol anchors by weight in WEIGHT_ORDER", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-a",
        anchors: [
          { uri: "file:incidental.ts", weight: "incidental" },
          { uri: "file:supporting.ts", weight: "supporting" },
          { uri: "file:core.ts", weight: "core" },
          { uri: "file:critical.ts", weight: "critical" },
        ],
      })
    );

    const { notes } = getNotes(db, ["note-a"]);
    const map = notes[0].anchorMap;

    expect(map.map((g) => g.weight)).toEqual([
      "critical",
      "core",
      "supporting",
      "incidental",
    ]);
    expect(map[0].anchors[0].uri).toBe("file:critical.ts");
    expect(map[1].anchors[0].uri).toBe("file:core.ts");
  });

  it("omits empty weight groups", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-b",
        anchors: [{ uri: "file:only.ts", weight: "core" }],
      })
    );

    const { notes } = getNotes(db, ["note-b"]);
    expect(notes[0].anchorMap.map((g) => g.weight)).toEqual(["core"]);
  });
});

// 2. Stale status in anchor map
describe("anchor map stale status", () => {
  it("reflects ok/stale from verifyAnchors", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, "exists.ts"), "");
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-c",
        anchors: [
          { uri: "file:exists.ts", weight: "core" },
          { uri: "file:gone.ts", weight: "supporting" },
        ],
      })
    );
    verifyAnchors(db, projectRoot);

    const { notes } = getNotes(db, ["note-c"]);
    const flat = notes[0].anchorMap.flatMap((g) => g.anchors);
    expect(flat.find((a) => a.uri === "file:exists.ts")?.status).toBe("ok");
    expect(flat.find((a) => a.uri === "file:gone.ts")?.status).toBe("stale");
  });

  it("reports unknown before verifyAnchors runs", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-d",
        anchors: [{ uri: "file:unverified.ts", weight: "core" }],
      })
    );

    const { notes } = getNotes(db, ["note-d"]);
    expect(notes[0].anchorMap[0].anchors[0].status).toBe("unknown");
  });
});

// 3. anchor map includes all anchor types (entity/env visible too)
describe("anchor map includes all anchor types", () => {
  it("includes file, symbol, entity, and env anchors grouped by weight", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-e",
        anchors: [
          { uri: "file:app.ts", weight: "core" },
          { uri: "entity:MyService", weight: "core" },
          { uri: "env:DATABASE_URL", weight: "supporting" },
        ],
      })
    );

    const { notes } = getNotes(db, ["note-e"]);
    const flat = notes[0].anchorMap.flatMap((g) => g.anchors);
    expect(flat.map((a) => a.uri).sort()).toEqual([
      "entity:MyService",
      "env:DATABASE_URL",
      "file:app.ts",
    ]);
    // entity/env appear under their weight group
    const core = notes[0].anchorMap.find((g) => g.weight === "core");
    expect(core?.anchors.map((a) => a.uri).sort()).toEqual([
      "entity:MyService",
      "file:app.ts",
    ]);
  });
});

// 4. [[id]] block — current mentioned note
describe("mentioned notes block", () => {
  it("resolves [[id]] to summary for current notes", () => {
    const { notesDir } = setup();
    writeNoteIndexed(db, notesDir, makeNote({ id: "note-b", summary: "Note B summary" }));
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({ id: "note-a", body: "See [[note-b]] for details." })
    );

    const { notes } = getNotes(db, ["note-a"]);
    expect(notes[0].mentioned).toHaveLength(1);
    expect(notes[0].mentioned[0]).toEqual({
      id: "note-b",
      summary: "Note B summary",
      stale: false,
    });
    expect(notes[0].mentioned[0].status).toBeUndefined();
  });

  // 5. [[id]] on non-current note
  it("includes status when mentioned note is not current", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({ id: "old-note", status: "outdated", summary: "Old summary" })
    );
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({ id: "current-note", body: "Refers to [[old-note]]." })
    );

    const { notes } = getNotes(db, ["current-note"]);
    expect(notes[0].mentioned[0].status).toBe("outdated");
    expect(notes[0].mentioned[0].stale).toBe(false);
  });

  // 6. Stale [[id]]
  it("marks stale when [[id]] references non-existent note", () => {
    const { notesDir } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({ id: "note-f", body: "See [[ghost-note]] for more." })
    );

    const { notes } = getNotes(db, ["note-f"]);
    expect(notes[0].mentioned).toHaveLength(1);
    const m = notes[0].mentioned[0];
    expect(m.id).toBe("ghost-note");
    expect(m.stale).toBe(true);
    expect(m.summary).toBeUndefined();
  });

  // 7. Dedup [[id]]
  it("deduplicates repeated [[id]] references", () => {
    const { notesDir } = setup();
    writeNoteIndexed(db, notesDir, makeNote({ id: "ref-note" }));
    writeNoteIndexed(
      db,
      notesDir,
      makeNote({
        id: "note-g",
        body: "First [[ref-note]], then [[ref-note]] again.",
      })
    );

    const { notes } = getNotes(db, ["note-g"]);
    expect(notes[0].mentioned).toHaveLength(1);
    expect(notes[0].mentioned[0].id).toBe("ref-note");
  });
});

// 8. Missing requested id
describe("missing ids", () => {
  it("reports missing ids separately", () => {
    const { notesDir } = setup();
    writeNoteIndexed(db, notesDir, makeNote({ id: "real-note" }));

    const result = getNotes(db, ["real-note", "ghost-id"]);
    expect(result.notes.map((n) => n.id)).toEqual(["real-note"]);
    expect(result.missing).toEqual(["ghost-id"]);
  });

  it("returns empty notes and all ids in missing when none found", () => {
    setup();
    const result = getNotes(db, ["x", "y"]);
    expect(result.notes).toHaveLength(0);
    expect(result.missing).toEqual(["x", "y"]);
  });
});

// 9. Input dedup and order
describe("input deduplication and ordering", () => {
  it("deduplicates input ids, returns in first-appearance order", () => {
    const { notesDir } = setup();
    writeNoteIndexed(db, notesDir, makeNote({ id: "id-a", summary: "A" }));
    writeNoteIndexed(db, notesDir, makeNote({ id: "id-b", summary: "B" }));

    const result = getNotes(db, ["id-a", "id-b", "id-a"]);
    expect(result.notes.map((n) => n.id)).toEqual(["id-a", "id-b"]);
    expect(result.missing).toHaveLength(0);
  });
});
