import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import {
  reconcileStructure,
  indexFile,
  removeFile,
} from "../src/core/structural-indexer.js";

// Sample source fixtures
const TS_SOURCE = `
export class UserService {
  private users: string[] = [];

  getUser(id: string): string | undefined {
    return this.users.find(u => u === id);
  }

  addUser(name: string): void {
    this.users.push(name);
  }
}

export interface UserRepo {
  find(id: string): string | undefined;
}

export type UserId = string;

export const formatUser = (name: string) => \`User: \${name}\`;
`;

const PY_SOURCE = `
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        pass

def standalone_func():
    return 42
`;

const GO_SOURCE = `
package main

import "fmt"

type Point struct {
    X, Y int
}

func NewPoint(x, y int) Point {
    return Point{X: x, Y: y}
}

func (p Point) String() string {
    return fmt.Sprintf("(%d,%d)", p.X, p.Y)
}
`;

const PHP_SOURCE = `<?php
class Calculator {
    public function add(int $a, int $b): int {
        return $a + $b;
    }
}

function helper(): void {}

interface Computable {
    public function compute(): int;
}
`;

const RUST_SOURCE = `
pub struct Config {
    pub name: String,
}

pub fn init() -> Config {
    Config { name: String::new() }
}

impl Config {
    pub fn validate(&self) -> bool {
        !self.name.is_empty()
    }
}
`;

const VUE_TS_SOURCE = `<template>
  <div>{{ title }}</div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);

function increment(): void {
  count.value++;
}

const formatTitle = (s: string) => \`[\${s}]\`;
</script>

<style scoped>
div { color: red; }
</style>
`;

const VUE_JS_OPTIONS_SOURCE = `<template><p /></template>

<script>
export default {
  name: "Widget",
};

function helper() {
  return 1;
}
</script>
`;

