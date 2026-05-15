import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id           TEXT PRIMARY KEY,
  summary      TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('current','outdated','draft')),
  created      TEXT NOT NULL,
  updated      TEXT NOT NULL,
  body         TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anchors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id       TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  uri           TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('file','symbol','entity','env')),
  weight        TEXT NOT NULL CHECK (weight IN ('critical','core','supporting','incidental')),
  anchor_status TEXT NOT NULL DEFAULT 'unknown' CHECK (anchor_status IN ('ok','stale','unknown'))
);
CREATE INDEX IF NOT EXISTS idx_anchors_note ON anchors(note_id);
CREATE INDEX IF NOT EXISTS idx_anchors_uri  ON anchors(uri);
CREATE INDEX IF NOT EXISTS idx_anchors_type ON anchors(type);

CREATE TABLE IF NOT EXISTS entities (
  name        TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_index (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file       TEXT NOT NULL,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  parent     TEXT,
  start_line INTEGER NOT NULL,
  end_line   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_symbol_file ON symbol_index(file);
CREATE INDEX IF NOT EXISTS idx_symbol_name ON symbol_index(name);

CREATE TABLE IF NOT EXISTS file_index (
  path         TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  id UNINDEXED,
  summary,
  body
);

CREATE VIEW IF NOT EXISTS anchor_idf AS
  SELECT uri, COUNT(*) AS df
  FROM anchors
  WHERE type IN ('file','symbol')
  GROUP BY uri;
`;

export function openIndex(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}
