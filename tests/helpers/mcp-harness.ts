import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import { expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { openMcp, reconcileAll } from "../../src/mcp/context.js";
import { createMcpHttpServer } from "../../src/mcp/server.js";
import type { McpCtx } from "../../src/mcp/context.js";
import { copyFixtureProject } from "./fixture-project.js";

export interface Harness {
  dir: string;
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
  callExpectError(name: string, args: Record<string, unknown>): Promise<void>;
  teardown(): Promise<void>;
}

// augment вызывается ПОСЛЕ копирования фикстура и ДО reconcileAll — для
// добавления заметок/данных во временную копию без изменения закоммиченного
// фикстура.
export async function startHarness(augment?: (dir: string) => void): Promise<Harness> {
  const dir = copyFixtureProject();
  process.env.CMS_PROJECT_ROOT = dir;
  if (augment) augment(dir);
  const ctx: McpCtx = openMcp();
  await reconcileAll(ctx);
  const httpServer: Server = createMcpHttpServer(ctx);
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", r));
  const { port } = httpServer.address() as { port: number };
  const client = new Client({ name: "story-e2e", version: "0.0.1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
  );
  return {
    dir,
    async call(name, args = {}) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      const content = result.content as { type: string; text: string }[];
      expect(content[0].type).toBe("text");
      return JSON.parse(content[0].text);
    },
    async callExpectError(name, args) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
    },
    async teardown() {
      await client.close();
      await new Promise<void>((r) => httpServer.close(() => r()));
      ctx.db.close();
      rmSync(dir, { recursive: true, force: true });
      delete process.env.CMS_PROJECT_ROOT;
    },
  };
}

export interface FixtureNoteSpec {
  id: string;
  summary: string;
  status: "current" | "outdated" | "draft";
  created: string;
  updated: string;
  anchors: { uri: string; weight: string }[];
  body: string;
}

// Пишет валидный .md в <dir>/.memory/notes/ — для наполнения корпуса.
export function writeFixtureNote(dir: string, note: FixtureNoteSpec): void {
  const anchorLines = note.anchors
    .map((a) => `  - uri: ${a.uri}\n    weight: ${a.weight}`)
    .join("\n");
  const md = `---
id: ${note.id}
summary: ${note.summary}
status: ${note.status}
created: ${note.created}
updated: ${note.updated}
anchors:
${anchorLines}
---

${note.body}
`;
  writeFileSync(join(dir, ".memory", "notes", `${note.id}.md`), md);
}
