import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { openMcp, reconcileAll } from "../src/mcp/context.js";
import { createMcpHttpServer } from "../src/mcp/server.js";
import type { McpCtx } from "../src/mcp/context.js";
import { copyFixtureProject } from "./helpers/fixture-project.js";

// ------------------------------------------------------------------
// Shared state (beforeAll/afterAll — full fixture with 5 languages)
// ------------------------------------------------------------------

let dir: string;
let ctx: McpCtx;
let httpServer: Server;
let client: Client;
let baseUrl: string;

beforeAll(async () => {
  dir = copyFixtureProject();
  process.env.CMS_PROJECT_ROOT = dir;

  ctx = openMcp();
  await reconcileAll(ctx);

  httpServer = createMcpHttpServer(ctx);
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", r));
  const addr = httpServer.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}/mcp`;

  client = new Client({ name: "mcp-e2e-client", version: "0.0.1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(baseUrl)));
}, 30_000);

afterAll(async () => {
  await client.close();
  await new Promise<void>((r) => httpServer.close(() => r()));
  ctx.db.close();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.CMS_PROJECT_ROOT;
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBeFalsy();
  expect((result.content as { type: string }[])[0].type).toBe("text");
  return JSON.parse((result.content as { type: string; text: string }[])[0].text);
}

async function callExpectError(name: string, args: Record<string, unknown>): Promise<void> {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
}

function flatAnchorUris(note: { anchorMap: { anchors: { uri: string }[] }[] }): string[] {
  return note.anchorMap.flatMap((g) => g.anchors.map((a) => a.uri));
}

// ------------------------------------------------------------------
// Read tools — run before write tests to avoid state interference
// ------------------------------------------------------------------

describe("read tools over HTTP", () => {
  it("search by query returns matching note with correct shape", async () => {
    const r = await call("search", { query: "isEmpty" }) as {
      hits: { id: string; summary: string }[];
      total: number;
      truncated: boolean;
    };
    expect(r).toMatchObject({ hits: expect.any(Array), total: expect.any(Number), truncated: expect.any(Boolean) });
    expect(r.hits.map((h) => h.id)).toContain("2026-05-11-cart-emptiness-check");
  });

  it("search anchor-only without query (regression: search-bug)", async () => {
    // anchor-only search, no query argument — the bug was [query] not optional in CLI parser
    const r = await call("search", { anchors: ["entity:Order"] }) as {
      hits: { id: string }[];
      total: number;
    };
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.hits.map((h) => h.id)).toContain("2026-05-10-order-cancellation-rule");
  });

  it("get_notes returns full note with anchorMap and mentioned", async () => {
    const r = await call("get_notes", { ids: ["2026-05-10-order-cancellation-rule"] }) as {
      notes: {
        id: string;
        summary: string;
        status: string;
        body: string;
        anchorMap: { weight: string; anchors: { uri: string; status: string }[] }[];
        mentioned: { id: string; stale: boolean }[];
      }[];
      missing: string[];
    };
    expect(r.notes).toHaveLength(1);
    expect(r.missing).toHaveLength(0);
    const note = r.notes[0];
    expect(note.id).toBe("2026-05-10-order-cancellation-rule");
    // file/symbol anchors only in anchorMap — entity:Order is excluded by getNotes
    const uris = flatAnchorUris(note);
    expect(uris).toContain("symbol:src/order.ts::Order.cancel");
    expect(uris).toContain("file:src/order.ts");
    expect(uris).not.toContain("entity:Order");
    // mentioned: [[2026-05-15-status-guard-idea]] is in body (stale=false, it exists)
    expect(note.mentioned.map((m) => m.id)).toContain("2026-05-15-status-guard-idea");
  });

  it("get_notes puts nonexistent id into missing[]", async () => {
    const r = await call("get_notes", {
      ids: ["2026-05-10-order-cancellation-rule", "2099-01-01-nonexistent"],
    }) as { notes: unknown[]; missing: string[] };
    expect(r.notes).toHaveLength(1);
    expect(r.missing).toContain("2099-01-01-nonexistent");
  });

  it("list_entities returns all 5 fixture entities with name+description", async () => {
    const r = await call("list_entities") as { name: string; description: string }[];
    expect(r).toHaveLength(5);
    const names = r.map((e) => e.name).sort();
    expect(names).toEqual(["Billing", "Cart", "Inventory", "Order", "Pricing"]);
    expect(r[0]).toMatchObject({ name: expect.any(String), description: expect.any(String) });
  });

  it("list_symbols_in_file returns symbols for src/order.ts", async () => {
    const r = await call("list_symbols_in_file", { path: "src/order.ts" }) as {
      name: string; kind: string; parent: string | null; start_line: number; end_line: number;
    }[];
    expect(r.length).toBeGreaterThan(0);
    const names = r.map((s) => s.name);
    expect(names).toContain("Order");
    expect(names).toContain("cancel");
    expect(r[0]).toMatchObject({
      name: expect.any(String),
      kind: expect.any(String),
      start_line: expect.any(Number),
      end_line: expect.any(Number),
    });
  });
});

// ------------------------------------------------------------------
// Write tools — mutate state; reads above must run first
// ------------------------------------------------------------------

describe("write tools over HTTP", () => {
  it("create_entity registers new entity, list_entities grows to 6", async () => {
    const r = await call("create_entity", {
      name: "Shipping",
      description: "Доставка заказа покупателю.",
    }) as { name: string };
    expect(r.name).toBe("Shipping");

    const list = await call("list_entities") as { name: string }[];
    expect(list).toHaveLength(6);
    expect(list.map((e) => e.name)).toContain("Shipping");
  });

  it("create_note returns id, get_notes finds the note", async () => {
    const r = await call("create_note", {
      summary: "E2E проверка заметки",
      body: "Тело заметки.",
      anchors: [{ uri: "file:src/order.ts", weight: "core" }],
    }) as { id: string };
    expect(r.id).toMatch(/^2\d{3}-\d{2}-\d{2}-/);

    const got = await call("get_notes", { ids: [r.id] }) as { notes: { id: string }[]; missing: string[] };
    expect(got.notes).toHaveLength(1);
    expect(got.notes[0].id).toBe(r.id);
    expect(got.missing).toHaveLength(0);
  });

  it("update_note changes status, get_notes reflects change", async () => {
    const r = await call("update_note", {
      id: "2026-05-15-status-guard-idea",
      status: "outdated",
    }) as { id: string };
    expect(r.id).toBe("2026-05-15-status-guard-idea");

    const got = await call("get_notes", { ids: ["2026-05-15-status-guard-idea"] }) as {
      notes: { id: string; status: string }[];
    };
    expect(got.notes[0].status).toBe("outdated");
  });

  it("rename_anchor updates URI in all notes that carry it (renamed: 2)", async () => {
    const r = await call("rename_anchor", {
      old_uri: "symbol:src/pricing.go::NewPrice",
      new_uri: "symbol:src/pricing.go::CreatePrice",
    }) as { renamed: number };
    expect(r.renamed).toBe(2);

    // Both notes that had NewPrice now carry CreatePrice
    const got = await call("get_notes", {
      ids: ["2026-05-08-float-pricing", "2026-05-12-pricing-minor-units"],
    }) as { notes: { id: string; anchorMap: { anchors: { uri: string }[] }[] }[] };
    expect(got.notes).toHaveLength(2);
    for (const note of got.notes) {
      const uris = flatAnchorUris(note);
      expect(uris).toContain("symbol:src/pricing.go::CreatePrice");
      expect(uris).not.toContain("symbol:src/pricing.go::NewPrice");
    }
  });
});

// ------------------------------------------------------------------
// Contract / error cases
// ------------------------------------------------------------------

describe("contract error cases over HTTP", () => {
  it("create_note with unregistered entity anchor is rejected (isError)", async () => {
    await callExpectError("create_note", {
      summary: "bad entity",
      body: "x",
      anchors: [{ uri: "entity:Wizard", weight: "core" }],
    });
  });

  it("create_note with empty anchors is rejected (isError)", async () => {
    await callExpectError("create_note", {
      summary: "no anchors",
      body: "x",
      anchors: [],
    });
  });

  it("update_note on nonexistent id is rejected (isError)", async () => {
    await callExpectError("update_note", {
      id: "2099-01-01-nope",
      body: "z",
    });
  });
});

// ------------------------------------------------------------------
// HTTP transport layer — raw fetch, validates server routing wrapper
// ------------------------------------------------------------------

describe("HTTP transport layer", () => {
  it("GET /mcp returns 405", async () => {
    const res = await fetch(baseUrl, { method: "GET" });
    expect(res.status).toBe(405);
  });

  it("POST to non-/mcp path returns 404", async () => {
    const wrongUrl = baseUrl.replace("/mcp", "/wrong");
    const res = await fetch(wrongUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("POST /mcp with malformed JSON body returns 400", async () => {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });
});