describe("structural-indexer", () => {
  let projectRoot: string;
  let db: DatabaseSync;

  function setup(): void {
    projectRoot = mkdtempSync(join(tmpdir(), "cms-si-"));
    db = openIndex(join(projectRoot, "index.db"));
  }

  afterEach(() => {
    db.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function write(relPath: string, content: string): void {
    const abs = join(projectRoot, relPath);
    mkdirSync(abs.replace(/\/[^/]+$/, ""), { recursive: true });
    writeFileSync(abs, content);
  }

  function symbols(file?: string): { name: string; kind: string; parent: string | null }[] {
    const q = file
      ? db.prepare("SELECT name, kind, parent FROM symbol_index WHERE file=? ORDER BY start_line")
      : db.prepare("SELECT name, kind, parent FROM symbol_index ORDER BY file, start_line");
    return (file ? q.all(file) : q.all()) as { name: string; kind: string; parent: string | null }[];
  }

  function fileHash(rel: string): string | undefined {
    return (
      db.prepare("SELECT content_hash FROM file_index WHERE path=?").get(rel) as
        | { content_hash: string }
        | undefined
    )?.content_hash;
  }

  function count(table: string): number {
    return (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;
  }

  // ── 1. Bootstrap: multiple languages ─────────────────────────────────────

  it("bootstrap: indexes symbols from TypeScript, Python, and Go", async () => {
    setup();
    write("app.ts", TS_SOURCE);
    write("util.py", PY_SOURCE);
    write("main.go", GO_SOURCE);

    await reconcileStructure(db, projectRoot);

    const tsSyms = symbols("app.ts");
    expect(tsSyms.map(s => s.name)).toContain("UserService");
    expect(tsSyms.map(s => s.name)).toContain("UserRepo");
    expect(tsSyms.map(s => s.name)).toContain("UserId");

    const pySyms = symbols("util.py");
    expect(pySyms.map(s => s.name)).toContain("Animal");
    expect(pySyms.map(s => s.name)).toContain("standalone_func");

    const goSyms = symbols("main.go");
    expect(goSyms.map(s => s.name)).toContain("NewPoint");
    expect(goSyms.map(s => s.name)).toContain("Point");
  });

  // ── 2. file_index populated ───────────────────────────────────────────────

  it("file_index has content_hash for each code file after bootstrap", async () => {
    setup();
    write("app.ts", TS_SOURCE);
    write("util.py", PY_SOURCE);

    await reconcileStructure(db, projectRoot);

    expect(fileHash("app.ts")).toBeTruthy();
    expect(fileHash("util.py")).toBeTruthy();
    expect(count("file_index")).toBe(2);
  });

  // ── 3. Incremental update ─────────────────────────────────────────────────

  it("incremental: changed file reindexed; unchanged file hash unchanged", async () => {
    setup();
    write("app.ts", TS_SOURCE);
    write("util.py", PY_SOURCE);

    await reconcileStructure(db, projectRoot);
    const hashPyBefore = fileHash("util.py");

    // Change app.ts
    write("app.ts", `export class NewClass { method() {} }`);
    await reconcileStructure(db, projectRoot);

    // app.ts symbols replaced
    const tsNames = symbols("app.ts").map(s => s.name);
    expect(tsNames).toContain("NewClass");
    expect(tsNames).not.toContain("UserService");

    // util.py untouched
    expect(fileHash("util.py")).toBe(hashPyBefore);
  });

  // ── 4. Deleted file ───────────────────────────────────────────────────────

  it("deleted file removed from symbol_index and file_index", async () => {
    setup();
    write("app.ts", TS_SOURCE);
    write("util.py", PY_SOURCE);

    await reconcileStructure(db, projectRoot);
    expect(count("symbol_index")).toBeGreaterThan(0);

    unlinkSync(join(projectRoot, "app.ts"));
    await reconcileStructure(db, projectRoot);

    expect(count("symbol_index") > 0).toBe(true); // util.py remains
    expect(symbols("app.ts")).toHaveLength(0);
    expect(fileHash("app.ts")).toBeUndefined();
    expect(fileHash("util.py")).toBeTruthy();
  });

  // ── 5. Unknown extension ──────────────────────────────────────────────────

  it("unknown extensions skipped without error", async () => {
    setup();
    write("notes.md", "# hello");
    write("data.txt", "some text");
    write("app.ts", "export const x = 1;");

    await expect(reconcileStructure(db, projectRoot)).resolves.not.toThrow();
    expect(count("symbol_index")).toBe(0); // const x = 1 has no def nodes except arrow-const
    expect(fileHash("notes.md")).toBeUndefined();
    expect(fileHash("data.txt")).toBeUndefined();
    expect(fileHash("app.ts")).toBeTruthy();
  });

  // ── 6. .gitignore respected ───────────────────────────────────────────────

  it(".gitignore-d directories are not indexed", async () => {
    setup();
    write(".gitignore", "dist/\nnode_modules/\n");
    write("src/app.ts", TS_SOURCE);
    write("dist/bundle.js", "class Ignored {}");
    write("node_modules/lib/index.js", "class AlsoIgnored {}");

    await reconcileStructure(db, projectRoot);

    expect(symbols("src/app.ts").map(s => s.name)).toContain("UserService");
    expect(symbols("dist/bundle.js")).toHaveLength(0);
    expect(symbols("node_modules/lib/index.js")).toHaveLength(0);
  });

  // ── 7. Parent field correct ───────────────────────────────────────────────

  it("method inside class has correct parent", async () => {
    setup();
    write("svc.ts", TS_SOURCE);

    await reconcileStructure(db, projectRoot);

    const syms = symbols("svc.ts");
    const getUser = syms.find(s => s.name === "getUser");
    expect(getUser?.kind).toBe("method");
    expect(getUser?.parent).toBe("UserService");
  });

  // ── 8. Arrow-const function ───────────────────────────────────────────────

  it("arrow-const function indexed with kind=function", async () => {
    setup();
    write("helpers.ts", TS_SOURCE);

    await reconcileStructure(db, projectRoot);

    const syms = symbols("helpers.ts");
    const formatUser = syms.find(s => s.name === "formatUser");
    expect(formatUser).toBeDefined();
    expect(formatUser?.kind).toBe("function");
  });

  // ── 9. PHP symbols ────────────────────────────────────────────────────────

  it("indexes PHP class, interface, and function", async () => {
    setup();
    write("calc.php", PHP_SOURCE);

    await reconcileStructure(db, projectRoot);

    const syms = symbols("calc.php");
    expect(syms.find(s => s.name === "Calculator")?.kind).toBe("class");
    expect(syms.find(s => s.name === "Computable")?.kind).toBe("interface");
    expect(syms.find(s => s.name === "helper")?.kind).toBe("function");
    expect(syms.find(s => s.name === "add")?.parent).toBe("Calculator");
  });

  // ── 10. Rust symbols ──────────────────────────────────────────────────────

  it("indexes Rust struct, function, impl, and method", async () => {
    setup();
    write("lib.rs", RUST_SOURCE);

    await reconcileStructure(db, projectRoot);

    const syms = symbols("lib.rs");
    expect(syms.find(s => s.name === "Config")?.kind).toBe("struct");
    expect(syms.find(s => s.name === "init")?.kind).toBe("function");
    // impl block
    const implSym = syms.find(s => s.kind === "impl");
    expect(implSym?.name).toBe("Config");
  });

  // ── 11. indexFile / removeFile (watcher API) ──────────────────────────────

  it("indexFile indexes a single file", async () => {
    setup();
    write("svc.py", PY_SOURCE);

    await indexFile(db, projectRoot, "svc.py");

    expect(symbols("svc.py").map(s => s.name)).toContain("Animal");
    expect(fileHash("svc.py")).toBeTruthy();
  });

  it("removeFile removes from symbol_index and file_index", async () => {
    setup();
    write("svc.py", PY_SOURCE);
    await indexFile(db, projectRoot, "svc.py");
    expect(count("symbol_index")).toBeGreaterThan(0);

    removeFile(db, "svc.py");

    expect(count("symbol_index")).toBe(0);
    expect(fileHash("svc.py")).toBeUndefined();
  });

  it("indexFile on unknown extension is a no-op", async () => {
    setup();
    write("readme.md", "# hello");

    await expect(indexFile(db, projectRoot, "readme.md")).resolves.not.toThrow();
    expect(count("symbol_index")).toBe(0);
  });

  // ── 12. Line numbers ─────────────────────────────────────────────────────

  it("start_line and end_line are 1-indexed", async () => {
    setup();
    write("svc.ts", TS_SOURCE);

    await reconcileStructure(db, projectRoot);

    const row = db
      .prepare("SELECT start_line, end_line FROM symbol_index WHERE file=? AND name=?")
      .get("svc.ts", "UserService") as { start_line: number; end_line: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.start_line).toBeGreaterThanOrEqual(1);
    expect(row!.end_line).toBeGreaterThan(row!.start_line);
  });

  // ── 12b. Vue SFC <script> extraction ─────────────────────────────────────

  it("indexes symbols from <script setup lang=ts> with correct line offset", async () => {
    setup();
    write("Counter.vue", VUE_TS_SOURCE);

    await reconcileStructure(db, projectRoot);

    const syms = symbols("Counter.vue");
    expect(syms.map(s => s.name)).toContain("increment");
    expect(syms.map(s => s.name)).toContain("formatTitle");
    expect(syms.find(s => s.name === "formatTitle")?.kind).toBe("function");

    // Line numbers must point into the .vue file (script block starts at line 5).
    const inc = db
      .prepare("SELECT start_line FROM symbol_index WHERE file=? AND name=?")
      .get("Counter.vue", "increment") as { start_line: number } | undefined;
    expect(inc).toBeDefined();
    expect(inc!.start_line).toBeGreaterThan(5);
    expect(fileHash("Counter.vue")).toBeTruthy();
  });

  it("indexes plain <script> (Options API) Vue SFC", async () => {
    setup();
    write("Widget.vue", VUE_JS_OPTIONS_SOURCE);

    await reconcileStructure(db, projectRoot);

    expect(symbols("Widget.vue").map(s => s.name)).toContain("helper");
  });

  it("symbol: anchor on .vue resolves after indexing (no longer stale)", async () => {
    setup();
    write("Counter.vue", VUE_TS_SOURCE);
    await reconcileStructure(db, projectRoot);

    const hit = db
      .prepare("SELECT 1 FROM symbol_index WHERE file=? AND name=? LIMIT 1")
      .get("Counter.vue", "increment");
    expect(hit).toBeTruthy();
  });

  // ── 13. Idempotent reconcile ──────────────────────────────────────────────

  it("repeated reconcile with no changes is idempotent (same row count)", async () => {
    setup();
    write("app.ts", TS_SOURCE);

    await reconcileStructure(db, projectRoot);
    const n1 = count("symbol_index");

    await reconcileStructure(db, projectRoot);
    const n2 = count("symbol_index");

    expect(n2).toBe(n1);
  });
});
