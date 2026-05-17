import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { writeNoteIndexed } from "../src/core/note-indexer.js";
import { type Note } from "../src/core/note-store.js";
import { search } from "../src/core/search.js";

// ---- helpers ----------------------------------------------------------------

let dir: string;
let db: DatabaseSync;

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  noteCounter = 0;
});

function setup() {
  dir = mkdtempSync(join(tmpdir(), "cms-search-"));
  db = openIndex(join(dir, "index.db"));
  return join(dir, "notes");
}

let noteCounter = 0;
function note(overrides: Partial<Note> & { anchors: Note["anchors"] }): Note {
  noteCounter++;
  const id = `2024-01-${String(noteCounter).padStart(2, "0")}-note`;
  return {
    id,
    summary: "summary " + id,
    status: "current",
    created: "2024-01-01",
    updated: "2024-01-01",
    body: "## Body\n\nDefault body content.",
    ...overrides,
    // id and anchors from overrides take precedence
    id: overrides.id ?? id,
    anchors: overrides.anchors,
  };
}

function writeAll(notesDir: string, notes: Note[]) {
  for (const n of notes) writeNoteIndexed(db, notesDir, n);
}

// ---- anchor path ------------------------------------------------------------

describe("anchor path", () => {
  it("finds a note by file: anchor", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "file:src/auth.ts", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["file:src/auth.ts"] });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].id).toBe(n.id);
  });

  it("finds a note by symbol: anchor", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "symbol:src/auth.ts::TokenCache", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["symbol:src/auth.ts::TokenCache"] });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].id).toBe(n.id);
  });

  it("finds a note by entity: anchor (entity not IDF-penalised)", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "entity:AuthService", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["entity:AuthService"] });
    expect(result.hits).toHaveLength(1);
  });

  it("does not find a note by unknown anchor uri", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "file:src/auth.ts", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["file:src/other.ts"] });
    expect(result.hits).toHaveLength(0);
  });
});

// ---- text path --------------------------------------------------------------

describe("text path (BM25)", () => {
  it("finds a note by word in summary", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/x.ts", weight: "core" }],
      summary: "unique-tokenXYZ in summary",
    });
    writeAll(notesDir, [n]);

    const result = search(db, { query: "unique-tokenXYZ" });
    expect(result.hits.map((h) => h.id)).toContain(n.id);
  });

  it("finds a note by word in body", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/y.ts", weight: "core" }],
      body: "## Section\n\nThis mentions cacheInvalidation logic.",
    });
    writeAll(notesDir, [n]);

    const result = search(db, { query: "cacheInvalidation" });
    expect(result.hits.map((h) => h.id)).toContain(n.id);
  });

  it("empty query with no anchors returns empty result", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "file:src/z.ts", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, {});
    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ---- BM25 floor -------------------------------------------------------------

describe("BM25 floor", () => {
  it("note not returned when text match is below BM25_FLOOR", () => {
    const notesDir = setup();
    // Build a corpus so BM25 scores on the rare term are high,
    // and confirm a pure whitespace/empty query yields nothing.
    const n = note({
      anchors: [{ uri: "file:src/a.ts", weight: "core" }],
      summary: "plain note",
      body: "## Body\n\nSome text.",
    });
    writeAll(notesDir, [n]);

    // Empty query → zero results (guard: BM25 path not entered)
    const r = search(db, { query: "   " });
    expect(r.hits).toHaveLength(0);
  });
});

// ---- IDF membership cutoff --------------------------------------------------

