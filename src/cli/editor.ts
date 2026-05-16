import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function getEditor(): string {
  return process.env.EDITOR || process.env.VISUAL || "vi";
}

export function openInEditor(path: string): void {
  const editor = getEditor();
  const result = spawnSync(editor, [path], { stdio: "inherit" });
  if (result.error) {
    throw new Error(`editor "${editor}" not found; set $EDITOR`);
  }
}

export function editText(initial: string): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "cms-edit-"));
  const tmpFile = join(tmpDir, "edit.md");
  try {
    writeFileSync(tmpFile, initial, "utf8");
    openInEditor(tmpFile);
    return readFileSync(tmpFile, "utf8");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
