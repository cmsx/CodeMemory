import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { openCli } from "../src/cli/context.js";
import { reconcileNotes } from "../src/core/note-indexer.js";
import { reconcileEntities } from "../src/core/entity-indexer.js";
import { App } from "../src/cli/tui/app.js";

const NOTE_MD = (id: string, summary: string, anchor = "file:src/main.ts", body = "") => `\
---
id: ${id}
summary: ${summary}
status: current
created: 2024-01-01
updated: 2024-01-01
anchors:
  - uri: ${anchor}
    weight: core
---

${body || `Body of ${summary}.`}
`;

const ENTITIES_MD = `# Domain Entities\n\n## Cart\n\nPre-checkout item collection.\n`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cms-tui-"));
  const memoryDir = join(tmpDir, ".memory");
  const notesDir = join(memoryDir, "notes");
  mkdirSync(notesDir, { recursive: true });

  writeFileSync(join(notesDir, "note-alpha.md"), NOTE_MD("note-alpha", "Alpha note"));
  writeFileSync(
    join(notesDir, "note-beta.md"),
    NOTE_MD("note-beta", "Beta note", "file:src/main.ts", "Beta body [[note-alpha]]."),
  );
  writeFileSync(join(memoryDir, "entities.md"), ENTITIES_MD);

  mkdirSync(join(tmpDir, "src"), { recursive: true });
  writeFileSync(join(tmpDir, "src", "main.ts"), "export function main() {}\n");
  writeFileSync(join(tmpDir, ".gitignore"), "node_modules/\n");

  process.env.CMS_PROJECT_ROOT = tmpDir;

  const ctx = openCli();
  reconcileEntities(ctx.db, ctx.memoryDir);
  reconcileNotes(ctx.db, ctx.notesDir);
  ctx.db.close();
});

afterEach(() => {
  delete process.env.CMS_PROJECT_ROOT;
  rmSync(tmpDir, { recursive: true, force: true });
});

async function press(stdin: { write: (s: string) => void }, key: string): Promise<void> {
  stdin.write(key);
  // Wait > Ink's 20ms pending-escape flush delay so Esc sequences are emitted,
  // and React's scheduler flushes state updates.
  await new Promise((r) => setTimeout(r, 50));
}

describe("TUI — list view", () => {
  it("renders note summaries in the list", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, unmount } = render(<App ctx={ctx} />);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Alpha note");
      expect(frame).toContain("Beta note");
      unmount();
    } finally {
      ctx.db.close();
    }
  });

  it("shows 'All notes' heading", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, unmount } = render(<App ctx={ctx} />);
      expect(lastFrame()).toContain("All notes");
      unmount();
    } finally {
      ctx.db.close();
    }
  });
});

describe("TUI — navigation to detail view", () => {
  it("shows anchor map after Enter on first item", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "\r");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Anchor Map");
      unmount();
    } finally {
      ctx.db.close();
    }
  });

  it("shows note body in detail view", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "\r");
      const frame = lastFrame() ?? "";
      expect(frame).toMatch(/Alpha note|Beta note/);
      unmount();
    } finally {
      ctx.db.close();
    }
  });
});

describe("TUI — back navigation", () => {
  it("Esc returns to list from detail", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "\r");         // open note
      await press(stdin, "\x1B");       // Esc — back
      expect(lastFrame()).toContain("All notes");
      unmount();
    } finally {
      ctx.db.close();
    }
  });

  it("Esc at root stays on list", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "\x1B");
      expect(lastFrame()).toContain("All notes");
      unmount();
    } finally {
      ctx.db.close();
    }
  });
});

describe("TUI — search", () => {
  it("/ enters search mode", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "/");
      expect(lastFrame()).toContain("Search:");
      unmount();
    } finally {
      ctx.db.close();
    }
  });

  it("search query shows results list", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "/");
      await press(stdin, "alpha");
      await press(stdin, "\r");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Search: alpha");
      unmount();
    } finally {
      ctx.db.close();
    }
  });

  it("Esc from search returns to current view", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      await press(stdin, "/");
      await press(stdin, "\x1B");
      expect(lastFrame()).toContain("All notes");
      unmount();
    } finally {
      ctx.db.close();
    }
  });
});

describe("TUI — [[id]] mentions", () => {
  it("opens note with [[id]] and shows Mentioned Notes section", async () => {
    const ctx = openCli();
    try {
      const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
      // note-beta (has [[note-alpha]]) — navigate to find it
      // notes sorted by updated desc; both have same updated so order by id: note-alpha, note-beta
      await press(stdin, "\x1B[B"); // down — select note-beta
      await press(stdin, "\r");     // open note-beta
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Mentioned Notes");
      expect(frame).toContain("note-alpha");
      unmount();
    } finally {
      ctx.db.close();
    }
  });
});
