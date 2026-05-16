import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../core/index-layer.js";
import { reconcileEntities } from "../core/entity-indexer.js";
import { reconcileNotes } from "../core/note-indexer.js";
import { reconcileStructure } from "../core/structural-indexer.js";
import { verifyAnchors } from "../core/verifier.js";

export interface CliCtx {
  db: DatabaseSync;
  projectRoot: string;
  memoryDir: string;
  notesDir: string;
}

export function openCli(): CliCtx {
  const projectRoot = process.env.CMS_PROJECT_ROOT ?? process.cwd();
  const memoryDir = join(projectRoot, ".memory");
  const notesDir = join(memoryDir, "notes");
  const dbPath = join(memoryDir, "index.db");
  const db = openIndex(dbPath);
  return { db, projectRoot, memoryDir, notesDir };
}

export interface ReconcileScope {
  notes?: boolean;
  code?: boolean;
  entities?: boolean;
  verify?: boolean;
}

export async function reconcile(ctx: CliCtx, scope: ReconcileScope): Promise<void> {
  if (scope.entities) reconcileEntities(ctx.db, ctx.memoryDir);
  if (scope.notes) reconcileNotes(ctx.db, ctx.notesDir);
  if (scope.code) await reconcileStructure(ctx.db, ctx.projectRoot);
  if (scope.verify) verifyAnchors(ctx.db, ctx.projectRoot);
}
