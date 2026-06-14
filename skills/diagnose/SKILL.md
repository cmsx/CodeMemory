---
name: diagnose
description: Locates the root cause of a failed /work stage gate across layers and returns the coordinates for a fix-forward — reconstructed from durable artifacts (plan anchors, memory notes), never the executor's dead context — fixing nothing itself. Use only when explicitly invoked as /diagnose (optionally /diagnose @<path-to-index>), or when spawned as a subagent by /autopilot to root-cause a defect.
---

# /diagnose — locate the root cause

Diagnosis Mode. Trace a failed gate from its symptom to the root cause across layers (front / back / wiring), reconstructing from durable artifacts, and return the coordinates for a fix-forward. The map is the whole output — the fix belongs to `/work`.

### Diagnosis Mode — root-cause
Trace the defect to its root and report the coordinates across layers. Forbidden: fixing or generating code, editing specs, plans, notes, or stories; prescribing the fix (signatures, approach belong to `/work`).

Communicate with the user in Russian. Write the report in Russian. Skill instructions are English — this does not change the output language.

## Duality

Invoked inline by the user, or spawned as a subagent by `/autopilot`. The skill is orchestration-neutral: it does not know which, and runs the same either way — trace, then report. The report file is the single output; the chat presentation is a compact pointer to it. Spawning is the caller's job, not this skill's.

Interaction mode follows the same channel — inline is attended, a spawned run is autonomous — but the skill never blocks on a human under either: it runs the trace to completion and renders its verdict, and the `inconclusive` verdict is already its autonomous exit when the root will not localize.

## Why this runs

A defect surfaces in the current stage, but a cross-layer failure roots in code an earlier stage wrote — and that stage's context is dead. The root is reconstructed from the **durable artifacts** that outlive the context: the plan's anchors (`## Затрагиваемые файлы`, `## Grounding`), the stage's retained reconnaissance map (`plans/<prefix>/run-<NN>.md`), the `[[id]]` notes in memory, the committed code. A guess from the live symptom alone is forbidden; the trace lands on a coordinate backed by a durable artifact, or the verdict is `inconclusive`.

The fix is forward, in the current stage — Red-Green closes the hole for good. Closed `[x]` stages are never rewound; the diagnosis hands `/work` the coordinate to fix from where it stands.

## Diagnosis trajectory

1. **Self-prime and frame the symptom.** Resolve the plan (Plan resolution below) and read its index and current step file in full. Read the `specs/` root (incl. `RULES.md`) and `list_entities` if not already loaded this session. Take the failing artifact from the `/validate` report (`## Дефект` — raw failing test, or the story step where observed ≠ `expected`). State the symptom in one line.
2. **Name the suspect territory.** From the failing artifact, the index `## Grounding`, the step file's `## Затрагиваемые файлы / символы`, the current stage's `run-<NN>.md` when present, and the entity map, list every layer the symptom could root in — front, back, wiring — and the candidate files, symbols, notes, and entities in each. The full suspect set, not the nearest layer. The run-file already charts this stage's territory (relevance verdicts, what was ruled out) — read it as the starting map.
3. **Trace symptom to root.** Anchored search on each suspect node; full-text on the symptom where no coordinate is in hand. Resolve `[[id]]` notes. Read code by coordinate to confirm or clear each suspect — the symbol range to triage, the whole file when it is central. When the trace crosses into a closed stage `MM`, read that stage's `run-<MM>.md` for the territory it charted — only when the trace points there, not all of them upfront. Report the status line.
4. **Localize.** Pinpoint the root-cause coordinates — file / symbol / line range and the layer — and separate the root from the surface where the symptom showed. Coordinates and the reason this is the root, never a recipe for the fix.
5. **Validate the root.** Confirm the located root explains the whole symptom; where it explains only part, the trace is incomplete — keep going. Mark what stays a guess versus what a durable artifact confirmed. Root not localizable from durable artifacts → verdict `inconclusive`, do not guess.
6. **Write the report.** Write `plans/<prefix>/diagnose-<NN>.md` (template below), including the compact "Проверено и отброшено" — suspect nodes and root hypotheses cleared, and why.
7. **Present compact.** The report holds the detail; do not re-dump it in chat. Report in a couple of lines: the verdict (`located` / `inconclusive`) and the report path.

## Plan resolution

`@<path>` → that index. No argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. An explicit stage suffix `@<index>#NN` pins stage NN — diagnose it and only it, never re-resolve from the checkboxes; a spawning `/autopilot` passes the pinned stage. Without a suffix the current stage is the first without `[x]` in `## Этапы`.

## Verdict

Two values, read by the orchestrator from the report text:

- `located` — the root cause is pinned to a coordinate backed by a durable artifact; the report carries it for fix-forward.
- `inconclusive` — the root could not be localized from durable artifacts. Signals Tier C: stop and escalate to a human with the precise gap, never a guessed fix.

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
- To read code, take coordinates from the note's anchor map and the `list_symbols_in_file` symbol map — read the symbol range, not the whole file.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified; verify before acting.

## Report template

```markdown
# Диагностика — Step NN <slug>

## Вердикт
<located | inconclusive> · <одна строка: где корень / почему не локализован>

## Симптом
<неподделываемый артефакт из отчёта /validate: упавший тест / шаг истории, где наблюдаемое ≠ expected>

## Корень
<located: координаты первопричины — файл / символ / строки + слой (фронт/бэк/проводка); чем отличается от поверхности, где симптом проявился. inconclusive: оставить пустым>

## Трасса
- <слой / узел> — <что проверено, что показало> · координаты

## Якоря для fix-forward
- `file:` / `symbol:` / [[id]] — <координата для /work; что чинить, без рецепта как>

## Проверено и отброшено
- <узел или гипотеза корня> — <почему не он>
```

## Antipatterns

- Guessing the root from the live symptom without landing on a durable-artifact coordinate.
- Stopping at the surface layer where the symptom showed instead of tracing to the root.
- Prescribing the fix — signatures and approach are `/work`'s, the map carries coordinates and why.
- Proposing to rewind a closed `[x]` stage — the fix is forward in the current stage.
- Silent omission — a suspect node checked and cleared goes in "Проверено и отброшено", not nowhere.
