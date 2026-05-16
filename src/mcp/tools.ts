import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { search } from "../core/search.js";
import { getNotes } from "../core/get-notes.js";
import { createNote, updateNote, renameAnchor } from "../core/note-write.js";
import { createEntity } from "../core/entity-indexer.js";
import { readEntities } from "../core/entity-store.js";
import { verifyAnchors } from "../core/verifier.js";
import type { McpCtx } from "./context.js";

const weightSchema = z.enum(["critical", "core", "supporting", "incidental"]);
const statusSchema = z.enum(["current", "outdated", "draft"]);
const anchorSchema = z.object({ uri: z.string(), weight: weightSchema });

const json = (x: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(x) }],
});

export function registerTools(server: McpServer, ctx: McpCtx): void {
  server.registerTool(
    "search",
    {
      description: "Search memory notes; returns compact id+summary list",
      inputSchema: {
        anchors: z.array(z.string()).optional(),
        query: z.string().optional(),
        context: z.array(z.string()).optional(),
        include_archived: z.boolean().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    async ({ anchors, query, context, include_archived, limit }) => {
      return json(search(ctx.db, { anchors, query, context, include_archived, limit }));
    },
  );

  server.registerTool(
    "get_notes",
    {
      description: "Expand 1..N notes: body, anchor map, mentioned notes",
      inputSchema: {
        ids: z.array(z.string()),
      },
    },
    async ({ ids }) => {
      return json(getNotes(ctx.db, ids));
    },
  );

  server.registerTool(
    "create_note",
    {
      description: "Capture a new memory note",
      inputSchema: {
        summary: z.string(),
        body: z.string(),
        anchors: z.array(anchorSchema),
        status: statusSchema.optional(),
      },
    },
    async ({ summary, body, anchors, status }) => {
      const note = createNote(
        ctx.db,
        ctx.memoryDir,
        summary,
        body,
        anchors,
        status ?? "current",
      );
      verifyAnchors(ctx.db, ctx.projectRoot, { uris: anchors.map((a) => a.uri) });
      return json({ id: note.id });
    },
  );

  server.registerTool(
    "update_note",
    {
      description: "Partially update a note: body, anchors, or status",
      inputSchema: {
        id: z.string(),
        body: z.string().optional(),
        anchors: z.array(anchorSchema).optional(),
        status: statusSchema.optional(),
      },
    },
    async ({ id, body, anchors, status }) => {
      const note = updateNote(ctx.db, ctx.memoryDir, id, { body, anchors, status });
      if (anchors) {
        verifyAnchors(ctx.db, ctx.projectRoot, { uris: anchors.map((a) => a.uri) });
      }
      return json({ id: note.id });
    },
  );

  server.registerTool(
    "rename_anchor",
    {
      description: "Rename an anchor URI across all notes (use after refactoring)",
      inputSchema: {
        old_uri: z.string(),
        new_uri: z.string(),
      },
    },
    async ({ old_uri, new_uri }) => {
      const count = renameAnchor(ctx.db, ctx.memoryDir, old_uri, new_uri);
      verifyAnchors(ctx.db, ctx.projectRoot, { uris: [new_uri] });
      return json({ renamed: count });
    },
  );

  server.registerTool(
    "create_entity",
    {
      description: "Register a new domain entity in the registry",
      inputSchema: {
        name: z.string(),
        description: z.string(),
      },
    },
    async ({ name, description }) => {
      createEntity(ctx.db, ctx.memoryDir, { name, description });
      return json({ name });
    },
  );

  server.registerTool(
    "list_entities",
    {
      description: "List all registered domain entities",
      inputSchema: {},
    },
    async () => {
      return json(readEntities(ctx.memoryDir));
    },
  );

  server.registerTool(
    "list_symbols_in_file",
    {
      description: "List code symbols in a file without reading the file",
      inputSchema: {
        path: z.string(),
      },
    },
    async ({ path }) => {
      const rows = ctx.db
        .prepare(
          `SELECT name, kind, parent, start_line, end_line
           FROM symbol_index WHERE file = ? ORDER BY start_line`,
        )
        .all(path);
      return json(rows);
    },
  );
}
