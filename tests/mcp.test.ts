import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { openMcp, reconcileAll } from "../src/mcp/context.js";
import { buildServer, createMcpHttpServer } from "../src/mcp/server.js";
import type { McpCtx } from "../src/mcp/context.js";

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const NOTE_MD = (id: string, summary: string) => `\
---
id: ${id}
summary: ${summary}
status: current
created: 2024-01-01
updated: 2024-01-01
anchors:
  - uri: file:src/main.ts
    weight: core
---

Body of ${summary}.
`;

const ENTITIES_MD = `# Domain Entities

## Cart

Pre-checkout item collection.
`;

// ------------------------------------------------------------------
// Test state
// ------------------------------------------------------------------

let tmpDir: string;
let ctx: McpCtx;
let client: Client;
let clientTransport: InMemoryTransport;

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "cms-mcp-"));
  const memoryDir = join(tmpDir, ".memory");
  const notesDir = join(memoryDir, "notes");
  mkdirSync(notesDir, { recursive: true });
  mkdirSync(join(tmpDir, "src"), { recursive: true });

  writeFileSync(join(notesDir, "2024-01-01-alpha.md"), NOTE_MD("2024-01-01-alpha", "Alpha note"));
  writeFileSync(join(memoryDir, "entities.md"), ENTITIES_MD);
  writeFileSync(
    join(tmpDir, "src", "main.ts"),
    "export function main() {}\nexport class App {\n  run() {}\n}\n",
  );
  writeFileSync(join(tmpDir, "src", "empty.ts"), "export const x = 1;\n");
  writeFileSync(join(tmpDir, ".gitignore"), "node_modules/\n");

  process.env.CMS_PROJECT_ROOT = tmpDir;

  ctx = openMcp();
  await reconcileAll(ctx);

  const server = buildServer(ctx);
  const [serverTransport, ct] = InMemoryTransport.createLinkedPair();
  clientTransport = ct;
  client = new Client({ name: "test-client", version: "0.0.1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  ctx.db.close();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CMS_PROJECT_ROOT;
});

// ------------------------------------------------------------------
// Helper
// ------------------------------------------------------------------

async function callText(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBeFalsy();
  expect(result.content[0].type).toBe("text");
  return (result.content[0] as { type: "text"; text: string }).text;
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return JSON.parse(await callText(name, args));
}

// ------------------------------------------------------------------
// Part A — tool response shapes (InMemory transport)
// ------------------------------------------------------------------

