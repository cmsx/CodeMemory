import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, relative } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import Parser from "web-tree-sitter";
import ignore from "ignore";

interface LangConfig {
  grammar: string;
  defNodes: Record<string, string>;
}

const LANGS: Record<string, LangConfig> = {
  javascript: {
    grammar: "javascript",
    defNodes: {
      class_declaration: "class",
      function_declaration: "function",
      generator_function_declaration: "function",
      method_definition: "method",
    },
  },
  typescript: {
    grammar: "typescript",
    defNodes: {
      class_declaration: "class",
      abstract_class_declaration: "class",
      function_declaration: "function",
      generator_function_declaration: "function",
      method_definition: "method",
      interface_declaration: "interface",
      type_alias_declaration: "type",
      enum_declaration: "enum",
    },
  },
  tsx: {
    grammar: "tsx",
    defNodes: {
      class_declaration: "class",
      abstract_class_declaration: "class",
      function_declaration: "function",
      generator_function_declaration: "function",
      method_definition: "method",
      interface_declaration: "interface",
      type_alias_declaration: "type",
      enum_declaration: "enum",
    },
  },
  python: {
    grammar: "python",
    defNodes: {
      class_definition: "class",
      function_definition: "function",
    },
  },
  php: {
    grammar: "php",
    defNodes: {
      class_declaration: "class",
      interface_declaration: "interface",
      trait_declaration: "trait",
      enum_declaration: "enum",
      function_definition: "function",
      method_declaration: "method",
    },
  },
  go: {
    grammar: "go",
    defNodes: {
      function_declaration: "function",
      method_declaration: "method",
      type_spec: "type",
    },
  },
  rust: {
    grammar: "rust",
    defNodes: {
      function_item: "function",
      struct_item: "struct",
      enum_item: "enum",
      trait_item: "trait",
      mod_item: "module",
      impl_item: "impl",
    },
  },
};

const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".php": "php",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
};

// Vue SFC: not a tree-sitter grammar of its own — we extract the <script>
// block(s) and parse their contents with the JS/TS grammar.
const VUE_EXT = ".vue";

function isIndexable(ext: string): boolean {
  return ext === VUE_EXT || EXT_TO_LANG[ext] !== undefined;
}

// JS/TS/TSX languages where we also extract arrow-const functions
const ARROW_LANGS = new Set(["javascript", "typescript", "tsx"]);

let parserInited = false;
const langCache = new Map<string, Parser.Language>();

function grammarPath(grammar: string): string {
  const pkg = createRequire(import.meta.url).resolve("tree-sitter-wasms/package.json");
  return join(dirname(pkg), "out", `tree-sitter-${grammar}.wasm`);
}

async function getParser(langKey: string): Promise<Parser> {
  if (!parserInited) {
    await Parser.init();
    parserInited = true;
  }
  let lang = langCache.get(langKey);
  if (!lang) {
    lang = await Parser.Language.load(grammarPath(LANGS[langKey].grammar));
    langCache.set(langKey, lang);
  }
  const p = new Parser();
  p.setLanguage(lang);
  return p;
}

interface SymbolRow {
  name: string;
  kind: string;
  parent: string | null;
  startLine: number;
  endLine: number;
}

function nodeName(node: Parser.SyntaxNode): string | undefined {
  // impl_item has no 'name' field — use 'type' field instead
  return (
    node.childForFieldName("name")?.text ?? node.childForFieldName("type")?.text
  );
}

function nodeParent(node: Parser.SyntaxNode, defTypes: Set<string>): string | null {
  let cur = node.parent;
  while (cur) {
    if (defTypes.has(cur.type)) return nodeName(cur) ?? null;
    cur = cur.parent;
  }
  return null;
}

// Extract <script> / <script setup> blocks from a Vue SFC. Each block carries
// its JS/TS lang and the 0-based line offset of its first content line, so
// symbol line numbers map back to the .vue file.
function extractVueScripts(
  source: string
): { langKey: string; content: string; lineOffset: number }[] {
  const blocks: { langKey: string; content: string; lineOffset: number }[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const attrs = m[1];
    const content = m[2];
    const langMatch = attrs.match(/\blang\s*=\s*["']([^"']+)["']/i);
    const lang = (langMatch?.[1] ?? "js").toLowerCase();
    const langKey =
      lang === "ts" || lang === "typescript"
        ? "typescript"
        : lang === "tsx"
          ? "tsx"
          : "javascript";
    // Content starts right after the opening tag `<script${attrs}>`.
    const openTagLen = "<script".length + attrs.length + ">".length;
    const contentStart = m.index + openTagLen;
    let lineOffset = 0;
    for (let i = 0; i < contentStart; i++) {
      if (source.charCodeAt(i) === 10 /* \n */) lineOffset++;
    }
    blocks.push({ langKey, content, lineOffset });
  }
  return blocks;
}

