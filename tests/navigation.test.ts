import { describe, it, expect } from "vitest";
import {
  initHistory,
  top,
  navigate,
  goBack,
  setCursor,
  buildDetailItems,
} from "../src/cli/tui/navigation.js";
import type { AnchorRow } from "../src/cli/tui/data.js";
import type { MentionedNote } from "../src/core/get-notes.js";

describe("initHistory", () => {
  it("starts with noteList at cursor 0", () => {
    const h = initHistory();
    expect(h).toHaveLength(1);
    expect(top(h)).toEqual({ loc: { kind: "noteList" }, cursor: 0 });
  });
});

describe("navigate", () => {
  it("pushes new entry with cursor 0", () => {
    const h = navigate(initHistory(), { kind: "noteDetail", id: "abc" });
    expect(h).toHaveLength(2);
    expect(top(h)).toEqual({ loc: { kind: "noteDetail", id: "abc" }, cursor: 0 });
  });

  it("preserves prior cursor in stack", () => {
    const h1 = setCursor(initHistory(), 3);
    const h2 = navigate(h1, { kind: "searchResults", query: "foo" });
    expect(h2[0].cursor).toBe(3);
    expect(top(h2).cursor).toBe(0);
  });
});

describe("goBack", () => {
  it("pops the last entry", () => {
    const h = navigate(initHistory(), { kind: "noteDetail", id: "x" });
    const back = goBack(h);
    expect(back).toHaveLength(1);
    expect(top(back).loc).toEqual({ kind: "noteList" });
  });

  it("no-op at root", () => {
    const h = initHistory();
    expect(goBack(h)).toHaveLength(1);
  });

  it("restores prior cursor after back", () => {
    const h1 = setCursor(initHistory(), 5);
    const h2 = navigate(h1, { kind: "noteDetail", id: "y" });
    const h3 = goBack(h2);
    expect(top(h3).cursor).toBe(5);
  });
});

describe("setCursor", () => {
  it("updates cursor on top entry only", () => {
    const h = navigate(initHistory(), { kind: "noteDetail", id: "z" });
    const h2 = setCursor(h, 7);
    expect(top(h2).cursor).toBe(7);
    expect(h2[0].cursor).toBe(0);
  });
});

describe("buildDetailItems", () => {
  const anchors: AnchorRow[] = [
    { uri: "file:src/a.ts", type: "file", weight: "supporting", status: "ok" },
    { uri: "symbol:foo", type: "symbol", weight: "critical", status: "stale" },
    { uri: "entity:Auth", type: "entity", weight: "core", status: "ok" },
    { uri: "file:src/b.ts", type: "file", weight: "incidental", status: "unknown" },
  ];
  const mentioned: MentionedNote[] = [
    { id: "note-a", summary: "Note A", stale: false },
    { id: "note-b", stale: true },
  ];

  it("orders anchors by weight before mentions", () => {
    const items = buildDetailItems(anchors, mentioned);
    // first 4 are anchors in weight order: critical, core, supporting, incidental
    expect(items[0]).toMatchObject({ kind: "anchor", uri: "symbol:foo", weight: "critical" });
    expect(items[1]).toMatchObject({ kind: "anchor", uri: "entity:Auth", weight: "core" });
    expect(items[2]).toMatchObject({ kind: "anchor", uri: "file:src/a.ts", weight: "supporting" });
    expect(items[3]).toMatchObject({ kind: "anchor", uri: "file:src/b.ts", weight: "incidental" });
    // then mentions
    expect(items[4]).toMatchObject({ kind: "mention", id: "note-a", stale: false });
    expect(items[5]).toMatchObject({ kind: "mention", id: "note-b", stale: true });
  });

  it("handles empty anchors and mentions", () => {
    expect(buildDetailItems([], [])).toEqual([]);
  });

  it("handles only mentions", () => {
    const items = buildDetailItems([], mentioned);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("mention");
  });
});
