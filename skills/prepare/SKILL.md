---
name: prepare
description: Scouts the current /work stage in a reconnaissance pass — reads the plan, searches memory, reads the relevant code, and writes a pointer map (the run-file) so /work implements without re-exploring. Use only when explicitly invoked as /prepare (optionally /prepare @<path-to-index>), or when spawned as a subagent by /work to prepare a stage.
---

# /prepare — scout a stage

Reconnaissance Mode. Map the current stage's territory for the executor: read the plan, search memory, read the relevant code, and write the run-file map. The implementation is never decided here — the HOW belongs to `/work`.

### Reconnaissance Mode — survey
Gather and chart what the stage touches; produce the run-file map. Forbidden: designing the implementation (signatures, approach, test strategy belong to `/work`), writing code, editing specs, plans, or notes other than the run-file.

Communicate with the user in Russian. Write the run-file in Russian. Skill instructions are English — this does not change the output language.

## Why this runs

The map exists so `/work` reaches straight for the HOW and never re-opens territory the reconnaissance should have charted. A complete map is the whole reward: the executor reads it and implements. It is also the re-entry anchor — if a large stage is interrupted and the context reset, a fresh `/work` resumes through the map instead of researching the stage again.

A partial map — first two files skimmed, first hits dumped — is worse than none: the executor burns its context re-discovering, and a gap charted as covered surfaces later as a broken invariant. Thoroughness is not optional; the disposable context is here precisely so the cost lands here, not on `/work`.

## Reconnaissance trajectory

1. **Self-prime and scope.** Resolve the plan (Plan resolution below) and read its index and current step file in full. Read the `specs/` root (incl. `RULES.md`) and `list_entities` if not already loaded this session. State the stage scope in one line.
2. **Name the whole territory.** From the index `## Grounding`, the step file's `## Затрагиваемые файлы / символы`, and the entity map, list **every** candidate the stage plausibly touches — files, symbols, notes, entities. The full candidate set, not the first few.
3. **Walk it methodically.** Anchored search on each candidate node; full-text on the symptom where no coordinate is in hand. Resolve `[[id]]` notes. Read code to judge relevance — a symbol range for quick triage, the **whole file** when it is central (surfaced by a relevant note's anchors, or it will be edited in the stage) — and distill hints from the full read. Report the status line.
4. **Verdict per candidate.** For each: needed or not, why it is relevant, and the coordinates to look at (symbols, line ranges). Relevance verdicts only — never a recipe for how to implement.
5. **Validate — reverse blind-spot.** Hand the map, in your head, to a model with none of your reconnaissance context: where are its blind spots? Close the gaps; mark what stays a guess versus what you verified.
6. **Validate — sufficiency against the task.** Re-read the step file's `## Цель шага`, `## Definition of done`, and `## Подзадачи`, and confirm the map charts the context each one needs. A DoD item with no coordinate on the map is a gap — close it before writing.
7. **Write the run-file.** Write `<prefix>-run.md` (template below), including the compact "Проверено и отброшено" — candidate territory checked and ruled out, search angles that came back dry. Each is a terse trigger, not prose: it spares the executor a dead end, and defending a negative forces you to have actually checked it.
8. **Present super-compact.** The run-file holds the detail; do not re-dump it in chat. Report in a few lines: the run-file written, and the single standout — the most valuable or unexpected find the executor would not have guessed. Choosing the best find is the last self-check: nothing stands out → the reconnaissance was shallow, go back and dig.

## Plan resolution

`@<path>` → that index. No argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. A spawning `/work` passes the index path. The current stage is the first without `[x]` in `## Этапы`.

## Search contract

A `search` call has two paths, each with its own yield — separate calls, never two fields of one call.

- **Anchored search** (`anchors`) is the precise, information-dense path: it returns the notes pinned to the exact nodes in hand. Anchors union by OR — pass every relevant anchor in one call. Use it whenever a coordinate is known.
- **Full-text search** (`query`) is the orienting path — Russian descriptive words, 1–2 rephrasings, BM25 over summary and body, OR by default (`strict: true` for AND). Reach for it when no coordinate is in hand: boundaries still fuzzy, not all relevant anchors known, or the anchored search came back empty.

Mixing the two in one call is an error: the paths rank by different measures, so the relevance cut breaks and retrieval comes back incomplete.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchored search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

Each search tied to a discrete unit of work reports a one-line status in chat: `память: нашёл N, пригодилось k` — counts only. The count cannot be written without searching — that is the point.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for chosen `id`s — one call for several; returns the full body of each note.
- Reading code is part of reconnaissance, not deferred: take coordinates from the note's anchor map and the `list_symbols_in_file` symbol map; read the symbol range to triage, the whole file when it is central, and leave the executor the exact coordinates.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — record it in the run-file and show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — mark as unverified in the run-file; the executor verifies before acting.

## Run-file template

```markdown
# Разведка — Step NN <slug>

## Область
<что делает этап, одна строка из индекса и файла шага>

## Файлы
- `path/to/file` — нужен · <почему актуально> · смотреть `Class.method` / строки NN–MM
- `path/to/other` — не нужен · <почему отсёк>

## Заметки
- [[id]] <summary> — <чем важно для этапа>

## Сущности
- `entity:Name` — <одна строка из доменной карты>

## Проверено и отброшено
- <кандидат или угол поиска> — <почему пусто или нерелевантно>

## Если нужен дорисёрч
<какие зоны карта не покрыла; `list_entities` за полной доменной картой + текстовый поиск по симптому>
```

## Antipatterns

- Charting two files and stopping — a partial map read as complete.
- Copying note bodies or spec text into the run-file — it holds pointers and why, not content.
- Prescribing the implementation — signatures, approach, and test strategy are `/work`'s, not the map's.
- A symbol-range skim of a central file the executor must edit — read it whole.
- Silent omission — territory checked and ruled out goes in "Проверено и отброшено", not nowhere.
