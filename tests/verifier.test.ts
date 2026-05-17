import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { writeNoteIndexed } from "../src/core/note-indexer.js";
import type { Note } from "../src/core/note-store.js";
import { verifyAnchors } from "../src/core/verifier.js";

let dir: string;
let db: DatabaseSync;

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
  counter = 0;
});

function setup() {
  dir = mkdtempSync(join(tmpdir(), "cms-verifier-"));
  db = openIndex(join(dir, "index.db"));
  return { notesDir: join(dir, "notes"), projectRoot: dir };
}

let counter = 0;
function note(anchors: Note["anchors"]): Note {
  counter++;
  const id = `2024-01-${String(counter).padStart(2, "0")}-note`;
  return {
    id,
    summary: "summary " + id,
    status: "current",
    created: "2024-01-01",
    updated: "2024-01-01",
    body: "## Body\n\nBody.",
    anchors,
  };
}

function anchorStatus(uri: string): string | undefined {
  const row = db
    .prepare("SELECT anchor_status FROM anchors WHERE uri = ? LIMIT 1")
    .get(uri) as { anchor_status: string } | undefined;
  return row?.anchor_status;
}

function allAnchorStatuses(uri: string): string[] {
  return (
    db.prepare("SELECT anchor_status FROM anchors WHERE uri = ?").all(uri) as {
      anchor_status: string;
    }[]
  ).map((r) => r.anchor_status);
}

// ---- file: ------------------------------------------------------------------

describe("file: anchor", () => {
  it("resolves ok when file exists", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, "foo.ts"), "");
    writeNoteIndexed(db, notesDir, note([{ uri: "file:foo.ts", weight: "core" }]));

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("file:foo.ts")).toBe("ok");
  });

  it("marks stale when file is missing", () => {
    const { notesDir, projectRoot } = setup();
    writeNoteIndexed(db, notesDir, note([{ uri: "file:missing.ts", weight: "core" }]));

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("file:missing.ts")).toBe("stale");
  });
});

// ---- symbol: ----------------------------------------------------------------

describe("symbol: anchor", () => {
  it("resolves ok when symbol exists in index", () => {
    const { notesDir, projectRoot } = setup();
    db.prepare(
      "INSERT INTO symbol_index (file, name, kind, start_line, end_line) VALUES (?,?,?,?,?)"
    ).run("src/foo.ts", "myFunc", "function", 1, 5);
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "symbol:src/foo.ts::myFunc", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("symbol:src/foo.ts::myFunc")).toBe("ok");
  });

  it("marks stale when symbol is absent", () => {
    const { notesDir, projectRoot } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "symbol:src/foo.ts::missing", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("symbol:src/foo.ts::missing")).toBe("stale");
  });

  it("resolves dotted Parent.Member form against parent + name columns", () => {
    const { notesDir, projectRoot } = setup();
    db.prepare(
      "INSERT INTO symbol_index (file, name, kind, parent, start_line, end_line) VALUES (?,?,?,?,?,?)"
    ).run("src/wizard.ts", "validateStep", "method", "StepValidator", 10, 20);
    writeNoteIndexed(
      db,
      notesDir,
      note([
        { uri: "symbol:src/wizard.ts::StepValidator.validateStep", weight: "core" },
      ])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("symbol:src/wizard.ts::StepValidator.validateStep")).toBe(
      "ok"
    );
  });

  it("marks dotted form stale when method exists under a different parent", () => {
    const { notesDir, projectRoot } = setup();
    db.prepare(
      "INSERT INTO symbol_index (file, name, kind, parent, start_line, end_line) VALUES (?,?,?,?,?,?)"
    ).run("src/wizard.ts", "validateStep", "method", "OtherClass", 10, 20);
    writeNoteIndexed(
      db,
      notesDir,
      note([
        { uri: "symbol:src/wizard.ts::StepValidator.validateStep", weight: "core" },
      ])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("symbol:src/wizard.ts::StepValidator.validateStep")).toBe(
      "stale"
    );
  });

  it("marks stale when uri has no :: separator", () => {
    const { notesDir, projectRoot } = setup();
    // anchorType() only checks the type prefix; symbol:badpath is valid type-wise
    // but parseSymbolUri returns null
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "symbol:nodoublecolon", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("symbol:nodoublecolon")).toBe("stale");
  });
});

