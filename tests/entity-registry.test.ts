import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openIndex } from "../src/core/index-layer.js";
import {
  createEntity,
  entityExists,
  reconcileEntities,
  removeEntity,
  updateEntity,
} from "../src/core/entity-indexer.js";
import {
  type Entity,
  EntityParseError,
  parseEntities,
  readEntities,
  serializeEntities,
  writeEntities,
} from "../src/core/entity-store.js";

const SAMPLE: Entity[] = [
  { name: "Cart", description: "Pre-checkout item collection." },
  { name: "Order", description: "Customer purchase aggregate." },
];

describe("entity-store", () => {
  describe("parseEntities", () => {
    it("round-trip: serialize → parse yields sorted input", () => {
      const result = parseEntities(serializeEntities(SAMPLE));
      const sorted = [...SAMPLE].sort((a, b) => (a.name < b.name ? -1 : 1));
      expect(result).toEqual(sorted);
    });

    it("ignores top-level # heading and preamble before first ##", () => {
      const raw = "# Domain Entities\n\nSome preamble text.\n\n## Cart\n\nItems.\n";
      expect(parseEntities(raw)).toEqual([{ name: "Cart", description: "Items." }]);
    });

    it("preserves multiline description", () => {
      const raw = "## Order\n\nLine one.\nLine two.\nLine three.\n";
      expect(parseEntities(raw)[0].description).toBe("Line one.\nLine two.\nLine three.");
    });

    it("empty input returns []", () => {
      expect(parseEntities("")).toEqual([]);
      expect(parseEntities("# Domain Entities\n")).toEqual([]);
    });

    it("invalid name (lowercase) throws EntityParseError", () => {
      const raw = "## order\n\nA description.\n";
      expect(() => parseEntities(raw)).toThrowError(EntityParseError);
    });

    it("invalid name (kebab-case) throws EntityParseError", () => {
      const raw = "## My-Entity\n\nA description.\n";
      expect(() => parseEntities(raw)).toThrowError(EntityParseError);
    });

    it("invalid name (starts with digit) throws EntityParseError", () => {
      const raw = "## 2Things\n\nA description.\n";
      expect(() => parseEntities(raw)).toThrowError(EntityParseError);
    });

    it("duplicate name throws EntityParseError", () => {
      const raw = "## Order\n\nFirst.\n\n## Order\n\nSecond.\n";
      expect(() => parseEntities(raw)).toThrowError(EntityParseError);
    });

    it("empty description throws EntityParseError", () => {
      const raw = "## Order\n\n## Cart\n\nItems.\n";
      expect(() => parseEntities(raw)).toThrowError(EntityParseError);
    });
  });

  describe("serializeEntities", () => {
    it("sorts by name", () => {
      const raw = serializeEntities([
        { name: "Order", description: "An order." },
        { name: "Cart", description: "A cart." },
      ]);
      expect(raw.indexOf("## Cart")).toBeLessThan(raw.indexOf("## Order"));
    });

    it("output starts with # Domain Entities header", () => {
      expect(serializeEntities(SAMPLE)).toMatch(/^# Domain Entities\n/);
    });
  });

  describe("readEntities / writeEntities", () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("round-trip via filesystem", () => {
      dir = mkdtempSync(join(tmpdir(), "cms-es-"));
      writeEntities(dir, SAMPLE);
      const result = readEntities(dir);
      const sorted = [...SAMPLE].sort((a, b) => (a.name < b.name ? -1 : 1));
      expect(result).toEqual(sorted);
    });

    it("writeEntities removes .tmp", () => {
      dir = mkdtempSync(join(tmpdir(), "cms-es-"));
      writeEntities(dir, SAMPLE);
      expect(existsSync(join(dir, "entities.md.tmp"))).toBe(false);
    });

    it("readEntities returns [] when file absent", () => {
      dir = mkdtempSync(join(tmpdir(), "cms-es-"));
      expect(readEntities(dir)).toEqual([]);
    });
  });
});