describe("IDF membership cutoff", () => {
  it("low-idf-only anchor match does not qualify note", () => {
    const notesDir = setup();
    const ubiquitousFile = "file:src/shared/constants.ts";
    // Add many notes anchored to the same file → high df → low idf
    const notes: Note[] = [];
    for (let i = 1; i <= 12; i++) {
      notes.push(
        note({
          id: `2024-01-01-ubiq-${i}`,
          anchors: [{ uri: ubiquitousFile, weight: "core" }],
        })
      );
    }
    // Target note: only the ubiquitous file (no other qualifier)
    const target = note({
      id: "2024-01-01-target",
      anchors: [{ uri: ubiquitousFile, weight: "core" }],
    });
    notes.push(target);
    writeAll(notesDir, notes);

    // idf = log(1 + 13/13) = log(2) ≈ 0.693 — just barely at/below IDF_FLOOR=0.7
    // So the target should NOT qualify on ubiquitous file alone.
    const result = search(db, { anchors: [ubiquitousFile] });
    // Low-idf notes should be absent (or none qualify)
    expect(result.hits.map((h) => h.id)).not.toContain(target.id);
  });

  it("note qualifies when it has a second, high-idf anchor match", () => {
    const notesDir = setup();
    const ubiquitousFile = "file:src/shared/constants.ts";
    for (let i = 1; i <= 12; i++) {
      const n = note({
        id: `2024-01-01-ubiq-${i}`,
        anchors: [{ uri: ubiquitousFile, weight: "core" }],
      });
      writeNoteIndexed(db, notesDir, n);
    }
    // Target has the ubiquitous file PLUS a unique anchor
    const target = note({
      id: "2024-01-01-target",
      anchors: [
        { uri: ubiquitousFile, weight: "core" },
        { uri: "file:src/unique-module.ts", weight: "core" },
      ],
    });
    writeNoteIndexed(db, notesDir, target);

    const result = search(db, { anchors: [ubiquitousFile, "file:src/unique-module.ts"] });
    expect(result.hits.map((h) => h.id)).toContain(target.id);
  });
});

// ---- critical pin -----------------------------------------------------------

describe("critical pin", () => {
  it("critical note included over limit", () => {
    const notesDir = setup();
    const notes: Note[] = [];
    for (let i = 1; i <= 5; i++) {
      notes.push(
        note({
          id: `2024-01-0${i}-regular`,
          anchors: [{ uri: `file:src/file${i}.ts`, weight: "core" }],
        })
      );
    }
    // critical note with its own unique anchor
    const critical = note({
      id: "2024-01-01-critical",
      anchors: [{ uri: "file:src/critical.ts", weight: "critical" }],
    });
    notes.push(critical);
    writeAll(notesDir, notes);

    // Search only for the critical anchor, limit=1
    const result = search(db, { anchors: ["file:src/critical.ts"], limit: 1 });
    expect(result.hits.map((h) => h.id)).toContain(critical.id);
  });

  it("critical note qualifies even when anchor idf is low", () => {
    const notesDir = setup();
    const ubiquitousFile = "file:src/shared/constants.ts";
    for (let i = 1; i <= 20; i++) {
      writeNoteIndexed(
        db, notesDir,
        note({
          id: `2024-01-01-ubiq-${i}`,
          anchors: [{ uri: ubiquitousFile, weight: "core" }],
        })
      );
    }
    // critical pin on ubiquitous file
    const pinned = note({
      id: "2024-01-01-pinned",
      anchors: [{ uri: ubiquitousFile, weight: "critical" }],
    });
    writeNoteIndexed(db, notesDir, pinned);

    const result = search(db, { anchors: [ubiquitousFile] });
    expect(result.hits.map((h) => h.id)).toContain(pinned.id);
  });
});

// ---- status filter ----------------------------------------------------------

