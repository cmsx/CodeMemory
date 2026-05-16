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
  writeFileSync(join(tmpDir, "src", "main.ts"), "export function main() {}\nexport const version = '1';\n");
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

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBeFalsy();
  expect(result.content[0].type).toBe("text");
  return JSON.parse((result.content[0] as { type: "text"; text: string }).text);
}

// ------------------------------------------------------------------
// Part A — tool response shapes (InMemory transport)
// ------------------------------------------------------------------

describe("tool shapes (InMemory)", () => {
  it("search returns {hits, total, truncated}", async () => {
    const r = await call("search", { query: "Alpha" }) as { hits: unknown[]; total: number; truncated: boolean };
    expect(r).toMatchObject({ hits: expect.any(Array), total: expect.any(Number), truncated: expect.any(Boolean) });
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
    expect(r.id).toMatch(/^2\d{3}-\d{2}-\d{2}-new-note$/);
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

  it("list_entities returns array with {name, description}", async () => {
    const r = await call("list_entities") as { name: string; description: string }[];
    expect(r).toBeInstanceOf(Array);
    expect(r[0]).toMatchObject({ name: expect.any(String), description: expect.any(String) });
  });

  it("list_symbols_in_file returns array with symbol fields", async () => {
    const r = await call("list_symbols_in_file", { path: "src/main.ts" }) as unknown[];
    expect(r).toBeInstanceOf(Array);
    if (r.length > 0) {
      expect(r[0]).toMatchObject({
        name: expect.any(String),
        kind: expect.any(String),
        start_line: expect.any(Number),
        end_line: expect.any(Number),
      });
    }
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
