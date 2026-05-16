import type { DatabaseSync } from "node:sqlite";
import {
  type Entity,
  EntityParseError,
  isValidEntityName,
  readEntities,
  writeEntities,
} from "./entity-store.js";
import { withLock } from "./lock.js";

export function reconcileEntities(db: DatabaseSync, memoryDir: string): void {
  const entities = readEntities(memoryDir);
  const insert = db.prepare("INSERT INTO entities (name, description) VALUES (?,?)");
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM entities");
    for (const e of entities) {
      insert.run(e.name, e.description);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function createEntity(db: DatabaseSync, memoryDir: string, entity: Entity): void {
  if (!isValidEntityName(entity.name)) {
    throw new EntityParseError(`invalid entity name "${entity.name}" (must be PascalCase)`);
  }
  if (!entity.description.trim()) {
    throw new EntityParseError(`entity "${entity.name}" has empty description`);
  }
  withLock(memoryDir, () => {
    const existing = readEntities(memoryDir);
    if (existing.some((e) => e.name === entity.name)) {
      throw new Error(`entity "${entity.name}" already exists`);
    }
    const next = [...existing, entity];
    const insert = db.prepare("INSERT INTO entities (name, description) VALUES (?,?)");
    db.exec("BEGIN");
    try {
      insert.run(entity.name, entity.description);
      writeEntities(memoryDir, next);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}

export function entityExists(db: DatabaseSync, name: string): boolean {
  return db.prepare("SELECT 1 FROM entities WHERE name = ?").get(name) !== undefined;
}