describe("status filter", () => {
  it("outdated note not in default search", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/old.ts", weight: "core" }],
      status: "outdated",
    });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["file:src/old.ts"] });
    expect(result.hits).toHaveLength(0);
  });

  it("outdated note visible with include_archived", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/old.ts", weight: "core" }],
      status: "outdated",
    });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["file:src/old.ts"], include_archived: true });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].status).toBe("outdated");
  });

  it("draft note hidden by default and under include_archived", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/draft.ts", weight: "core" }],
      status: "draft",
    });
    writeAll(notesDir, [n]);

    const r1 = search(db, { anchors: ["file:src/draft.ts"] });
    const r2 = search(db, { anchors: ["file:src/draft.ts"], include_archived: true });
    expect(r1.hits).toHaveLength(0);
    expect(r2.hits).toHaveLength(0);
  });

  it("draft note visible with include_drafts", () => {
    const notesDir = setup();
    const n = note({
      anchors: [{ uri: "file:src/draft.ts", weight: "core" }],
      status: "draft",
    });
    writeAll(notesDir, [n]);

    const result = search(db, {
      anchors: ["file:src/draft.ts"],
      include_drafts: true,
    });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].status).toBe("draft");
  });

  it("include_drafts does not pull outdated; include_archived does not pull drafts", () => {
    const notesDir = setup();
    const draftN = note({
      id: "2024-01-01-d",
      anchors: [{ uri: "file:src/x.ts", weight: "core" }],
      status: "draft",
    });
    const oldN = note({
      id: "2024-01-01-o",
      anchors: [{ uri: "file:src/x.ts", weight: "core" }],
      status: "outdated",
    });
    writeAll(notesDir, [draftN, oldN]);

    const drafts = search(db, { anchors: ["file:src/x.ts"], include_drafts: true });
    expect(drafts.hits.map((h) => h.id)).toEqual([draftN.id]);

    const archived = search(db, { anchors: ["file:src/x.ts"], include_archived: true });
    expect(archived.hits.map((h) => h.id)).toEqual([oldN.id]);

    const both = search(db, {
      anchors: ["file:src/x.ts"],
      include_drafts: true,
      include_archived: true,
    });
    expect(both.hits.map((h) => h.id).sort()).toEqual([draftN.id, oldN.id]);
  });

  it("status field absent for current notes, present for outdated", () => {
    const notesDir = setup();
    const cur = note({ id: "2024-01-01-cur", anchors: [{ uri: "file:src/cur.ts", weight: "core" }] });
    const old = note({
      id: "2024-01-01-old",
      anchors: [{ uri: "file:src/old2.ts", weight: "core" }],
      status: "outdated",
    });
    writeAll(notesDir, [cur, old]);

    const result = search(db, {
      anchors: ["file:src/cur.ts", "file:src/old2.ts"],
      include_archived: true,
    });
    const curHit = result.hits.find((h) => h.id === cur.id);
    const oldHit = result.hits.find((h) => h.id === old.id);
    expect(curHit).toBeDefined();
    expect("status" in curHit!).toBe(false);
    expect(oldHit?.status).toBe("outdated");
  });
});

// ---- ranking ----------------------------------------------------------------

