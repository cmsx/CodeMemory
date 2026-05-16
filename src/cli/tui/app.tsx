import { useState, useMemo } from "react";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { join } from "node:path";
import type { CliCtx } from "../context.js";
import { reconcile } from "../context.js";
import { openInEditor } from "../editor.js";
import { search } from "../../core/search.js";
import { getNotes } from "../../core/get-notes.js";
import type { ExpandedNote } from "../../core/get-notes.js";
import { deleteNote } from "../../core/note-write.js";
import { listAllNotes, noteAnchors } from "./data.js";
import type { NoteRow } from "./data.js";
import {
  initHistory,
  top,
  navigate,
  goBack,
  setCursor,
  buildDetailItems,
} from "./navigation.js";
import type { HistEntry, DetailItem } from "./navigation.js";
import { NoteListView, NoteDetailView, TextPrompt, ConfirmPrompt } from "./views.js";

type Mode = "normal" | "search" | "confirmDelete";

interface ListView {
  kind: "list";
  title: string;
  rows: NoteRow[];
}

interface DetailView {
  kind: "detail";
  note: ExpandedNote;
  items: DetailItem[];
}

interface MissingView {
  kind: "missing";
  id: string;
}

type View = ListView | DetailView | MissingView;

function loadView(ctx: CliCtx, entry: HistEntry): View {
  const { loc } = entry;
  if (loc.kind === "noteList") {
    return { kind: "list", title: "All notes", rows: listAllNotes(ctx.db) };
  }
  if (loc.kind === "searchResults") {
    const result = search(ctx.db, { query: loc.query, include_archived: true });
    const rows: NoteRow[] = result.hits.map((h) => ({
      id: h.id,
      summary: h.summary,
      status: h.status ?? "current",
    }));
    return { kind: "list", title: `Search: ${loc.query}`, rows };
  }
  if (loc.kind === "anchorNotes") {
    const result = search(ctx.db, { anchors: [loc.uri], include_archived: true });
    const rows: NoteRow[] = result.hits.map((h) => ({
      id: h.id,
      summary: h.summary,
      status: h.status ?? "current",
    }));
    return { kind: "list", title: `Anchor: ${loc.uri}`, rows };
  }
  // noteDetail
  const { id } = loc;
  const { notes, missing } = getNotes(ctx.db, [id]);
  if (missing.includes(id)) {
    return { kind: "missing", id };
  }
  const note = notes[0];
  const anchors = noteAnchors(ctx.db, id);
  const items = buildDetailItems(anchors, note.mentioned);
  return { kind: "detail", note, items };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface HintProps {
  mode: Mode;
  viewKind: string;
}

function HintLine({ mode, viewKind }: HintProps) {
  if (mode === "search") return <Text dimColor>Enter: confirm  Esc: cancel</Text>;
  if (mode === "confirmDelete") return <Text dimColor>y: confirm  n/Esc: cancel</Text>;
  if (viewKind === "detail") {
    return <Text dimColor>↑↓: select  Enter: follow  e: edit  d: delete  /: search  Esc: back  q: quit</Text>;
  }
  return <Text dimColor>↑↓: move  Enter: open  /: search  Esc: back  q: quit</Text>;
}

interface AppProps {
  ctx: CliCtx;
}

export function App({ ctx }: AppProps) {
  const { exit } = useApp();
  const { setRawMode } = useStdin();
  const [history, setHistory] = useState<HistEntry[]>(initHistory);
  const [mode, setMode] = useState<Mode>("normal");
  const [searchInput, setSearchInput] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [editorError, setEditorError] = useState<string | null>(null);

  const entry = top(history);
  const view = useMemo(() => loadView(ctx, entry), [entry, refreshNonce]);

  useInput((input, key) => {
    setEditorError(null);

    if (mode === "search") {
      if (key.return) {
        const q = searchInput.trim();
        if (q) {
          setHistory((h) => navigate(h, { kind: "searchResults", query: q }));
        }
        setMode("normal");
      } else if (key.escape) {
        setMode("normal");
      } else if (key.backspace || key.delete) {
        setSearchInput((s) => s.slice(0, -1));
      } else if (input) {
        setSearchInput((s) => s + input);
      }
      return;
    }

    if (mode === "confirmDelete") {
      if (input === "y" || input === "Y") {
        if (view.kind === "detail") {
          deleteNote(ctx.db, ctx.memoryDir, view.note.id);
          setHistory((h) => goBack(h));
          setRefreshNonce((n) => n + 1);
        }
      }
      setMode("normal");
      return;
    }

    // mode === "normal"
    if (key.escape || key.backspace) {
      setHistory((h) => goBack(h));
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (input === "/") {
      setMode("search");
      setSearchInput("");
      return;
    }

    if (view.kind === "list") {
      const len = view.rows.length;
      if (key.upArrow) {
        setHistory((h) => setCursor(h, clamp(entry.cursor - 1, 0, Math.max(0, len - 1))));
      } else if (key.downArrow) {
        setHistory((h) => setCursor(h, clamp(entry.cursor + 1, 0, Math.max(0, len - 1))));
      } else if (key.return && len > 0) {
        const row = view.rows[entry.cursor];
        setHistory((h) => navigate(h, { kind: "noteDetail", id: row.id }));
      }
    } else if (view.kind === "detail") {
      const len = view.items.length;
      if (key.upArrow) {
        setHistory((h) => setCursor(h, clamp(entry.cursor - 1, 0, Math.max(0, len - 1))));
      } else if (key.downArrow) {
        setHistory((h) => setCursor(h, clamp(entry.cursor + 1, 0, Math.max(0, len - 1))));
      } else if (key.return) {
        const item: DetailItem | undefined = view.items[entry.cursor];
        if (item?.kind === "anchor") {
          setHistory((h) => navigate(h, { kind: "anchorNotes", uri: item.uri }));
        } else if (item?.kind === "mention" && !item.stale) {
          setHistory((h) => navigate(h, { kind: "noteDetail", id: item.id }));
        }
      } else if (input === "e") {
        const notePath = join(ctx.notesDir, view.note.id + ".md");
        try {
          setRawMode(false);
          openInEditor(notePath);
        } catch (err) {
          setEditorError(err instanceof Error ? err.message : String(err));
        } finally {
          setRawMode(true);
        }
        process.stdout.write("\x1Bc");
        void reconcile(ctx, { notes: true, verify: true }).then(() => {
          setRefreshNonce((n) => n + 1);
        });
      } else if (input === "d") {
        setMode("confirmDelete");
      }
    }
  });

  return (
    <Box flexDirection="column">
      {mode === "search" ? (
        <TextPrompt label="Search" value={searchInput} />
      ) : mode === "confirmDelete" && view.kind === "detail" ? (
        <ConfirmPrompt message={`Delete ${view.note.id}?`} />
      ) : view.kind === "list" ? (
        <NoteListView title={view.title} rows={view.rows} selected={entry.cursor} />
      ) : view.kind === "detail" ? (
        <NoteDetailView note={view.note} items={view.items} selected={entry.cursor} />
      ) : (
        <Text color="red">Note not found: {(view as MissingView).id}</Text>
      )}
      {editorError && <Text color="red">{editorError}</Text>}
      <Text> </Text>
      <HintLine mode={mode} viewKind={view.kind} />
    </Box>
  );
}
