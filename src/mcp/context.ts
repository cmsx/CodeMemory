import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../core/index-layer.js";
import { reconcileEntities } from "../core/entity-indexer.js";
import { reconcileNotes } from "../core/note-indexer.js";
import { reconcileStructure } from "../core/structural-indexer.js";
import { verifyAnchors } from "../core/verifier.js";

export interface McpCtx {
  db: DatabaseSync;
  projectRoot: string;
  memoryDir: string;
  notesDir: string;
}

export function openMcp(): McpCtx {
  const projectRoot = process.env.CMS_PROJECT_ROOT ?? process.cwd();
  const memoryDir = join(projectRoot, ".memory");
  const notesDir = join(memoryDir, "notes");
  const db = openIndex(join(memoryDir, "index.db"));
  return { db, projectRoot, memoryDir, notesDir };
}

export async function reconcileAll(ctx: McpCtx): Promise<void> {
  reconcileEntities(ctx.db, ctx.memoryDir);
  reconcileNotes(ctx.db, ctx.notesDir);
  await reconcileStructure(ctx.db, ctx.projectRoot);
  verifyAnchors(ctx.db, ctx.projectRoot);
}