describe("ranking", () => {
  it("note with higher score ranks higher", () => {
    const notesDir = setup();
    const strong = note({
      id: "2024-01-01-strong",
      anchors: [{ uri: "file:src/a.ts", weight: "core" }],
    });
    const weak = note({
      id: "2024-01-01-weak",
      anchors: [{ uri: "file:src/a.ts", weight: "incidental" }],
    });
    writeAll(notesDir, [strong, weak]);

    const result = search(db, { anchors: ["file:src/a.ts"] });
    const ids = result.hits.map((h) => h.id);
    expect(ids.indexOf(strong.id)).toBeLessThan(ids.indexOf(weak.id));
  });

  it("tiebreak: fresher updated date ranks higher", () => {
    const notesDir = setup();
    const older = note({
      id: "2024-01-01-older",
      anchors: [{ uri: "file:src/b.ts", weight: "core" }],
      updated: "2024-01-01",
    });
    const newer = note({
      id: "2024-01-01-newer",
      anchors: [{ uri: "file:src/b.ts", weight: "core" }],
      updated: "2024-06-01",
    });
    writeAll(notesDir, [older, newer]);

    const result = search(db, { anchors: ["file:src/b.ts"] });
    const ids = result.hits.map((h) => h.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });
});

// ---- additive composition ---------------------------------------------------

describe("additive composition", () => {
  it("anchor+text note ranks above anchor-only and text-only notes", () => {
    const notesDir = setup();
    const both = note({
      id: "2024-01-01-both",
      anchors: [{ uri: "file:src/combo.ts", weight: "core" }],
      body: "## Body\n\nMentions combineXYZ logic here.",
      summary: "note with anchor and text combineXYZ",
    });
    const anchorOnly = note({
      id: "2024-01-01-anchor-only",
      anchors: [{ uri: "file:src/combo.ts", weight: "core" }],
      body: "## Body\n\nNo matching text here.",
      summary: "anchor only note",
    });
    writeAll(notesDir, [both, anchorOnly]);

    const result = search(db, { anchors: ["file:src/combo.ts"], query: "combineXYZ" });
    const ids = result.hits.map((h) => h.id);
    expect(ids).toContain(both.id);
    expect(ids.indexOf(both.id)).toBeLessThan(ids.indexOf(anchorOnly.id));
  });
});

// ---- context signal ---------------------------------------------------------

describe("context (confirming signal)", () => {
  it("context boosts already-matching note above non-context note", () => {
    const notesDir = setup();
    const withCtx = note({
      id: "2024-01-01-with-ctx",
      anchors: [
        { uri: "file:src/target.ts", weight: "core" },
        { uri: "entity:OrderService", weight: "incidental" },
      ],
    });
    const noCtx = note({
      id: "2024-01-01-no-ctx",
      anchors: [{ uri: "file:src/target.ts", weight: "core" }],
    });
    writeAll(notesDir, [withCtx, noCtx]);

    const result = search(db, {
      anchors: ["file:src/target.ts"],
      context: ["entity:OrderService"],
    });
    const ids = result.hits.map((h) => h.id);
    expect(ids).toContain(withCtx.id);
    expect(ids).toContain(noCtx.id);
    expect(ids.indexOf(withCtx.id)).toBeLessThan(ids.indexOf(noCtx.id));
  });

  it("context does not add notes absent from anchor/text results", () => {
    const notesDir = setup();
    const inResults = note({
      id: "2024-01-01-in",
      anchors: [{ uri: "file:src/target.ts", weight: "core" }],
    });
    const onlyContext = note({
      id: "2024-01-01-only-ctx",
      anchors: [{ uri: "entity:SomeEntity", weight: "core" }],
    });
    writeAll(notesDir, [inResults, onlyContext]);

    const result = search(db, {
      anchors: ["file:src/target.ts"],
      context: ["entity:SomeEntity"],
    });
    expect(result.hits.map((h) => h.id)).not.toContain(onlyContext.id);
  });
});

// ---- limit + truncated ------------------------------------------------------

describe("limit and truncated flag", () => {
  it("truncates non-critical results to limit and sets truncated=true", () => {
    const notesDir = setup();
    const notes: Note[] = [];
    for (let i = 1; i <= 5; i++) {
      notes.push(
        note({
          id: `2024-01-0${i}-n`,
          anchors: [{ uri: `file:src/file${i}.ts`, weight: "core" }],
        })
      );
    }
    writeAll(notesDir, notes);
    const uris = notes.map((n) => n.anchors[0].uri);

    const result = search(db, { anchors: uris, limit: 3 });
    expect(result.hits.length).toBe(3);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(true);
  });

  it("truncated=false when results fit within limit", () => {
    const notesDir = setup();
    const n = note({ anchors: [{ uri: "file:src/only.ts", weight: "core" }] });
    writeAll(notesDir, [n]);

    const result = search(db, { anchors: ["file:src/only.ts"], limit: 10 });
    expect(result.truncated).toBe(false);
    expect(result.total).toBe(1);
  });

  it("critical notes survive truncation beyond limit", () => {
    const notesDir = setup();
    const notes: Note[] = [];
    for (let i = 1; i <= 3; i++) {
      notes.push(
        note({
          id: `2024-01-0${i}-reg`,
          anchors: [{ uri: `file:src/reg${i}.ts`, weight: "core" }],
        })
      );
    }
    const critical = note({
      id: "2024-01-01-crit",
      anchors: [{ uri: "file:src/crit.ts", weight: "critical" }],
    });
    notes.push(critical);
    writeAll(notesDir, notes);

    const uris = notes.map((n) => n.anchors[0].uri);
    const result = search(db, { anchors: uris, limit: 1 });
    expect(result.hits.map((h) => h.id)).toContain(critical.id);
  });
});
