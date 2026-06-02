import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { search, type SearchResult } from "../core/search.js";
import { getNotes } from "../core/get-notes.js";
import { anchorCoverageWarning, createNote, updateNote, renameAnchor } from "../core/note-write.js";
import { createEntity } from "../core/entity-indexer.js";
import { readEntities, type Entity } from "../core/entity-store.js";
import { verifyAnchors } from "../core/verifier.js";
import type { McpCtx } from "./context.js";

const weightSchema = z.enum(["critical", "core", "supporting", "incidental"]);
const statusSchema = z.enum(["current", "outdated", "draft"]);
const anchorSchema = z.object({ uri: z.string(), weight: weightSchema });

const summarySchema = z
  .string()
  .describe(
    "Plain-text one-line announce of the note. Must not contain < > { } [ ] | ` " +
      "(YAML indicators that corrupt frontmatter); put any markup in body.",
  );

const json = (x: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(x) }],
});

const text = (s: string) => ({
  content: [{ type: "text" as const, text: s }],
});

type Format = "md" | "json" | undefined;

// MD is the default; JSON is the byte-for-byte fallback through the format arg.
// Single branch reused by every list/search tool — per-tool shape lives in mdFn.
const respond = <T>(result: T, format: Format, mdFn: (r: T) => string) =>
  format === "json" ? json(result) : text(mdFn(result));

function searchToMd(result: SearchResult): string {
  if (result.hits.length === 0) return "— ничего не найдено";
  const lines = result.hits.map((h) =>
    h.status ? `[[${h.id}]] [${h.status}] ${h.summary}` : `[[${h.id}]] ${h.summary}`,
  );
  if (result.truncated) {
    lines.push(`— показано ${result.hits.length} из ${result.total}, сузь запрос`);
  }
  return lines.join("\n");
}

function entitiesToMd(rows: Entity[]): string {
  if (rows.length === 0) return "— нет сущностей";
  return rows.map((e) => `**${e.name}** — ${e.description}`).join("\n");
}

interface SymbolRow {
  name: string;
  kind: string;
  parent: string | null;
  start_line: number;
  end_line: number;
}

function symbolsToMd(rows: SymbolRow[]): string {
  if (rows.length === 0) return "— нет символов";
  return rows
    .map((r) => {
      const label = r.parent ? `${r.parent}.${r.name}` : r.name;
      return `${r.kind} ${label}  (${r.start_line}-${r.end_line})`;
    })
    .join("\n");
}

const formatSchema = z
  .enum(["md", "json"])
  .optional()
  .describe("Output format; default md (compact). Pass json for the structured object.");

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
        include_drafts: z.boolean().optional(),
        strict: z
          .boolean()
          .optional()
          .describe(
            "Text query: require EVERY term (AND) instead of the default ANY (OR). Default (omitted) is broad recall — any term qualifies, BM25 ranks the densest match first. Set true to narrow to notes mentioning all terms when an OR sweep is too noisy.",
          ),
        // Standard parameter, intentionally left without a .describe() and
        // absent from the tool description: routine work uses targeted search.
        match_all: z.boolean().optional(),
        limit: z.number().int().positive().optional(),
        format: formatSchema,
      },
    },
    async ({
      anchors,
      query,
      context,
      include_archived,
      include_drafts,
      strict,
      match_all,
      limit,
      format,
    }) => {
      return respond(
        search(ctx.db, {
          anchors,
          query,
          context,
          include_archived,
          include_drafts,
          strict,
          match_all,
          limit,
        }),
        format,
        searchToMd,
      );
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
      description:
        "Capture a new memory note. Do not pass an id — the server generates a short hash id and returns it.",
      inputSchema: {
        summary: summarySchema,
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
      const warning = anchorCoverageWarning(anchors);
      return json(warning ? { id: note.id, warning } : { id: note.id });
    },
  );

  server.registerTool(
    "update_note",
    {
      description: "Partially update a note: summary, body, anchors, or status",
      inputSchema: {
        id: z.string(),
        summary: summarySchema.optional(),
        body: z.string().optional(),
        anchors: z.array(anchorSchema).optional(),
        status: statusSchema.optional(),
      },
    },
    async ({ id, summary, body, anchors, status }) => {
      const note = updateNote(ctx.db, ctx.memoryDir, id, { summary, body, anchors, status });
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
      inputSchema: {
        format: formatSchema,
      },
    },
    async ({ format }) => {
      return respond(readEntities(ctx.memoryDir), format, entitiesToMd);
    },
  );

  server.registerTool(
    "list_symbols_in_file",
    {
      description: "List code symbols in a file without reading the file",
      inputSchema: {
        path: z.string(),
        format: formatSchema,
      },
    },
    async ({ path, format }) => {
      const rows = ctx.db
        .prepare(
          `SELECT name, kind, parent, start_line, end_line
           FROM symbol_index WHERE file = ? ORDER BY start_line`,
        )
        .all(path) as unknown as SymbolRow[];
      return respond(rows, format, symbolsToMd);
    },
  );
}
