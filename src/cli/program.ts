import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { createEntity, removeEntity, updateEntity } from "../core/entity-indexer.js";
import { readEntities } from "../core/entity-store.js";
import { getNotes } from "../core/get-notes.js";
import { reconcileNotes } from "../core/note-indexer.js";
import type { AnchorWeight } from "../core/note-store.js";
import { createNote, deleteNote } from "../core/note-write.js";
import { search } from "../core/search.js";
import { verifyAnchors } from "../core/verifier.js";
import { openCli, reconcile } from "./context.js";
import { editText, openInEditor } from "./editor.js";
import {
  renderEntityList,
  renderEntity,
  renderGetNotes,
  renderNoteList,
  renderSearchResult,
  renderStats,
  renderVerify,
  type StatsData,
} from "./render.js";

const WEIGHTS = new Set<string>(["critical", "core", "supporting", "incidental"]);
const STATUSES = new Set<string>(["current", "outdated", "draft"]);

function collect(val: string, prev: string[]): string[] {
  return [...prev, val];
}

function queryStats(db: import("node:sqlite").DatabaseSync): StatsData {
  const totalNotes = (db.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
  const byStatus: Record<string, number> = {};
  for (const row of db
    .prepare("SELECT status, COUNT(*) AS n FROM notes GROUP BY status")
    .all() as { status: string; n: number }[]) {
    byStatus[row.status] = row.n;
  }
  const totalAnchors = (db.prepare("SELECT COUNT(*) AS n FROM anchors").get() as { n: number }).n;
  const staleAnchors = (
    db.prepare("SELECT COUNT(*) AS n FROM anchors WHERE anchor_status = 'stale'").get() as {
      n: number;
    }
  ).n;
  const unknownAnchors = (
    db.prepare("SELECT COUNT(*) AS n FROM anchors WHERE anchor_status = 'unknown'").get() as {
      n: number;
    }
  ).n;
  const totalEntities = (db.prepare("SELECT COUNT(*) AS n FROM entities").get() as { n: number })
    .n;
  const totalSymbols = (
    db.prepare("SELECT COUNT(*) AS n FROM symbol_index").get() as { n: number }
  ).n;
  const totalFiles = (db.prepare("SELECT COUNT(*) AS n FROM file_index").get() as { n: number }).n;

  return {
    totalNotes,
    byStatus,
    totalAnchors,
    staleAnchors,
    unknownAnchors,
    totalEntities,
    totalSymbols,
    totalFiles,
  };
}

export function buildProgram(): Command {
  const program = new Command("cms").exitOverride();

  // --- reindex ---
  program
    .command("reindex")
    .description("rebuild the derived index")
    .option("--notes", "reindex notes only")
    .option("--code", "reindex code only")
    .option("--all", "reindex everything (default)")
    .action(async (opts: { notes?: boolean; code?: boolean; all?: boolean }) => {
      const ctx = openCli();
      try {
        const notesFlag = opts.notes ?? false;
        const codeFlag = opts.code ?? false;
        const doNotes = opts.all || notesFlag || (!notesFlag && !codeFlag);
        const doCode = opts.all || codeFlag || (!notesFlag && !codeFlag);
        await reconcile(ctx, { notes: doNotes, code: doCode, entities: true, verify: true });
        console.log(renderStats(queryStats(ctx.db)));
      } finally {
        ctx.db.close();
      }
    });

  // --- verify ---
  program
    .command("verify")
    .description("verify anchors (all notes or a specific note)")
    .argument("[note-id]", "optional note id to verify")
    .action(async (noteId: string | undefined) => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { notes: true, code: true, entities: true });
        let result;
        if (noteId) {
          const rows = ctx.db
            .prepare("SELECT uri FROM anchors WHERE note_id = ?")
            .all(noteId) as { uri: string }[];
          if (rows.length === 0) {
            const noteRow = ctx.db
              .prepare("SELECT 1 FROM notes WHERE id = ?")
              .get(noteId);
            if (!noteRow) throw new Error(`note "${noteId}" not found`);
          }
          result = verifyAnchors(ctx.db, ctx.projectRoot, {
            uris: rows.map((r) => r.uri),
          });
        } else {
          result = verifyAnchors(ctx.db, ctx.projectRoot);
        }
        console.log(renderVerify(result));
      } finally {
        ctx.db.close();
      }
    });

  // --- stats ---
  program
    .command("stats")
    .description("show index statistics")
    .action(async () => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { notes: true, code: true, entities: true, verify: true });
        console.log(renderStats(queryStats(ctx.db)));
      } finally {
        ctx.db.close();
      }
    });

  // --- search ---
  program
    .command("search")
    .description("search notes (ranked)")
    .argument("[query]", "text query (optional for anchor-only search)")
    .option("--anchor <uri>", "anchor filter (repeatable)", collect, [] as string[])
    .option("--context <uri>", "context anchor (repeatable)", collect, [] as string[])
    .option("--archived", "include outdated notes")
    .option("--drafts", "include draft notes")
    .option("--limit <n>", "result limit", (v) => parseInt(v, 10), 20)
    .action(
      async (
        query: string | undefined,
        opts: {
          anchor: string[];
          context: string[];
          archived?: boolean;
          drafts?: boolean;
          limit: number;
        },
      ) => {
        const ctx = openCli();
        try {
          await reconcile(ctx, { notes: true, code: true, entities: true, verify: true });
          const result = search(ctx.db, {
            query,
            anchors: opts.anchor,
            context: opts.context,
            include_archived: opts.archived,
            include_drafts: opts.drafts,
            limit: opts.limit,
          });
          console.log(renderSearchResult(result));
        } finally {
          ctx.db.close();
        }
      },
    );

  // --- note ---
  const noteCmd = new Command("note").description("note management");

  noteCmd
    .command("list")
    .description("list notes")
    .option("--status <status>", "filter by status")
    .option("--entity <name>", "filter by entity anchor")
    .option("--anchor <uri>", "filter by anchor uri")
    .action(
      async (opts: { status?: string; entity?: string; anchor?: string }) => {
        const ctx = openCli();
        try {
          await reconcile(ctx, { notes: true, code: true, entities: true, verify: true });

          const conditions: string[] = [];
          const params: string[] = [];
          let fromClause = "notes n";

          const anchorUri = opts.entity
            ? `entity:${opts.entity}`
            : opts.anchor;

          if (anchorUri) {
            fromClause =
              "notes n INNER JOIN anchors a ON a.note_id = n.id";
            conditions.push("a.uri = ?");
            params.push(anchorUri);
          }
          if (opts.status) {
            conditions.push("n.status = ?");
            params.push(opts.status);
          }

          const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
          const rows = ctx.db
            .prepare(
              `SELECT DISTINCT n.id, n.summary, n.status FROM ${fromClause} ${where} ORDER BY n.updated DESC`,
            )
            .all(...params) as { id: string; summary: string; status: string }[];

          console.log(renderNoteList(rows));
        } finally {
          ctx.db.close();
        }
      },
    );

  noteCmd
    .command("show")
    .description("show note(s) in get_notes view")
    .argument("<ids...>", "note ids")
    .action(async (ids: string[]) => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { notes: true, code: true, entities: true, verify: true });
        const result = getNotes(ctx.db, ids);
        console.log(renderGetNotes(result));
      } finally {
        ctx.db.close();
      }
    });

  noteCmd
    .command("edit")
    .description("open note in $EDITOR then reindex")
    .argument("<id>", "note id")
    .action(async (id: string) => {
      const ctx = openCli();
      try {
        const filePath = join(ctx.notesDir, id + ".md");
        if (!existsSync(filePath)) throw new Error(`note "${id}" not found`);
        openInEditor(filePath);
        try {
          await reconcile(ctx, { notes: true, verify: true });
        } catch (e) {
          if (e instanceof Error) {
            throw new Error(`reindex failed after edit: ${e.message}`);
          }
          throw e;
        }
        console.log(`updated: ${id}`);
      } finally {
        ctx.db.close();
      }
    });

  noteCmd
    .command("delete")
    .description("delete a note and remove it from the index")
    .argument("<id>", "note id")
    .action(async (id: string) => {
      const ctx = openCli();
      try {
        const deleted = deleteNote(ctx.db, ctx.memoryDir, id);
        if (!deleted) {
          throw new Error(`note "${id}" not found`);
        }
        console.log(`deleted: ${id}`);
      } finally {
        ctx.db.close();
      }
    });

  noteCmd
    .command("create")
    .description("interactively create a new note")
    .action(async () => {
      const ctx = openCli();
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        await reconcile(ctx, { entities: true });

        const summary = (await rl.question("Summary: ")).trim();
        if (!summary) throw new Error("summary is required");

        let status = (await rl.question("Status [current]: ")).trim() || "current";
        if (!STATUSES.has(status)) throw new Error(`invalid status "${status}"`);

        const anchors: { uri: string; weight: AnchorWeight }[] = [];
        console.log('Anchors (enter blank URI to finish):');
        for (;;) {
          const uri = (await rl.question("  anchor URI: ")).trim();
          if (!uri) break;
          let weight = (await rl.question("  weight [core]: ")).trim() || "core";
          if (!WEIGHTS.has(weight)) throw new Error(`invalid weight "${weight}"`);
          anchors.push({ uri, weight: weight as AnchorWeight });
        }
        if (anchors.length === 0) throw new Error("at least one anchor is required");

        rl.close();
        const body = editText("");
        const note = createNote(ctx.db, ctx.memoryDir, summary, body, anchors, status as import("../core/note-store.js").NoteStatus);
        verifyAnchors(ctx.db, ctx.projectRoot, { uris: anchors.map((a) => a.uri) });
        console.log(`created: ${note.id}`);
      } finally {
        try { rl.close(); } catch { /* already closed */ }
        ctx.db.close();
      }
    });

  program.addCommand(noteCmd);

  // --- entity ---
  const entityCmd = new Command("entity").description("entity management");

  entityCmd
    .command("list")
    .description("list all entities")
    .action(async () => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { entities: true });
        const entities = readEntities(ctx.memoryDir);
        console.log(renderEntityList(entities));
      } finally {
        ctx.db.close();
      }
    });

  entityCmd
    .command("show")
    .description("show an entity")
    .argument("<name>", "entity name")
    .action(async (name: string) => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { entities: true });
        const entities = readEntities(ctx.memoryDir);
        const entity = entities.find((e) => e.name === name);
        if (!entity) throw new Error(`entity "${name}" not found`);
        console.log(renderEntity(entity));
      } finally {
        ctx.db.close();
      }
    });

  entityCmd
    .command("update")
    .description("update entity description in $EDITOR")
    .argument("<name>", "entity name")
    .action(async (name: string) => {
      const ctx = openCli();
      try {
        await reconcile(ctx, { entities: true });
        const entities = readEntities(ctx.memoryDir);
        const entity = entities.find((e) => e.name === name);
        if (!entity) throw new Error(`entity "${name}" not found`);
        const newDesc = editText(entity.description).trim();
        if (!newDesc) throw new Error("description cannot be empty");
        updateEntity(ctx.db, ctx.memoryDir, name, newDesc);
        console.log(`updated: ${name}`);
      } finally {
        ctx.db.close();
      }
    });

  entityCmd
    .command("remove")
    .description("remove an entity from the registry")
    .argument("<name>", "entity name")
    .action(async (name: string) => {
      const ctx = openCli();
      try {
        removeEntity(ctx.db, ctx.memoryDir, name);
        console.log(`removed: ${name}`);
      } finally {
        ctx.db.close();
      }
    });

  program.addCommand(entityCmd);

  program.action(async () => {
    const { runTui } = await import("./tui/run.js");
    await runTui();
  });

  return program;
}
