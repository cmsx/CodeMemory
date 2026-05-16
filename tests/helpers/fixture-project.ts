import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the fixture project template (read-only). */
export const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "sample-project",
);

/**
 * Copies the fixture project template into a fresh mkdtemp directory and
 * returns its path. The template remains untouched; the calling test mutates
 * the copy and is responsible for cleanup:
 *   `rmSync(dir, { recursive: true, force: true })`
 */
export function copyFixtureProject(): string {
  const dest = mkdtempSync(join(tmpdir(), "cms-fixture-"));
  cpSync(FIXTURE_ROOT, dest, { recursive: true });
  return dest;
}