describe("tool shapes (InMemory)", () => {
  it("search returns MD by default: [[id]] summary per hit", async () => {
    const text = await callText("search", { query: "Alpha" });
    expect(text).toBe("[[2024-01-01-alpha]] Alpha note");
  });

  it("search marks a non-current note with [status]", async () => {
    const { id } = await call("create_note", {
      summary: "Stale insight",
      body: "Body text",
      anchors: [{ uri: "file:src/main.ts", weight: "core" }],
    }) as { id: string };
    await call("update_note", { id, status: "outdated" });
    const text = await callText("search", { query: "Stale", include_archived: true });
    expect(text).toBe(`[[${id}]] [outdated] Stale insight`);
  });

  it("search appends the truncation tail and total only when truncated", async () => {
    const a = await call("create_note", {
      summary: "Beta first",
      body: "Body text",
      anchors: [{ uri: "file:src/main.ts", weight: "core" }],
    }) as { id: string };
    const b = await call("create_note", {
      summary: "Beta second",
      body: "Body text",
      anchors: [{ uri: "file:src/main.ts", weight: "core" }],
    }) as { id: string };

    const text = await callText("search", { query: "Beta", limit: 1 });
    const lines = text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("— показано 1 из 2, сузь запрос");
    expect([a.id, b.id]).toContain(lines[0].match(/\[\[([a-z0-9]{5})\]\]/)?.[1]);

    // Not truncated → no tail line, total not printed.
    const full = await callText("search", { query: "Beta" });
    expect(full.split("\n")).toHaveLength(2);
    expect(full).not.toContain("показано");
  });

  it("search returns a marker on empty results", async () => {
    const text = await callText("search", { query: "nonexistentterm" });
    expect(text).toBe("— ничего не найдено");
  });

  it("search with format:json returns the structured object unchanged", async () => {
    const r = await call("search", { query: "Alpha", format: "json" }) as { hits: unknown[]; total: number; truncated: boolean };
    expect(r).toMatchObject({ hits: expect.any(Array), total: expect.any(Number), truncated: expect.any(Boolean) });
    expect(r.hits[0]).toMatchObject({ id: "2024-01-01-alpha", summary: "Alpha note" });
  });

  it("get_notes returns {notes, missing}", async () => {
    const r = await call("get_notes", { ids: ["2024-01-01-alpha", "nonexistent"] }) as { notes: unknown[]; missing: string[] };
    expect(r.notes).toHaveLength(1);
    expect(r.missing).toContain("nonexistent");
  });

  it("create_note returns {id}", async () => {
    const r = await call("create_note", {
      summary: "New note",
      body: "Body text",
      anchors: [{ uri: "file:src/main.ts", weight: "core" }],
    }) as { id: string };
    expect(r.id).toMatch(/^[a-z0-9]{5}$/);
  });

  it("create_note warns when anchors cover only one axis", async () => {
    const r = await call("create_note", {
      summary: "Single axis note",
      body: "Body text",
      anchors: [{ uri: "file:src/main.ts", weight: "core" }],
    }) as { id: string; warning?: string };
    expect(r.warning).toMatch(/entity:/);
  });

  it("create_note omits warning when both axes are anchored", async () => {
    const r = await call("create_note", {
      summary: "Both axes note",
      body: "Body text",
      anchors: [
        { uri: "entity:Cart", weight: "core" },
        { uri: "file:src/main.ts", weight: "core" },
      ],
    }) as { id: string; warning?: string };
    expect(r.warning).toBeUndefined();
  });

  it("update_note returns {id}", async () => {
    const r = await call("update_note", {
      id: "2024-01-01-alpha",
      body: "Updated body",
    }) as { id: string };
    expect(r.id).toBe("2024-01-01-alpha");
  });

  it("rename_anchor returns {renamed}", async () => {
    const r = await call("rename_anchor", {
      old_uri: "file:src/main.ts",
      new_uri: "file:src/app.ts",
    }) as { renamed: number };
    expect(r.renamed).toBeGreaterThanOrEqual(1);
  });

  it("create_entity returns {name}", async () => {
    const r = await call("create_entity", {
      name: "Checkout",
      description: "Order completion flow",
    }) as { name: string };
    expect(r.name).toBe("Checkout");
  });

  it("list_entities returns MD by default: **Name** — description per entity", async () => {
    const text = await callText("list_entities");
    expect(text).toBe("**Cart** — Pre-checkout item collection.");
  });

  it("list_entities returns a marker on an empty registry", async () => {
    rmSync(join(tmpDir, ".memory", "entities.md"));
    const text = await callText("list_entities");
    expect(text).toBe("— нет сущностей");
  });

  it("list_entities with format:json returns the array unchanged", async () => {
    const r = await call("list_entities", { format: "json" }) as { name: string; description: string }[];
    expect(r).toBeInstanceOf(Array);
    expect(r[0]).toMatchObject({ name: "Cart", description: "Pre-checkout item collection." });
  });

  it("list_symbols_in_file returns MD: top-level bare, member as Class.member", async () => {
    const text = await callText("list_symbols_in_file", { path: "src/main.ts" });
    expect(text).toBe(
      ["function main  (1-1)", "class App  (2-4)", "method App.run  (3-3)"].join("\n"),
    );
  });

  it("list_symbols_in_file returns a marker for a file without symbols", async () => {
    const text = await callText("list_symbols_in_file", { path: "src/empty.ts" });
    expect(text).toBe("— нет символов");
  });

  it("list_symbols_in_file with format:json returns the array unchanged", async () => {
    const r = await call("list_symbols_in_file", { path: "src/main.ts", format: "json" }) as {
      name: string; kind: string; parent: string | null; start_line: number; end_line: number;
    }[];
    expect(r).toBeInstanceOf(Array);
    expect(r).toContainEqual({
      name: "run", kind: "method", parent: "App", start_line: 3, end_line: 3,
    });
  });

  it("listTools returns all 8 tools", async () => {
    const r = await client.listTools();
    const names = r.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_entity",
      "create_note",
      "get_notes",
      "list_entities",
      "list_symbols_in_file",
      "rename_anchor",
      "search",
      "update_note",
    ]);
  });
});

// ------------------------------------------------------------------
// Part B — HTTP connectivity
// ------------------------------------------------------------------

describe("HTTP connectivity", () => {
  it("listTools over HTTP returns 8 tools", async () => {
    const httpServer = createMcpHttpServer(ctx);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const addr = httpServer.address() as { port: number };

    const httpClient = new Client({ name: "http-test-client", version: "0.0.1" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${addr.port}/mcp`),
    );

    try {
      await httpClient.connect(transport);
      const r = await httpClient.listTools();
      expect(r.tools).toHaveLength(8);
    } finally {
      await httpClient.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
