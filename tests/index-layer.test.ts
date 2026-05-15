import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex, SCHEMA_VERSION } from "../src/core/index-layer.js";

function tableExists(db: DatabaseSync, name: string): boolean {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
}

function pragma<T>(db: DatabaseSync, name: string): T {
  return (db.prepare(`PRAGMA ${name}`).get() as Record<string, T>)[name];
}

describe("openIndex", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function open(): DatabaseSync {
    dir = mkdtempSync(join(tmpdir(), "cms-"));
    return (db = openIndex(join(dir, ".memory", "index.db")));
  }

  it("WAL mode is enabled", () => {
    open();
    expect(pragma<string>(db, "journal_mode")).toBe("wal");
  });

  it("foreign_keys are ON", () => {
    open();
    expect(pragma<number>(db, "foreign_keys")).toBe(1);
  });

  it("user_version equals SCHEMA_VERSION", () => {
    open();
    expect(pragma<number>(db, "user_version")).toBe(SCHEMA_VERSION);
  });

  it("all tables exist", () => {
    open();
    for (const name of [
      "notes",
      "anchors",
      "entities",
      "symbol_index",
      "file_index",
      "notes_fts",
    ]) {
      expect(tableExists(db, name), `table ${name} missing`).toBe(true);
    }
  });

  it("anchor_idf view exists", () => {
    open();
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='view' AND name='anchor_idf'")
      .get();
    expect(row).toBeTruthy();
  });

  it("second open on same path does not throw and preserves data", () => {
    open();
    const path = join(dir, ".memory", "index.db");
    db.prepare(
      "INSERT INTO notes VALUES ('2024-01-01-test','s','current','2024-01-01','2024-01-01','body','hash')"
    ).run();
    db.close();

    db = openIndex(path);
    expect(tableExists(db, "notes")).toBe(true);
    const row = db.prepare("SELECT id FROM notes WHERE id='2024-01-01-test'").get();
    expect(row).toBeTruthy();
  });

  it("FK cascade deletes anchors when note is deleted", () => {
    open();
    db.prepare(
      "INSERT INTO notes VALUES ('2024-01-01-a','s','current','2024-01-01','2024-01-01','body','h')"
    ).run();
    db.prepare(
      "INSERT INTO anchors (note_id,uri,type,weight) VALUES ('2024-01-01-a','file:src/foo.ts','file','core')"
    ).run();
    db.prepare("DELETE FROM notes WHERE id='2024-01-01-a'").run();
    const count = (db.prepare("SELECT COUNT(*) AS n FROM anchors").get() as { n: number }).n;
    expect(count).toBe(0);
  });

  it("CHECK rejects invalid status in notes", () => {
    open();
    expect(() =>
      db
        .prepare(
          "INSERT INTO notes VALUES ('x','s','bogus','2024-01-01','2024-01-01','b','h')"
        )
        .run()
    ).toThrow();
  });

  it("CHECK rejects invalid weight in anchors", () => {
    open();
    db.prepare(
      "INSERT INTO notes VALUES ('2024-01-01-b','s','current','2024-01-01','2024-01-01','b','h')"
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO anchors (note_id,uri,type,weight) VALUES ('2024-01-01-b','file:x','file','bogus')"
        )
        .run()
    ).toThrow();
  });

  it("CHECK rejects invalid type in anchors", () => {
    open();
    db.prepare(
      "INSERT INTO notes VALUES ('2024-01-01-c','s','current','2024-01-01','2024-01-01','b','h')"
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO anchors (note_id,uri,type,weight) VALUES ('2024-01-01-c','file:x','bogus','core')"
        )
        .run()
    ).toThrow();
  });

  it("anchor_idf counts file/symbol anchors and excludes entity anchors", () => {
    open();
    db.prepare(
      "INSERT INTO notes VALUES ('2024-01-01-d','s','current','2024-01-01','2024-01-01','b','h')"
    ).run();
    const insert = db.prepare(
      "INSERT INTO anchors (note_id,uri,type,weight) VALUES (?,?,?,?)"
    );
    insert.run("2024-01-01-d", "file:src/foo.ts", "file", "core");
    insert.run("2024-01-01-d", "file:src/foo.ts", "file", "supporting");
    insert.run("2024-01-01-d", "entity:MyService", "entity", "core");

    const row = db
      .prepare("SELECT df FROM anchor_idf WHERE uri='file:src/foo.ts'")
      .get() as { df: number } | undefined;
    expect(row?.df).toBe(2);

    const entityRow = db
      .prepare("SELECT COUNT(*) AS n FROM anchor_idf WHERE uri LIKE 'entity:%'")
      .get() as { n: number };
    expect(entityRow.n).toBe(0);
  });

  it("notes_fts accepts MATCH queries", () => {
    open();
    db.prepare("INSERT INTO notes_fts (id,summary,body) VALUES (?,?,?)").run(
      "2024-01-01-e",
      "auth middleware refactor",
      "details about auth"
    );
    const row = db
      .prepare("SELECT id FROM notes_fts WHERE notes_fts MATCH ?")
      .get("middleware");
    expect((row as { id: string } | undefined)?.id).toBe("2024-01-01-e");
  });
});
