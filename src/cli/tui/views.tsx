import { Box, Text } from "ink";
import type { ExpandedNote } from "../../core/get-notes.js";
import type { NoteRow, AnchorRow } from "./data.js";
import type { DetailItem } from "./navigation.js";

function statusTag(status: string): string {
  return status !== "current" ? ` [${status}]` : "";
}

interface NoteListViewProps {
  title: string;
  rows: NoteRow[];
  selected: number;
}

export function NoteListView({ title, rows, selected }: NoteListViewProps) {
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text> </Text>
      {rows.length === 0 ? (
        <Text dimColor>No notes.</Text>
      ) : (
        rows.map((r, i) => (
          <Box key={r.id}>
            <Text inverse={i === selected}>
              {r.id}{"  "}{r.summary}{statusTag(r.status)}
            </Text>
          </Box>
        ))
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
      const line = `  ${it.uri}${staleTag}`;
      return (
        <Box key={it.uri}>
          <Text inverse={idx === selected}>{line}</Text>
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
