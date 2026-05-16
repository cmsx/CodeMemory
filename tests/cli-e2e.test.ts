import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyFixtureProject } from "./helpers/fixture-project.js";
import { buildProgram } from "../src/cli/program.js";
import { openInEditor } from "../src/cli/editor.js";

vi.mock("../src/cli/editor.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/cli/editor.js")>();
  return { ...actual, openInEditor: vi.fn() };
});

// ── shared state ──────────────────────────────────────────────────────────────

let dir: string;
let captured: string[];

beforeEach(() => {
  dir = copyFixtureProject();
  process.env.CMS_PROJECT_ROOT = dir;

  captured = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  delete process.env.CMS_PROJECT_ROOT;
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function run(...args: string[]): Promise<string> {
  captured = [];
  await buildProgram().parseAsync(["node", "cms", ...args]);
  return captured.join("\n");
}

// ── reindex ───────────────────────────────────────────────────────────────────

describe("reindex", () => {
  it("--notes reconciles notes and prints stats", async () => {
    const out = await run("reindex", "--notes");
    expect(out).toContain("Notes: 9");
  });

  it("--code indexes source files and prints stats", async () => {
    const out = await run("reindex", "--code");
    expect(out).toMatch(/Indexed files: [1-9]/);
    expect(out).toContain("Symbols:");
  });

  it("--all reconciles everything and prints full stats", async () => {
    const out = await run("reindex", "--all");
    expect(out).toContain("Notes: 9");
    expect(out).toMatch(/Indexed files: [1-9]/);
  });
});

// ── search ────────────────────────────────────────────────────────────────────

describe("search", () => {
  it("text search finds a matching note", async () => {
    const out = await run("search", "isEmpty");
    expect(out).toContain("2026-05-11-cart-emptiness-check");
  });

  it("unmatched query returns no results", async () => {
    const out = await run("search", "zzznetуникум");
    expect(out).toContain("No results.");
  });

  // Canonical regression for the search-bug: anchor-only search with no text
  // query and a dotted Class.method symbol anchor (specs/02 canonical form).
  // This is the form that triggered the original CLI-parser↔core seam bug —
  // [query] was required by commander, so anchor-only failed at parse time.
  it("anchor-only search — no text query, dotted Class.method symbol anchor", async () => {
    const out = await run("search", "--anchor", "symbol:src/order.ts::Order.cancel");
    expect(out).toContain("2026-05-10-order-cancellation-rule");
  });

  it("anchor + text search returns relevant note", async () => {
    const out = await run("search", "корзин", "--anchor", "entity:Cart");
    expect(out).toContain("2026-05-11-cart-emptiness-check");
  });
});

// ── note show ─────────────────────────────────────────────────────────────────

describe("note show", () => {
  it("shows body, anchor map, and mentioned notes block", async () => {
    const out = await run("note", "show", "2026-05-10-order-cancellation-rule");
    expect(out).toContain("Summary:");
    expect(out).toContain("Отмена заказа");
    expect(out).toContain("## Anchor Map");
    expect(out).toContain("### critical");
    expect(out).toContain("### core");
    expect(out).toContain("symbol:src/order.ts::Order.cancel");
    expect(out).toContain("## Mentioned Notes");
    expect(out).toContain("[[2026-05-15-status-guard-idea]]");
    // Broken [[id]] link must be flagged [stale]
    expect(out).toContain("[[2099-01-01-nonexistent]]");
    expect(out).toMatch(/2099-01-01-nonexistent.*\[stale\]/s);
  });

  it("shows [stale] flags on all stale anchors", async () => {
    const out = await run("note", "show", "2026-05-09-stale-anchor-samples");
    expect(out).toContain("## Anchor Map");
    // All 5 anchors of this note are intentionally stale
    expect(out).toContain("[stale]");
  });

  it("reports missing id", async () => {
    const out = await run("note", "show", "no-such-id");
    expect(out).toContain("Missing:");
  });
});

// ── stats ─────────────────────────────────────────────────────────────────────

describe("stats", () => {
  it("shows note count, status breakdown, and indexed file count", async () => {
    const out = await run("stats");
    expect(out).toContain("Notes: 9");
    expect(out).toContain("outdated: 1");
    expect(out).toContain("draft: 1");
    expect(out).toContain("Anchors:");
    expect(out).toContain("Indexed files:");
  });
});

// ── verify ────────────────────────────────────────────────────────────────────

describe("verify", () => {
  it("verifies all anchors — exact fixture counts from contract test", async () => {
    const out = await run("verify");
    expect(out).toContain("checked 26, ok 21, stale 5");
  });

  it("verifies a single note — all 5 anchors of stale-anchor-samples are stale", async () => {
    const out = await run("verify", "2026-05-09-stale-anchor-samples");
    expect(out).toContain("checked 5, ok 0, stale 5");
  });

  it("throws for unknown note id", async () => {
    await expect(run("verify", "no-such-note")).rejects.toThrow("not found");
  });
});

// ── note edit — edge case ─────────────────────────────────────────────────────

describe("note edit", () => {
  it("propagates NoteParseError when editor writes invalid frontmatter; no auto-revert", async () => {
    const noteId = "2026-05-11-cart-emptiness-check";
    const notePath = join(dir, ".memory", "notes", `${noteId}.md`);
    const brokenContent = "---\nid: x\n---\n\nbody without summary\n";

    vi.mocked(openInEditor).mockImplementation((path: string) => {
      writeFileSync(path, brokenContent);
    });

    await expect(run("note", "edit", noteId)).rejects.toThrow("reindex failed after edit");

    // CLI must not auto-revert the file — the broken content stays on disk
    expect(readFileSync(notePath, "utf8")).toBe(brokenContent);
  });
});