async function parseSymbols(langKey: string, source: string): Promise<SymbolRow[]> {
  const cfg = LANGS[langKey];
  const parser = await getParser(langKey);
  const tree = parser.parse(source);
  if (!tree) return [];

  const root = tree.rootNode;
  const defTypes = new Set(Object.keys(cfg.defNodes));
  const rows: SymbolRow[] = [];

  for (const node of root.descendantsOfType([...defTypes])) {
    const name = nodeName(node);
    if (!name) continue;
    rows.push({
      name,
      kind: cfg.defNodes[node.type],
      parent: nodeParent(node, defTypes),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  }

  // Arrow/function consts: const foo = () => {} / const foo = function() {}
  if (ARROW_LANGS.has(langKey)) {
    const ARROW_VALUE_TYPES = new Set([
      "arrow_function",
      "function",
      "function_expression",
    ]);
    for (const node of root.descendantsOfType(["variable_declarator"])) {
      const valueType = node.childForFieldName("value")?.type;
      if (!valueType || !ARROW_VALUE_TYPES.has(valueType)) continue;
      const name = node.childForFieldName("name")?.text;
      if (!name) continue;
      rows.push({
        name,
        kind: "function",
        parent: nodeParent(node, defTypes),
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
  }

  return rows;
}

async function extractSymbols(relPath: string, source: string): Promise<SymbolRow[]> {
  const ext = extname(relPath).toLowerCase();

  if (ext === VUE_EXT) {
    const out: SymbolRow[] = [];
    for (const blk of extractVueScripts(source)) {
      for (const r of await parseSymbols(blk.langKey, blk.content)) {
        out.push({
          ...r,
          startLine: r.startLine + blk.lineOffset,
          endLine: r.endLine + blk.lineOffset,
        });
      }
    }
    return out;
  }

  const langKey = EXT_TO_LANG[ext];
  if (!langKey) return [];
  return parseSymbols(langKey, source);
}

export const ALWAYS_SKIP = new Set([".git", ".memory"]);

export function createIgnoreFilter(projectRoot: string): (rel: string) => boolean {
  const gitignorePath = join(projectRoot, ".gitignore");
  const gitignoreContent = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";
  const ig = ignore().add(gitignoreContent);
  return (rel: string): boolean => {
    if (!rel) return false;
    const first = rel.split("/")[0];
    if (ALWAYS_SKIP.has(first)) return true;
    return ig.ignores(rel);
  };
}

function listCodeFiles(projectRoot: string): string[] {
  const shouldIgnore = createIgnoreFilter(projectRoot);
  const results: string[] = [];

  function walk(absDir: string): void {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const abs = join(absDir, entry.name);
      const rel = relative(projectRoot, abs).replace(/\\/g, "/");
      if (shouldIgnore(rel)) continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        if (isIndexable(extname(entry.name).toLowerCase())) {
          results.push(rel);
        }
      }
    }
  }

  walk(projectRoot);
  return results;
}

export function contentHashFile(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export async function reconcileStructure(
  db: DatabaseSync,
  projectRoot: string
): Promise<void> {
  const files = listCodeFiles(projectRoot);

  // Load current file_index
  const indexed = new Map<string, string>();
  for (const row of db
    .prepare("SELECT path, content_hash FROM file_index")
    .all() as { path: string; content_hash: string }[]) {
    indexed.set(row.path, row.content_hash);
  }

  // Phase 1: hash all files (sync)
  const seen = new Set<string>();
  const changed: { rel: string; raw: string; h: string }[] = [];

  for (const rel of files) {
    seen.add(rel);
    const raw = readFileSync(join(projectRoot, rel), "utf8");
    const h = contentHashFile(raw);
    if (indexed.get(rel) !== h) {
      changed.push({ rel, raw, h });
    }
  }

  // Phase 2: parse changed files (async)
  const results: { rel: string; h: string; symbols: SymbolRow[] }[] = [];
  for (const { rel, raw, h } of changed) {
    const symbols = await extractSymbols(rel, raw);
    results.push({ rel, h, symbols });
  }

  // Phase 3: write (single sync transaction)
  const insertSymbol = db.prepare(
    "INSERT INTO symbol_index (file, name, kind, parent, start_line, end_line) VALUES (?,?,?,?,?,?)"
  );
  const upsertFile = db.prepare(
    "INSERT OR REPLACE INTO file_index (path, content_hash) VALUES (?,?)"
  );

  db.exec("BEGIN");
  try {
    for (const { rel, h, symbols } of results) {
      db.prepare("DELETE FROM symbol_index WHERE file = ?").run(rel);
      for (const s of symbols) {
        insertSymbol.run(rel, s.name, s.kind, s.parent ?? null, s.startLine, s.endLine);
      }
      upsertFile.run(rel, h);
    }
    for (const path of indexed.keys()) {
      if (!seen.has(path)) {
        db.prepare("DELETE FROM symbol_index WHERE file = ?").run(path);
        db.prepare("DELETE FROM file_index WHERE path = ?").run(path);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export async function indexFile(
  db: DatabaseSync,
  projectRoot: string,
  relPath: string
): Promise<void> {
  const ext = extname(relPath).toLowerCase();
  if (!isIndexable(ext)) return;

  const raw = readFileSync(join(projectRoot, relPath), "utf8");
  const h = contentHashFile(raw);
  const symbols = await extractSymbols(relPath, raw);

  const insertSymbol = db.prepare(
    "INSERT INTO symbol_index (file, name, kind, parent, start_line, end_line) VALUES (?,?,?,?,?,?)"
  );

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM symbol_index WHERE file = ?").run(relPath);
    for (const s of symbols) {
      insertSymbol.run(relPath, s.name, s.kind, s.parent ?? null, s.startLine, s.endLine);
    }
    db.prepare("INSERT OR REPLACE INTO file_index (path, content_hash) VALUES (?,?)").run(
      relPath,
      h
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function removeFile(db: DatabaseSync, relPath: string): void {
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM symbol_index WHERE file = ?").run(relPath);
    db.prepare("DELETE FROM file_index WHERE path = ?").run(relPath);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