describe("entity-indexer", () => {
  let dir: string;
  let db: DatabaseSync;

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function setup(): { memoryDir: string } {
    dir = mkdtempSync(join(tmpdir(), "cms-ei-"));
    db = openIndex(join(dir, "index.db"));
    return { memoryDir: join(dir, ".memory") };
  }

  function countEntities(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM entities").get() as { n: number }).n;
  }

  describe("reconcileEntities", () => {
    it("bootstrap: empty index + entities.md → rows in table", () => {
      const { memoryDir } = setup();
      writeEntities(memoryDir, SAMPLE);
      reconcileEntities(db, memoryDir);
      expect(countEntities()).toBe(SAMPLE.length);
    });

    it("reflects file after edit (wholesale rebuild)", () => {
      const { memoryDir } = setup();
      writeEntities(memoryDir, SAMPLE);
      reconcileEntities(db, memoryDir);
      expect(countEntities()).toBe(2);

      writeEntities(memoryDir, [SAMPLE[0]]);
      reconcileEntities(db, memoryDir);
      expect(countEntities()).toBe(1);
    });

    it("does not throw when entities.md absent", () => {
      const { memoryDir } = setup();
      expect(() => reconcileEntities(db, memoryDir)).not.toThrow();
      expect(countEntities()).toBe(0);
    });
  });

  describe("createEntity", () => {
    it("adds row to table and writes entities.md", () => {
      const { memoryDir } = setup();
      createEntity(db, memoryDir, { name: "Order", description: "A purchase." });
      expect(countEntities()).toBe(1);
      expect(existsSync(join(memoryDir, "entities.md"))).toBe(true);
      expect(existsSync(join(memoryDir, "entities.md.tmp"))).toBe(false);
    });

    it("duplicate throws, table and file unchanged", () => {
      const { memoryDir } = setup();
      createEntity(db, memoryDir, { name: "Order", description: "A purchase." });
      expect(() =>
        createEntity(db, memoryDir, { name: "Order", description: "Another." })
      ).toThrow(/already exists/);
      expect(countEntities()).toBe(1);
    });

    it("invalid name throws EntityParseError", () => {
      const { memoryDir } = setup();
      expect(() =>
        createEntity(db, memoryDir, { name: "order", description: "A purchase." })
      ).toThrowError(EntityParseError);
      expect(countEntities()).toBe(0);
    });

    it("empty description throws EntityParseError", () => {
      const { memoryDir } = setup();
      expect(() =>
        createEntity(db, memoryDir, { name: "Order", description: "  " })
      ).toThrowError(EntityParseError);
      expect(countEntities()).toBe(0);
    });
  });

  describe("entityExists", () => {
    it("returns true for registered entity", () => {
      const { memoryDir } = setup();
      createEntity(db, memoryDir, { name: "Order", description: "A purchase." });
      expect(entityExists(db, "Order")).toBe(true);
    });

    it("returns false for unknown entity", () => {
      const { memoryDir } = setup();
      expect(entityExists(db, "Order")).toBe(false);
    });
  });

  describe("updateEntity", () => {
    function seed() {
      const { memoryDir } = setup();
      createEntity(db, memoryDir, { name: "Cart", description: "Pre-checkout." });
      return { memoryDir };
    }

    it("updates description in .md and SQLite", () => {
      const { memoryDir } = seed();
      updateEntity(db, memoryDir, "Cart", "New description.");
      const entities = readEntities(memoryDir);
      expect(entities.find((e) => e.name === "Cart")?.description).toBe("New description.");
      const row = db
        .prepare("SELECT description FROM entities WHERE name = ?")
        .get("Cart") as { description: string };
      expect(row.description).toBe("New description.");
    });

    it("throws for unknown entity", () => {
      const { memoryDir } = seed();
      expect(() => updateEntity(db, memoryDir, "NoSuch", "X")).toThrow("not found");
    });

    it("throws for empty description", () => {
      const { memoryDir } = seed();
      expect(() => updateEntity(db, memoryDir, "Cart", "   ")).toThrow();
    });
  });

  describe("removeEntity", () => {
    function seed() {
      const { memoryDir } = setup();
      createEntity(db, memoryDir, { name: "Cart", description: "Pre-checkout." });
      createEntity(db, memoryDir, { name: "Order", description: "Purchase." });
      return { memoryDir };
    }

    it("removes entity from .md and SQLite", () => {
      const { memoryDir } = seed();
      removeEntity(db, memoryDir, "Cart");
      const entities = readEntities(memoryDir);
      expect(entities.find((e) => e.name === "Cart")).toBeUndefined();
      expect(db.prepare("SELECT 1 FROM entities WHERE name = ?").get("Cart")).toBeUndefined();
    });

    it("leaves other entities intact", () => {
      const { memoryDir } = seed();
      removeEntity(db, memoryDir, "Cart");
      const entities = readEntities(memoryDir);
      expect(entities.find((e) => e.name === "Order")).toBeDefined();
    });

    it("throws for unknown entity", () => {
      const { memoryDir } = seed();
      expect(() => removeEntity(db, memoryDir, "NoSuch")).toThrow("not found");
    });
  });
});