// ---- entity: ----------------------------------------------------------------

describe("entity: anchor", () => {
  it("resolves ok when entity exists", () => {
    const { notesDir, projectRoot } = setup();
    db.prepare("INSERT INTO entities (name, description) VALUES (?,?)").run(
      "MyService",
      "A service."
    );
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "entity:MyService", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("entity:MyService")).toBe("ok");
  });

  it("marks stale when entity is absent", () => {
    const { notesDir, projectRoot } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "entity:Ghost", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("entity:Ghost")).toBe("stale");
  });
});

// ---- env: -------------------------------------------------------------------

describe("env: anchor", () => {
  it("resolves ok when var present in .env", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, ".env"), "DATABASE_URL=postgres://localhost\n");
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "env:DATABASE_URL", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("env:DATABASE_URL")).toBe("ok");
  });

  it("marks stale when var absent from .env", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, ".env"), "OTHER_VAR=x\n");
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "env:MISSING_VAR", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("env:MISSING_VAR")).toBe("stale");
  });

  it("resolves ok when var present only in .env.example", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, ".env"), "OTHER_VAR=x\n");
    writeFileSync(join(projectRoot, ".env.example"), "LLM_EMBEDDING_DIMENSION=\n");
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "env:LLM_EMBEDDING_DIMENSION", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("env:LLM_EMBEDDING_DIMENSION")).toBe("ok");
  });

  it("marks stale when .env does not exist", () => {
    const { notesDir, projectRoot } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "env:SOME_VAR", weight: "core" }])
    );

    verifyAnchors(db, projectRoot);

    expect(anchorStatus("env:SOME_VAR")).toBe("stale");
  });
});

// ---- incremental ------------------------------------------------------------

describe("incremental verify", () => {
  it("updates only specified uris, leaves others unknown", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, "real.ts"), "");
    writeNoteIndexed(
      db,
      notesDir,
      note([
        { uri: "file:real.ts", weight: "core" },
        { uri: "file:other.ts", weight: "supporting" },
      ])
    );

    verifyAnchors(db, projectRoot, { uris: ["file:real.ts"] });

    expect(anchorStatus("file:real.ts")).toBe("ok");
    expect(anchorStatus("file:other.ts")).toBe("unknown"); // untouched
  });
});

// ---- shared uri across notes ------------------------------------------------

describe("shared uri", () => {
  it("updates all anchor rows sharing the same uri", () => {
    const { notesDir, projectRoot } = setup();
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "entity:Shared", weight: "core" }])
    );
    writeNoteIndexed(
      db,
      notesDir,
      note([{ uri: "entity:Shared", weight: "supporting" }])
    );

    verifyAnchors(db, projectRoot);

    const statuses = allAnchorStatuses("entity:Shared");
    expect(statuses).toHaveLength(2);
    expect(statuses.every((s) => s === "stale")).toBe(true);
  });
});

// ---- VerifyResult counts ----------------------------------------------------

describe("VerifyResult", () => {
  it("returns correct checked/ok/stale counts", () => {
    const { notesDir, projectRoot } = setup();
    writeFileSync(join(projectRoot, "exists.ts"), "");
    db.prepare("INSERT INTO entities (name, description) VALUES (?,?)").run(
      "Present",
      "desc"
    );
    writeNoteIndexed(
      db,
      notesDir,
      note([
        { uri: "file:exists.ts", weight: "core" },
        { uri: "file:gone.ts", weight: "supporting" },
        { uri: "entity:Present", weight: "core" },
      ])
    );

    const result = verifyAnchors(db, projectRoot);

    expect(result.checked).toBe(3);
    expect(result.ok).toBe(2);
    expect(result.stale).toBe(1);
  });
});
