import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Entity {
  name: string;
  description: string;
}

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

export class EntityParseError extends Error {
  constructor(reason: string) {
    super(`entities.md: ${reason}`);
    this.name = "EntityParseError";
  }
}

export function isValidEntityName(name: string): boolean {
  return PASCAL_CASE.test(name);
}

export function parseEntities(raw: string): Entity[] {
  const lines = raw.split("\n");
  const result: Entity[] = [];
  const seen = new Set<string>();
  let current: { name: string; descLines: string[] } | null = null;

  function flush() {
    if (!current) return;
    const description = current.descLines.join("\n").trim();
    if (description === "") {
      throw new EntityParseError(`entity "${current.name}" has empty description`);
    }
    result.push({ name: current.name, description });
  }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flush();
      const name = h2[1].trim();
      if (!isValidEntityName(name)) {
        throw new EntityParseError(`invalid entity name "${name}" (must be PascalCase)`);
      }
      if (seen.has(name)) {
        throw new EntityParseError(`duplicate entity "${name}"`);
      }
      seen.add(name);
      current = { name, descLines: [] };
      continue;
    }
    if (current) {
      current.descLines.push(line);
    }
  }
  flush();
  return result;
}

export function serializeEntities(entities: Entity[]): string {
  const sorted = [...entities].sort((a, b) => (a.name < b.name ? -1 : 1));
  const sections = sorted.map((e) => `## ${e.name}\n\n${e.description}`);
  return `# Domain Entities\n\n${sections.join("\n\n")}\n`;
}

export function readEntities(memoryDir: string): Entity[] {
  try {
    const raw = readFileSync(join(memoryDir, "entities.md"), "utf8");
    return parseEntities(raw);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export function writeEntities(memoryDir: string, entities: Entity[]): void {
  mkdirSync(memoryDir, { recursive: true });
  const target = join(memoryDir, "entities.md");
  const tmp = target + ".tmp";
  writeFileSync(tmp, serializeEntities(entities));
  renameSync(tmp, target);
}
