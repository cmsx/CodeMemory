import { Box, Text, useStdout } from "ink";
import type { ExpandedNote } from "../../core/get-notes.js";
import type { AnchorType } from "../../core/note-store.js";
import type { NoteRow, AnchorRow } from "./data.js";
import type { DetailItem } from "./navigation.js";

// Muted, distinguishable hues per anchor type; stale anchors override to gray.
const ANCHOR_TYPE_COLOR: Record<AnchorType, string> = {
  file: "#6c9ec0",
  symbol: "#7faf7f",
  entity: "#b08fc0",
  env: "#c0a878",
};

function statusTag(status: string): string {
  return status !== "current" ? ` [${status}]` : "";
}

// Note ids vary in length; pad them to a fixed column so summaries line up
// vertically. Ids longer than the column are truncated with an ellipsis.
const ID_COL_WIDTH = 50;

function padId(id: string): string {
  if (id.length > ID_COL_WIDTH) return id.slice(0, ID_COL_WIDTH - 1) + "…";
  return id.padEnd(ID_COL_WIDTH);
}

// Rows reserved for non-list chrome: title + blank + two scroll indicators
// here, plus blank + hint line in App.
const CHROME_ROWS = 7;
const DEFAULT_VIEWPORT = 20;
const MIN_VIEWPORT = 3;

// First row index of the scroll window: keeps `selected` roughly centred so
// the list slides under the cursor. Pure — derived fresh each render.
export function windowStart(selected: number, total: number, height: number): number {
  if (total <= height) return 0;
  const start = selected - Math.floor(height / 2);
  return Math.max(0, Math.min(start, total - height));
}

interface NoteListViewProps {
  title: string;
  rows: NoteRow[];
  selected: number;
  viewportHeight?: number; // override terminal-derived height (tests)
}

export function NoteListView({ title, rows, selected, viewportHeight }: NoteListViewProps) {
  const { stdout } = useStdout();
  const derived = (stdout?.rows ?? 0) - CHROME_ROWS;
  const viewport = Math.max(
    MIN_VIEWPORT,
    viewportHeight ?? (derived >= MIN_VIEWPORT ? derived : DEFAULT_VIEWPORT),
  );

  const start = windowStart(selected, rows.length, viewport);
  const visible = rows.slice(start, start + viewport);
  const above = start;
  const below = rows.length - (start + visible.length);

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text> </Text>
      {rows.length === 0 ? (
        <Text dimColor>No notes.</Text>
      ) : (
        <>
          <Text dimColor>{above > 0 ? `  ↑ ${above} more` : " "}</Text>
          {visible.map((r, idx) => {
            const i = start + idx;
            return (
              <Box key={r.id}>
                <Text inverse={i === selected}>
                  {padId(r.id)}{"  "}{r.summary}{statusTag(r.status)}
                </Text>
              </Box>
            );
          })}
          <Text dimColor>{below > 0 ? `  ↓ ${below} more` : " "}</Text>
        </>
      )}
    </Box>
  );
}

interface NoteDetailViewProps {
  note: ExpandedNote;
  items: DetailItem[];
  selected: number;
}

export function NoteDetailView({ note, items, selected }: NoteDetailViewProps) {
  let itemIdx = 0;

  const anchorLines = items
    .filter((it): it is Extract<DetailItem, { kind: "anchor" }> => it.kind === "anchor")
    .map((it) => {
      const idx = itemIdx++;
      const staleTag = it.status === "stale" ? "  [stale]" : "";
      const weightTag = `[${it.weight}]`.padEnd(12);
      const line = `  ${weightTag}  ${it.uri}${staleTag}`;
      const color = it.status === "stale" ? "gray" : ANCHOR_TYPE_COLOR[it.type];
      return (
        <Box key={it.uri}>
          <Text inverse={idx === selected} color={color}>{line}</Text>
        </Box>
      );
    });

  const mentionLines = items
    .filter((it): it is Extract<DetailItem, { kind: "mention" }> => it.kind === "mention")
    .map((it) => {
      const idx = itemIdx++;
      const staleTag = it.stale ? "  [stale]" : "";
      const sumText = it.summary ? `  ${it.summary}` : "";
      const line = `  [[${it.id}]]${sumText}${staleTag}`;
      return (
        <Box key={it.id}>
          <Text inverse={idx === selected} dimColor={it.stale}>
            {line}
          </Text>
        </Box>
      );
    });

  return (
    <Box flexDirection="column">
      <Text bold>{note.id}</Text>
      <Text dimColor>{note.summary}{statusTag(note.status)}</Text>
      <Text> </Text>
      <Text>{note.body}</Text>
      {anchorLines.length > 0 && (
        <>
          <Text> </Text>
          <Text bold>Anchor Map</Text>
          {anchorLines}
        </>
      )}
      {mentionLines.length > 0 && (
        <>
          <Text> </Text>
          <Text bold>Mentioned Notes</Text>
          {mentionLines}
        </>
      )}
    </Box>
  );
}

interface TextPromptProps {
  label: string;
  value: string;
}

export function TextPrompt({ label, value }: TextPromptProps) {
  return (
    <Text>
      {label}: {value}▊
    </Text>
  );
}

interface ConfirmPromptProps {
  message: string;
}

export function ConfirmPrompt({ message }: ConfirmPromptProps) {
  return <Text color="red">{message} (y/n)</Text>;
}
