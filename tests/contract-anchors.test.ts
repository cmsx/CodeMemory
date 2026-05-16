import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { reconcileEntities } from "../src/core/entity-indexer.js";
import {
  reconcileNotes,
  writeNoteIndexed,
} from "../src/core/note-indexer.js";
import { reconcileStructure } from "../src/core/structural-indexer.js";
import { verifyAnchors, type VerifyResult } from "../src/core/verifier.js";
import type { Note } from "../src/core/note-store.js";
import { copyFixtureProject } from "./helpers/fixture-project.js";

// ── shared state ──────────────────────────────────────────────────────────────

let dir: string;
let db: DatabaseSync;
let fixtureResult: VerifyResult;

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

// ── setup ─────────────────────────────────────────────────────────────────────

const BROKEN_SRC = `export class Broken {
  good(): number {
    return 1;
  }
}

function oops( {
`;

beforeAll(async () => {
  dir = copyFixtureProject();

  // Edge-case files written ad-hoc into the temp copy (not committed fixture).
  writeFileSync(join(dir, "src", "broken.ts"), BROKEN_SRC);
  mkdirSync(join(dir, "src", "sub"), { recursive: true });
  writeFileSync(join(dir, "src", "sub", ".gitignore"), "hidden.ts\n");
  writeFileSync(join(dir, "src", "sub", "hidden.ts"), "export class Hidden {}\n");

  db = openIndex(join(dir, ".memory", "index.db"));
  reconcileEntities(db, join(dir, ".memory"));
  reconcileNotes(db, join(dir, ".memory", "notes"));

  // reconcileStructure completing without throwing is the "no exception on
  // broken.ts" assertion — tree-sitter error-recovers rather than throwing.
  await reconcileStructure(db, dir);

  // First verify run: fixture anchors only. Captured for the count assertion.
  fixtureResult = verifyAnchors(db, dir);

  // Synthetic anchors for forms not present in the fixture's 26 URIs.
  writeNoteIndexed(
    db,
    join(dir, ".memory", "notes"),
    note([
      // symbol type form — ok (TS enum, real symbol in order.ts)
      { uri: "symbol:src/order.ts::OrderStatus", weight: "core" },
      // symbol type form — stale
      { uri: "symbol:src/order.ts::NoSuchType", weight: "core" },
      // symbol: with no :: → parseSymbolUri returns null → stale
      { uri: "symbol:nodoublecolon", weight: "core" },
      // empty payload: verifier short-circuits to stale before type dispatch
      { uri: "file:", weight: "core" },
      { uri: "symbol:", weight: "core" },
      // symbol anchor into an unparseable-extension file (no symbol_index rows)
      { uri: "symbol:docs/schema.sql::orders", weight: "core" },
      // valid symbol in the syntax-error file (tree-sitter error recovery)
      { uri: "symbol:src/broken.ts::Broken", weight: "core" },
      // nested .gitignore is inert — file is still indexed by reconcileStructure
      { uri: "symbol:src/sub/hidden.ts::Hidden", weight: "core" },
    ])
  );

  // Second verify run: covers synthetic anchors too.
  verifyAnchors(db, dir);
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

// ── 1. Contract matrix — fixture anchors ─────────────────────────────────────
//
// 26 canonical anchor URIs from the committed fixture. Expected statuses are
// derived from specs/02-data-model.md resolution rules, not from current code
// behavior. If a row fails, the spec contract is broken.

type MatrixRow = { uri: string; expected: "ok" | "stale" };

const MATRIX: MatrixRow[] = [
  // file: — filesystem stat, extension irrelevant
  { uri: "file:src/order.ts", expected: "ok" },
  // .sql is not a tree-sitter language; file: still resolves via existsSync
  { uri: "file:docs/schema.sql", expected: "ok" },
  { uri: "file:src/legacy/removed.ts", expected: "stale" },

  // symbol: bare function name
  { uri: "symbol:src/cart.js::isEmpty", expected: "ok" },
  { uri: "symbol:src/billing.php::formatCents", expected: "ok" },
  { uri: "symbol:src/pricing.go::NewPrice", expected: "ok" },
  { uri: "symbol:src/cart.js::computeDiscount", expected: "stale" },

  // symbol: dotted Class.method — resolved via parent+name columns in symbol_index.
  // These four are the canonical regression cases for the indexer↔verifier seam
  // bug (see regression describe block below).
  { uri: "symbol:src/order.ts::Order.cancel", expected: "ok" },
  { uri: "symbol:src/cart.js::Cart.clear", expected: "ok" },
  { uri: "symbol:src/inventory.py::Warehouse.reserve", expected: "ok" },
  { uri: "symbol:src/billing.php::Invoice.invoiceTotal", expected: "ok" },
  { uri: "symbol:src/order.ts::Order.archive", expected: "stale" },

  // symbol: type (struct / interface / trait / enum).
  // NOTE: no dotted Go method anchors — the Go indexer writes parent=null for
  // method receivers, so symbol:src/pricing.go::Type.method is always stale
  // (Decision in cmt-00-index.md). Only bare Go names appear here.
  { uri: "symbol:src/pricing.go::Price", expected: "ok" },
  { uri: "symbol:src/pricing.go::Pricer", expected: "ok" },
  { uri: "symbol:src/billing.php::Discountable", expected: "ok" },
  { uri: "symbol:src/billing.php::PaymentMethod", expected: "ok" },

  // entity: — entity registry membership
  { uri: "entity:Order", expected: "ok" },
  { uri: "entity:Cart", expected: "ok" },
  { uri: "entity:Pricing", expected: "ok" },
  { uri: "entity:Inventory", expected: "ok" },
  { uri: "entity:Billing", expected: "ok" },
  { uri: "entity:Wizard", expected: "stale" }, // not in entities.md

  // env: — .env key presence (parseEnvKeys strips `export` prefix)
  { uri: "env:DATABASE_URL", expected: "ok" },
  { uri: "env:REDIS_URL", expected: "ok" },
  { uri: "env:PRICING_PRECISION", expected: "ok" },
  { uri: "env:UNUSED_KEY", expected: "stale" }, // key not in .env
];

describe("contract matrix — fixture anchors", () => {
  it("fixture produces exactly 26 distinct anchors, 21 ok / 5 stale", () => {
    // If this fails, the committed fixture has drifted from the 26-anchor
    // canonical set. Investigate and record in cmt-02 Working notes; do not
    // adjust the expected numbers to match code without understanding why.
    expect(fixtureResult).toEqual({ checked: 26, ok: 21, stale: 5 });
  });

  it.each(MATRIX)("$uri → $expected", ({ uri, expected }) => {
    expect(anchorStatus(uri)).toBe(expected);
  });
});

// ── 2. Regression: symbol-bug — dotted Class.method ──────────────────────────
//
// The original symbol-bug was a seam bug between the indexer and the verifier:
// the verifier expected dotted form `Class.method` to resolve via the `parent`
// column of symbol_index, but the indexer was not populating that column for
// method nodes. These test cases would have caught the bug because they run
// reconcileStructure (the real tree-sitter indexer) before verifyAnchors,
// unlike verifier.test.ts which fakes the index with raw INSERT statements.

describe("regression: symbol-bug — dotted Class.method", () => {
  it("dotted form resolves ok against the parent column written by the real indexer", () => {
    // All four non-Go dotted ok anchors from the fixture must resolve ok.
    // Running through real reconcileStructure proves the indexer populates
    // parent correctly — a synthetic INSERT would not catch a seam regression.
    expect(anchorStatus("symbol:src/order.ts::Order.cancel")).toBe("ok");
    expect(anchorStatus("symbol:src/cart.js::Cart.clear")).toBe("ok");
    expect(anchorStatus("symbol:src/inventory.py::Warehouse.reserve")).toBe("ok");
    expect(anchorStatus("symbol:src/billing.php::Invoice.invoiceTotal")).toBe("ok");
  });
});

// ── 3. Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("symbol type form resolves ok and stale", () => {
    // OrderStatus is a real TS enum in src/order.ts — confirms type-kind
    // symbols are indexed and resolved identically to function-kind symbols.
    expect(anchorStatus("symbol:src/order.ts::OrderStatus")).toBe("ok");
    expect(anchorStatus("symbol:src/order.ts::NoSuchType")).toBe("stale");
  });

  it("symbol: without :: separator → stale", () => {
    // parseSymbolUri returns null when no :: found; verifier marks stale.
    expect(anchorStatus("symbol:nodoublecolon")).toBe("stale");
  });

  it("empty payload → stale for any anchor type", () => {
    // verifier.ts:86 short-circuits: if (!payload) status = "stale"
    expect(anchorStatus("file:")).toBe("stale");
    expect(anchorStatus("symbol:")).toBe("stale");
  });

  it("symbol anchor into unparseable-extension file → stale", () => {
    // .sql is not in EXT_TO_LANG; reconcileStructure skips it entirely,
    // so symbol_index has no rows for docs/schema.sql. The file: anchor
    // in the contract matrix still resolves ok via existsSync (different path).
    expect(anchorStatus("symbol:docs/schema.sql::orders")).toBe("stale");
  });

  it("file with syntax error: valid symbols extracted, no exception thrown", () => {
    // beforeAll completing proves reconcileStructure did not throw on broken.ts.
    // tree-sitter error-recovers: the Broken class declaration before the broken
    // function is fully valid and is extracted into symbol_index.
    expect(anchorStatus("symbol:src/broken.ts::Broken")).toBe("ok");
  });

  it("nested .gitignore is ignored — only root .gitignore is honored", () => {
    // createIgnoreFilter reads only <projectRoot>/.gitignore.
    // src/sub/.gitignore lists hidden.ts, but that file has no effect:
    // reconcileStructure indexes src/sub/hidden.ts → symbol Hidden → ok.
    expect(anchorStatus("symbol:src/sub/hidden.ts::Hidden")).toBe("ok");
  });
});
