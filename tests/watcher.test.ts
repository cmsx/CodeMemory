import { afterEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import { indexFile } from "../src/core/structural-indexer.js";
import { type Note, serializeNote } from "../src/core/note-store.js";
import { startWatchers, type WatcherHandle } from "../src/core/watcher.js";

const DEBOUNCE = 40;

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error("waitFor timed out");
}

function makeNote(id: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    summary: `Note ${id}`,
    status: "current",
    created: "2024-01-01",
    updated: "2024-01-02",
    anchors: [{ uri: `file:src/app.ts`, weight: "core" }],
    body: "## Body\n\nSome content.",
    ...overrides,
  };
}

describe("watcher", () => {
  let projectRoot: string;
  let db: DatabaseSync;
  let handle: WatcherHandle | null;

  function setup(): { notesDir: string; memoryDir: string } {
    projectRoot = mkdtempSync(join(tmpdir(), "cms-w-"));
    const memoryDir = join(projectRoot, ".memory");
    const notesDir = join(memoryDir, "notes");
    mkdirSync(notesDir, { recursive: true });
    db = openIndex(join(memoryDir, "index.db"));
    return { notesDir, memoryDir };
  }

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = null;
    }
    db.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function countIn(table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }

  function symbolsFor(file: string): string[] {
    return (
      db
        .prepare("SELECT name FROM symbol_index WHERE file = ?")
        .all(file) as { name: string }[]
    ).map((r) => r.name);
  }

  // ── 1. Code file change → symbol_index updated ───────────────────────────

  it("code change: added symbols appear in symbol_index", async () => {
    const { notesDir, memoryDir } = setup();
    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    writeFileSync(join(projectRoot, "app.ts"), "export class Alpha { run() {} }");
    await waitFor(() => symbolsFor("app.ts").includes("Alpha"));
    expect(symbolsFor("app.ts")).toContain("Alpha");
  });

  it("code change: updated file replaces symbols", async () => {
    const { notesDir, memoryDir } = setup();
    writeFileSync(join(projectRoot, "app.ts"), "export class OldClass {}");
    await indexFile(db, projectRoot, "app.ts");
    expect(symbolsFor("app.ts")).toContain("OldClass");

    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    writeFileSync(join(projectRoot, "app.ts"), "export class NewClass {}");
    await waitFor(() => symbolsFor("app.ts").includes("NewClass"));
    expect(symbolsFor("app.ts")).not.toContain("OldClass");
  });

  // ── 2. Code file delete → removed from index ─────────────────────────────

  it("code unlink: file removed from symbol_index and file_index", async () => {
    const { notesDir, memoryDir } = setup();
    writeFileSync(join(projectRoot, "lib.ts"), "export class Lib {}");
    await indexFile(db, projectRoot, "lib.ts");
    expect(symbolsFor("lib.ts")).toContain("Lib");

    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    unlinkSync(join(projectRoot, "lib.ts"));
    await waitFor(() => symbolsFor("lib.ts").length === 0);
    expect(
      db.prepare("SELECT 1 FROM file_index WHERE path = ?").get("lib.ts"),
    ).toBeUndefined();
  });

  // ── 3. Note .md change → notes table updated ─────────────────────────────

  it("memory change: updated note body reflected in notes table", async () => {
    const { notesDir, memoryDir } = setup();
    const note = makeNote("2024-01-01-test");
    writeFileSync(join(notesDir, "2024-01-01-test.md"), serializeNote(note));

    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    const updated = { ...note, body: "## Updated\n\nNew content." };
    writeFileSync(join(notesDir, "2024-01-01-test.md"), serializeNote(updated));

    await waitFor(() => {
      const row = db
        .prepare("SELECT body FROM notes WHERE id = ?")
        .get("2024-01-01-test") as { body: string } | undefined;
      return row?.body?.includes("New content.") ?? false;
    });
    const row = db.prepare("SELECT body FROM notes WHERE id = ?").get("2024-01-01-test") as { body: string };
    expect(row.body).toContain("New content.");
  });

  // ── 4. Note with new anchor → anchor_status verified (not 'unknown') ──────

  it("memory change: new symbol anchor gets verified status after reconcile", async () => {
    const { notesDir, memoryDir } = setup();
    // Index the symbol first so it exists in symbol_index
    writeFileSync(join(projectRoot, "svc.ts"), "export class AuthService {}");
    await indexFile(db, projectRoot, "svc.ts");

    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    const note = makeNote("2024-01-02-anchor-test", {
      anchors: [{ uri: "symbol:svc.ts::AuthService", weight: "core" }],
    });
    writeFileSync(join(notesDir, "2024-01-02-anchor-test.md"), serializeNote(note));

    await waitFor(() => {
      const row = db
        .prepare("SELECT anchor_status FROM anchors WHERE uri = ?")
        .get("symbol:svc.ts::AuthService") as { anchor_status: string } | undefined;
      return row?.anchor_status === "ok";
    });
    const row = db.prepare("SELECT anchor_status FROM anchors WHERE uri = ?").get("symbol:svc.ts::AuthService") as { anchor_status: string };
    expect(row.anchor_status).toBe("ok");
  });

  // ── 5. entities.md change → entities table updated ───────────────────────

  it("memory change: entities.md edit reflected in entities table", async () => {
    const { notesDir, memoryDir } = setup();
    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    const entitiesContent = "## AuthService\n\nHandles authentication.\n";
    writeFileSync(join(memoryDir, "entities.md"), entitiesContent);

    await waitFor(() => {
      const row = db.prepare("SELECT 1 FROM entities WHERE name = ?").get("AuthService");
      return row !== undefined;
    });
    expect(db.prepare("SELECT 1 FROM entities WHERE name = ?").get("AuthService")).toBeDefined();
  });

  // ── 6. Code change → stale anchor detected ───────────────────────────────

  it("code change: removed symbol causes symbol anchor to go stale", async () => {
    const { notesDir, memoryDir } = setup();
    // Pre-index util.ts with Helper symbol
    writeFileSync(join(projectRoot, "util.ts"), "export class Helper {}");
    await indexFile(db, projectRoot, "util.ts");

    handle = await startWatchers({ db, projectRoot, memoryDir, notesDir, debounceMs: DEBOUNCE });

    // Write note AFTER watcher is ready so memory watcher picks it up (add event)
    const note = makeNote("2024-01-03-stale", {
      anchors: [{ uri: "symbol:util.ts::Helper", weight: "core" }],
    });
    writeFileSync(join(notesDir, "2024-01-03-stale.md"), serializeNote(note));

    // Wait for memory watcher to index the note and verify the anchor
    await waitFor(() => {
      return db.prepare("SELECT 1 FROM anchors WHERE uri = ?").get("symbol:util.ts::Helper") !== undefined;
    });

    // Now change util.ts so Helper no longer exists
    writeFileSync(join(projectRoot, "util.ts"), "export class Renamed {}");

    await waitFor(() => {
      const row = db
        .prepare("SELECT anchor_status FROM anchors WHERE uri = ?")
        .get("symbol:util.ts::Helper") as { anchor_status: string } | undefined;
      return row?.anchor_status === "stale";
    });
    const row = db.prepare("SELECT anchor_status FROM anchors WHERE uri = ?").get("symbol:util.ts::Helper") as { anchor_status: string };
    expect(row.anchor_status).toBe("stale");
  });
});
