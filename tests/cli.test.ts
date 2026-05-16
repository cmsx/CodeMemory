import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../src/cli/program.js";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const NOTE_MD = (id: string, summary: string, status = "current") => `\
---
id: ${id}
summary: ${summary}
status: ${status}
created: 2024-01-01
updated: 2024-01-01
anchors:
  - uri: file:src/main.ts
    weight: core
---

## Body

This is the body of ${summary}.
`;

const ENTITIES_MD = `# Domain Entities

## Cart

Pre-checkout item collection.
`;

let tmpDir: string;
let captured: string[];

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cms-cli-"));
  const memoryDir = join(tmpDir, ".memory");
  const notesDir = join(memoryDir, "notes");
  mkdirSync(notesDir, { recursive: true });

  writeFileSync(join(notesDir, "2024-01-01-alpha.md"), NOTE_MD("2024-01-01-alpha", "Alpha note"));
  writeFileSync(
    join(notesDir, "2024-01-02-beta.md"),
    NOTE_MD("2024-01-02-beta", "Beta note", "outdated"),
  );
  writeFileSync(join(memoryDir, "entities.md"), ENTITIES_MD);

  // seed a source file so structural indexer has something to hash
  mkdirSync(join(tmpDir, "src"), { recursive: true });
  writeFileSync(join(tmpDir, "src", "main.ts"), "export function main() {}\n");
  writeFileSync(join(tmpDir, ".gitignore"), "node_modules/\n");

  process.env.CMS_PROJECT_ROOT = tmpDir;

  captured = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  delete process.env.CMS_PROJECT_ROOT;
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function run(...args: string[]): Promise<string> {
  captured = [];
  await buildProgram().parseAsync(["node", "cms", ...args]);
  return captured.join("\n");
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("stats", () => {
  it("shows note and entity counts", async () => {
    const out = await run("stats");
    expect(out).toContain("Notes:");
    expect(out).toContain("Entities:");
    expect(out).toContain("Indexed files:");
  });
});

describe("reindex", () => {
  it("--notes reconciles and prints stats", async () => {
    const out = await run("reindex", "--notes");
    expect(out).toContain("Notes:");
  });

  it("--all reconciles and prints stats", async () => {
    const out = await run("reindex", "--all");
    expect(out).toContain("Notes:");
    expect(out).toContain("Indexed files:");
  });
});

describe("note list", () => {
  it("lists all notes", async () => {
    const out = await run("note", "list");
    expect(out).toContain("2024-01-01-alpha");
    expect(out).toContain("2024-01-02-beta");
  });

  it("filters by status", async () => {
    const out = await run("note", "list", "--status", "outdated");
    expect(out).toContain("2024-01-02-beta");
    expect(out).not.toContain("2024-01-01-alpha");
  });

  it("filters by anchor", async () => {
    const out = await run("note", "list", "--anchor", "file:src/main.ts");
    expect(out).toContain("2024-01-01-alpha");
  });

  it("filters by entity (wraps uri)", async () => {
    const out = await run("note", "list", "--entity", "Cart");
    // No notes anchored to entity:Cart — should return no notes
    expect(out).toContain("No notes.");
  });
});

describe("note show", () => {
  it("shows get_notes view for a single note", async () => {
    const out = await run("note", "show", "2024-01-01-alpha");
    expect(out).toContain("Alpha note");
    expect(out).toContain("file:src/main.ts");
    expect(out).toContain("Anchor Map");
  });

  it("reports missing ids", async () => {
    const out = await run("note", "show", "does-not-exist");
    expect(out).toContain("Missing:");
  });

  it("shows multiple notes with separator", async () => {
    const out = await run("note", "show", "2024-01-01-alpha", "2024-01-02-beta");
    expect(out).toContain("Alpha note");
    expect(out).toContain("Beta note");
    expect(out).toContain("---");
  });
});

describe("search", () => {
  it("returns results for a matching query", async () => {
    const out = await run("search", "Alpha");
    expect(out).toContain("2024-01-01-alpha");
  });

  it("returns no results for unmatched query", async () => {
    const out = await run("search", "xyznonexistentterm");
    expect(out).toContain("No results.");
  });

  it("filters by anchor", async () => {
    const out = await run("search", "note", "--anchor", "file:src/main.ts");
    expect(out).toContain("2024-01-01-alpha");
  });
});

describe("verify", () => {
  it("verifies all anchors", async () => {
    const out = await run("verify");
    expect(out).toMatch(/checked \d+/);
  });

  it("verifies a specific note's anchors", async () => {
    const out = await run("verify", "2024-01-01-alpha");
    expect(out).toMatch(/checked \d+/);
  });

  it("throws for unknown note id", async () => {
    await expect(run("verify", "no-such-note")).rejects.toThrow("not found");
  });
});

describe("entity list / show", () => {
  it("lists entities", async () => {
    const out = await run("entity", "list");
    expect(out).toContain("Cart");
  });

  it("shows a specific entity", async () => {
    const out = await run("entity", "show", "Cart");
    expect(out).toContain("## Cart");
    expect(out).toContain("Pre-checkout");
  });

  it("throws for unknown entity", async () => {
    await expect(run("entity", "show", "NoSuch")).rejects.toThrow("not found");
  });
});

describe("entity remove", () => {
  it("removes an entity", async () => {
    await run("entity", "remove", "Cart");
    const out = await run("entity", "list");
    expect(out).toContain("No entities.");
  });

  it("throws for unknown entity", async () => {
    await expect(run("entity", "remove", "NoSuch")).rejects.toThrow("not found");
  });
});

describe("note delete", () => {
  it("deletes a note from file and index", async () => {
    const out = await run("note", "delete", "2024-01-01-alpha");
    expect(out).toContain("deleted");

    // After delete, note should not appear in list
    const list = await run("note", "list");
    expect(list).not.toContain("2024-01-01-alpha");
  });

  it("throws for unknown note", async () => {
    await expect(run("note", "delete", "no-such-note")).rejects.toThrow("not found");
  });
});
