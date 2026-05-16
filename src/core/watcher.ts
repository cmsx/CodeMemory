import chokidar from "chokidar";
import { relative } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { reconcileEntities } from "./entity-indexer.js";
import { reconcileNotes } from "./note-indexer.js";
import { createIgnoreFilter, indexFile, removeFile } from "./structural-indexer.js";
import { verifyAnchors } from "./verifier.js";

export interface WatcherParams {
  db: DatabaseSync;
  projectRoot: string;
  memoryDir: string;
  notesDir: string;
  debounceMs?: number;
}

export interface WatcherHandle {
  close(): Promise<void>;
}

interface Debounce {
  schedule(): void;
  cancel(): void;
  drain(): Promise<void>;
}

function makeDebounce(ms: number, onFlush: () => Promise<void>): Debounce {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushChain: Promise<void> = Promise.resolve();

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flushChain = flushChain.then(onFlush);
    }, ms);
  }

  function cancel(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function drain(): Promise<void> {
    cancel();
    await flushChain;
  }

  return { schedule, cancel, drain };
}

export function startWatchers(params: WatcherParams): Promise<WatcherHandle> {
  const { db, projectRoot, memoryDir, notesDir, debounceMs = 500 } = params;

  // ── Code watcher ─────────────────────────────────────────────────────────

  const shouldIgnore = createIgnoreFilter(projectRoot);
  const pendingCode = new Map<string, "upsert" | "remove">();

  const codeDebounce = makeDebounce(debounceMs, async () => {
    const snapshot = new Map(pendingCode);
    pendingCode.clear();
    if (snapshot.size === 0) return;

    const changedFiles = new Set<string>();
    for (const [rel, kind] of snapshot) {
      try {
        if (kind === "upsert") {
          await indexFile(db, projectRoot, rel);
        } else {
          removeFile(db, rel);
        }
        changedFiles.add(rel);
      } catch (err) {
        console.error("[cms/watcher] code index error", rel, err);
      }
    }

    // verify anchors that reference the changed files
    const allAnchors = db
      .prepare("SELECT DISTINCT uri, type FROM anchors WHERE type IN ('file','symbol')")
      .all() as { uri: string; type: string }[];

    const affected = allAnchors
      .filter((a) => {
        if (a.type === "file") {
          return changedFiles.has(a.uri.slice("file:".length));
        }
        // symbol:<file>::<name>
        const payload = a.uri.slice("symbol:".length);
        const idx = payload.lastIndexOf("::");
        const file = idx >= 0 ? payload.slice(0, idx) : payload;
        return changedFiles.has(file);
      })
      .map((a) => a.uri);

    if (affected.length > 0) {
      try {
        verifyAnchors(db, projectRoot, { uris: affected });
      } catch (err) {
        console.error("[cms/watcher] verify error", err);
      }
    }
  });

  const codeWatcher = chokidar.watch(projectRoot, {
    ignoreInitial: true,
    ignored: (p: string) => {
      const rel = relative(projectRoot, p).replace(/\\/g, "/");
      return shouldIgnore(rel);
    },
  });

  codeWatcher.on("add", (p: string) => {
    const rel = relative(projectRoot, p).replace(/\\/g, "/");
    pendingCode.set(rel, "upsert");
    codeDebounce.schedule();
  });
  codeWatcher.on("change", (p: string) => {
    const rel = relative(projectRoot, p).replace(/\\/g, "/");
    pendingCode.set(rel, "upsert");
    codeDebounce.schedule();
  });
  codeWatcher.on("unlink", (p: string) => {
    const rel = relative(projectRoot, p).replace(/\\/g, "/");
    pendingCode.set(rel, "remove");
    codeDebounce.schedule();
  });
  codeWatcher.on("error", (err: unknown) => {
    console.error("[cms/watcher] code watcher error", err);
  });

  // ── Memory watcher ────────────────────────────────────────────────────────

  let memoryDirty = false;

  const memDebounce = makeDebounce(debounceMs, async () => {
    if (!memoryDirty) return;
    memoryDirty = false;
    try {
      reconcileNotes(db, notesDir);
      reconcileEntities(db, memoryDir);
      verifyAnchors(db, projectRoot);
    } catch (err) {
      console.error("[cms/watcher] memory reconcile error", err);
    }
  });

  // Watch memoryDir (contains notes/ and entities.md). Watching a
  // non-existent entitiesMdPath file would cause chokidar to add parent-dir
  // watches that interfere with the code watcher; watching memoryDir avoids it.
  const memWatcher = chokidar.watch(memoryDir, {
    ignoreInitial: true,
  });

  const isRelevantMemPath = (p: string): boolean => {
    return p.endsWith(".md") && !p.endsWith(".md.tmp");
  };

  const onMemEvent = (p: string) => {
    if (!isRelevantMemPath(p)) return;
    memoryDirty = true;
    memDebounce.schedule();
  };
  memWatcher.on("add", onMemEvent);
  memWatcher.on("change", onMemEvent);
  memWatcher.on("unlink", onMemEvent);
  memWatcher.on("error", (err: unknown) => {
    console.error("[cms/watcher] memory watcher error", err);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  return new Promise<WatcherHandle>((resolve) => {
    let readyCount = 0;
    const onReady = () => {
      if (++readyCount === 2) {
        resolve({
          close: async () => {
            codeDebounce.cancel();
            memDebounce.cancel();
            await Promise.all([codeWatcher.close(), memWatcher.close()]);
            await codeDebounce.drain();
            await memDebounce.drain();
          },
        });
      }
    };
    codeWatcher.on("ready", onReady);
    memWatcher.on("ready", onReady);
  });
}
