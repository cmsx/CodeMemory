import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";

export type NoteStatus = "current" | "outdated" | "draft";
export type AnchorWeight = "critical" | "core" | "supporting" | "incidental";
export type AnchorType = "file" | "symbol" | "entity" | "env";

export interface Anchor {
  uri: string;
  weight: AnchorWeight;
}

export interface Note {
  id: string;
  summary: string;
  status: NoteStatus;
  created: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD
  anchors: Anchor[];
  body: string;
}

const STATUSES = new Set<string>(["current", "outdated", "draft"]);
const WEIGHTS = new Set<string>(["critical", "core", "supporting", "incidental"]);
const ANCHOR_TYPES = new Set<string>(["file", "symbol", "entity", "env"]);

export function anchorType(uri: string): AnchorType {
  const colonIdx = uri.indexOf(":");
  const t = colonIdx >= 0 ? uri.slice(0, colonIdx) : "";
  if (!ANCHOR_TYPES.has(t)) {
    throw new Error(`invalid anchor type "${t}" in uri "${uri}"`);
  }
  return t as AnchorType;
}

export class NoteParseError extends Error {
  constructor(file: string, reason: string) {
    super(`note ${file}: ${reason}`);
    this.name = "NoteParseError";
  }
}

function toIsoDate(file: string, field: string, value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  throw new NoteParseError(file, `field "${field}" must be a date (YYYY-MM-DD), got ${JSON.stringify(value)}`);
}

export function parseNote(filename: string, raw: string): Note {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch {
    throw new NoteParseError(filename, "invalid frontmatter");
  }
  const d = parsed.data as Record<string, unknown>;

  for (const field of ["id", "summary", "status", "created", "updated"] as const) {
    if (field === "created" || field === "updated") continue;
    if (typeof d[field] !== "string" || !(d[field] as string)) {
      throw new NoteParseError(filename, `missing required field "${field}"`);
    }
  }

  const id = d["id"] as string;
  const summary = d["summary"] as string;

  const status = d["status"] as string;
  if (!STATUSES.has(status)) {
    throw new NoteParseError(filename, `invalid status "${status}"`);
  }

  const created = toIsoDate(filename, "created", d["created"]);
  const updated = toIsoDate(filename, "updated", d["updated"]);

  if (!Array.isArray(d["anchors"]) || (d["anchors"] as unknown[]).length === 0) {
    throw new NoteParseError(filename, `"anchors" must be a non-empty array`);
  }
  const anchors: Anchor[] = [];
  for (const raw of d["anchors"] as unknown[]) {
    if (typeof raw !== "object" || raw === null) {
      throw new NoteParseError(filename, `anchor must be an object with "uri" and "weight"`);
    }
    const a = raw as Record<string, unknown>;
    if (typeof a["uri"] !== "string" || !a["uri"]) {
      throw new NoteParseError(filename, `anchor missing "uri"`);
    }
    if (!WEIGHTS.has(a["weight"] as string)) {
      throw new NoteParseError(filename, `invalid anchor weight "${a["weight"]}"`);
    }
    try {
      anchorType(a["uri"] as string);
    } catch {
      const colonIdx = (a["uri"] as string).indexOf(":");
      const t = colonIdx >= 0 ? (a["uri"] as string).slice(0, colonIdx) : "";
      throw new NoteParseError(filename, `invalid anchor type "${t}" in uri "${a["uri"]}"`);
    }
    anchors.push({ uri: a["uri"] as string, weight: a["weight"] as AnchorWeight });
  }

  const expectedId = basename(filename, ".md");
  if (id !== expectedId) {
    throw new NoteParseError(filename, `id "${id}" does not match filename "${expectedId}"`);
  }

  return {
    id,
    summary,
    status: status as NoteStatus,
    created,
    updated,
    anchors,
    body: parsed.content.trim(),
  };
}

export function serializeNote(note: Note): string {
  const data = {
    id: note.id,
    summary: note.summary,
    status: note.status,
    created: note.created,
    updated: note.updated,
    anchors: note.anchors,
  };
  return matter.stringify(note.body.trim(), data);
}

export function writeNote(notesDir: string, note: Note): void {
  mkdirSync(notesDir, { recursive: true });
  const target = join(notesDir, note.id + ".md");
  const tmp = target + ".tmp";
  writeFileSync(tmp, serializeNote(note));
  renameSync(tmp, target);
}

export function readNote(notesDir: string, id: string): Note {
  const raw = readFileSync(join(notesDir, id + ".md"), "utf8");
  return parseNote(id + ".md", raw);
}

export function listNotes(notesDir: string): Note[] {
  let entries: string[];
  try {
    entries = readdirSync(notesDir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".md") && !f.endsWith(".md.tmp"))
    .sort()
    .map((f) => {
      const raw = readFileSync(join(notesDir, f), "utf8");
      return parseNote(f, raw);
    });
}
