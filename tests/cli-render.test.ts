import { describe, it, expect } from "vitest";
import {
  renderSearchResult,
  renderNote,
  renderGetNotes,
  renderNoteList,
  renderStats,
  renderEntityList,
  renderEntity,
  renderVerify,
  type StatsData,
} from "../src/cli/render.js";
import type { SearchResult } from "../src/core/search.js";
import type { ExpandedNote, GetNotesResult } from "../src/core/get-notes.js";
import type { Entity } from "../src/core/entity-store.js";

describe("renderSearchResult", () => {
  it("returns no-results message when empty", () => {
    const r: SearchResult = { hits: [], total: 0, truncated: false };
    expect(renderSearchResult(r)).toBe("No results.");
  });

  it("lists hits with id and summary", () => {
    const r: SearchResult = {
      hits: [{ id: "2024-01-01-foo", summary: "Foo thing" }],
      total: 1,
      truncated: false,
    };
    const out = renderSearchResult(r);
    expect(out).toContain("2024-01-01-foo");
    expect(out).toContain("Foo thing");
    expect(out).toContain("1 result");
  });

  it("shows status for non-current hits", () => {
    const r: SearchResult = {
      hits: [{ id: "2024-01-01-foo", summary: "Foo", status: "outdated" }],
      total: 1,
      truncated: false,
    };
    expect(renderSearchResult(r)).toContain("[outdated]");
  });

  it("shows truncated footer", () => {
    const r: SearchResult = {
      hits: [{ id: "a", summary: "A" }],
      total: 5,
      truncated: true,
    };
    const out = renderSearchResult(r);
    expect(out).toContain("truncated");
    expect(out).toContain("total 5");
  });
});

describe("renderNote", () => {
  const base: ExpandedNote = {
    id: "2024-01-01-test",
    summary: "Test note",
    status: "current",
    body: "## Body\n\nSome content.",
    anchorMap: [],
    mentioned: [],
  };

  it("shows id and summary", () => {
    const out = renderNote(base);
    expect(out).toContain("2024-01-01-test");
    expect(out).toContain("Test note");
  });

  it("does not show status tag for current notes", () => {
    expect(renderNote(base)).not.toContain("[current]");
  });

  it("shows status tag for non-current", () => {
    const out = renderNote({ ...base, status: "outdated" });
    expect(out).toContain("[outdated]");
  });

  it("renders anchor map grouped by weight", () => {
    const n: ExpandedNote = {
      ...base,
      anchorMap: [
        {
          weight: "core",
          anchors: [
            { uri: "file:src/foo.ts", weight: "core", status: "ok" },
            { uri: "file:src/bar.ts", weight: "core", status: "stale" },
          ],
        },
      ],
    };
    const out = renderNote(n);
    expect(out).toContain("Anchor Map");
    expect(out).toContain("core");
    expect(out).toContain("file:src/foo.ts");
    expect(out).toContain("[stale]");
    expect(out).not.toContain("[ok]");
  });

  it("renders mentioned notes", () => {
    const n: ExpandedNote = {
      ...base,
      mentioned: [
        { id: "2024-02-01-ref", summary: "Referenced", stale: false },
        { id: "2024-03-01-gone", stale: true },
      ],
    };
    const out = renderNote(n);
    expect(out).toContain("Mentioned Notes");
    expect(out).toContain("[[2024-02-01-ref]]");
    expect(out).toContain("Referenced");
    expect(out).toContain("[[2024-03-01-gone]]");
    expect(out).toContain("[stale]");
  });
});

describe("renderGetNotes", () => {
  it("renders multiple notes with separator", () => {
    const base: ExpandedNote = {
      id: "a",
      summary: "A",
      status: "current",
      body: "body a",
      anchorMap: [],
      mentioned: [],
    };
    const r: GetNotesResult = {
      notes: [base, { ...base, id: "b", summary: "B", body: "body b" }],
      missing: [],
    };
    const out = renderGetNotes(r);
    expect(out).toContain("# a");
    expect(out).toContain("# b");
    expect(out).toContain("---");
  });

  it("shows missing ids", () => {
    const r: GetNotesResult = { notes: [], missing: ["foo", "bar"] };
    expect(renderGetNotes(r)).toContain("Missing: foo, bar");
  });
});

describe("renderNoteList", () => {
  it("returns no-notes message when empty", () => {
    expect(renderNoteList([])).toBe("No notes.");
  });

  it("lists notes", () => {
    const rows = [{ id: "x", summary: "X note", status: "current" }];
    expect(renderNoteList(rows)).toContain("x");
    expect(renderNoteList(rows)).not.toContain("[current]");
  });

  it("shows status for non-current", () => {
    const rows = [{ id: "y", summary: "Y", status: "draft" }];
    expect(renderNoteList(rows)).toContain("[draft]");
  });
});

describe("renderStats", () => {
  it("renders all fields", () => {
    const s: StatsData = {
      totalNotes: 3,
      byStatus: { current: 2, draft: 1 },
      totalAnchors: 10,
      staleAnchors: 2,
      unknownAnchors: 1,
      totalEntities: 4,
      totalSymbols: 50,
      totalFiles: 8,
    };
    const out = renderStats(s);
    expect(out).toContain("Notes: 3");
    expect(out).toContain("current: 2");
    expect(out).toContain("Anchors: 10 total, 2 stale, 1 unknown");
    expect(out).toContain("Entities: 4");
    expect(out).toContain("Symbols: 50");
    expect(out).toContain("Indexed files: 8");
  });
});

describe("renderEntityList / renderEntity", () => {
  it("returns no-entities message when empty", () => {
    expect(renderEntityList([])).toBe("No entities.");
  });

  it("lists entity names and first description line", () => {
    const es: Entity[] = [
      { name: "Foo", description: "First line\nSecond line" },
    ];
    const out = renderEntityList(es);
    expect(out).toContain("Foo");
    expect(out).toContain("First line");
    expect(out).not.toContain("Second line");
  });

  it("renders full entity", () => {
    const e: Entity = { name: "Bar", description: "Full description here." };
    const out = renderEntity(e);
    expect(out).toContain("## Bar");
    expect(out).toContain("Full description here.");
  });
});

describe("renderVerify", () => {
  it("renders checked/ok/stale counts", () => {
    expect(renderVerify({ checked: 5, ok: 3, stale: 2 })).toBe(
      "checked 5, ok 3, stale 2",
    );
  });
});
