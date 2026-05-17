import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export interface VerifyResult {
  checked: number;
  ok: number;
  stale: number;
}

// Resolves env: anchors against the union of keys across all .env* files.
// .env alone is incomplete by design: it omits variables covered by config
// defaults, which would mark a valid optional-override anchor as stale.
function parseEnvKeys(projectRoot: string): Set<string> {
  const keys = new Set<string>();
  let entries: string[];
  try {
    entries = readdirSync(projectRoot);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return keys;
    throw e;
  }
  for (const name of entries) {
    if (name !== ".env" && !name.startsWith(".env.")) continue;
    let raw: string;
    try {
      raw = readFileSync(join(projectRoot, name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) keys.add(m[1]);
    }
  }
  return keys;
}

function parseSymbolUri(
  uri: string
): { file: string; parent: string | null; name: string } | null {
  const payload = uri.slice("symbol:".length);
  const idx = payload.lastIndexOf("::");
  if (idx < 0) return null;
  const file = payload.slice(0, idx);
  const symbol = payload.slice(idx + 2);
  // Dotted form `Parent.Member` — symbol_index stores parent and bare name
  // in separate columns.
  const dot = symbol.lastIndexOf(".");
  if (dot > 0) {
    return { file, parent: symbol.slice(0, dot), name: symbol.slice(dot + 1) };
  }
  return { file, parent: null, name: symbol };
}

export function verifyAnchors(
  db: DatabaseSync,
  projectRoot: string,
  opts?: { uris?: string[] }
): VerifyResult {
  let rows: { uri: string; type: string }[];
  if (opts?.uris && opts.uris.length > 0) {
    const placeholders = opts.uris.map(() => "?").join(",");
    rows = db
      .prepare(`SELECT DISTINCT uri, type FROM anchors WHERE uri IN (${placeholders})`)
      .all(...opts.uris) as { uri: string; type: string }[];
  } else {
    rows = db
      .prepare("SELECT DISTINCT uri, type FROM anchors")
      .all() as { uri: string; type: string }[];
  }

  if (rows.length === 0) return { checked: 0, ok: 0, stale: 0 };

  // Pre-load entity names
  const entityNames = new Set<string>(
    (db.prepare("SELECT name FROM entities").all() as { name: string }[]).map(
      (r) => r.name
    )
  );

  // Pre-load env keys (lazy — only if any env: anchor present)
  let envKeys: Set<string> | null = null;

  const symbolStmt = db.prepare(
    "SELECT 1 FROM symbol_index WHERE file = ? AND name = ? LIMIT 1"
  );
  const symbolWithParentStmt = db.prepare(
    "SELECT 1 FROM symbol_index WHERE file = ? AND parent = ? AND name = ? LIMIT 1"
  );

  const updates: { uri: string; status: "ok" | "stale" }[] = [];

  for (const row of rows) {
    const { uri, type } = row;
    const payload = uri.slice(type.length + 1);
    let status: "ok" | "stale";

    if (!payload) {
      status = "stale";
    } else if (type === "file") {
      status = existsSync(join(projectRoot, payload)) ? "ok" : "stale";
    } else if (type === "symbol") {
      const parsed = parseSymbolUri(uri);
      if (!parsed) {
        status = "stale";
      } else {
        const hit =
          parsed.parent !== null
            ? symbolWithParentStmt.get(parsed.file, parsed.parent, parsed.name)
            : symbolStmt.get(parsed.file, parsed.name);
        status = hit ? "ok" : "stale";
      }
    } else if (type === "entity") {
      status = entityNames.has(payload) ? "ok" : "stale";
    } else {
      // env
      if (!envKeys) envKeys = parseEnvKeys(projectRoot);
      status = envKeys.has(payload) ? "ok" : "stale";
    }

    updates.push({ uri, status });
  }

  const updateStmt = db.prepare("UPDATE anchors SET anchor_status = ? WHERE uri = ?");

  db.exec("BEGIN");
  try {
    for (const { uri, status } of updates) {
      updateStmt.run(status, uri);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const ok = updates.filter((u) => u.status === "ok").length;
  const stale = updates.length - ok;
  return { checked: updates.length, ok, stale };
}
