---
name: validate
description: Runs the current /work stage's gate and reports a verdict backed by unfakeable artifacts — raw full-suite output when the stage links no story, or browser-driven E2E with screenshots and an observation/verdict split per linked System-Aware Story. Use only when explicitly invoked as /validate (optionally /validate @<path-to-index>), or when spawned as a subagent by /autopilot to gate a stage.
---

# /validate — gate a stage

Verification Mode. Run the current stage's gate and report the verdict against unfakeable artifacts: raw test output, or E2E screenshots plus an observation/verdict split per linked story. The gate is observed and reported, never the code fixed — defects route back to `/work`, root-cause to `/diagnose`.

### Verification Mode — gate
Run the stage's gate and report the result against fixed artifacts. Forbidden: generating or fixing code, editing specs, plans, notes, or stories; rendering a verdict not backed by a raw artifact.

Communicate with the user in Russian. Write the report in Russian. Skill instructions are English — this does not change the output language.

## Duality

Invoked inline by the user, or spawned as a subagent by `/autopilot`. The skill is orchestration-neutral: it does not know which, and runs the same either way — gate, then report. The report file is the single output; the chat presentation is a compact pointer to it. Spawning is the caller's job, not this skill's.

Interaction mode follows the same channel — inline is attended, a spawned run is autonomous — but the skill never blocks on a human under either: it runs the gate to completion and renders its verdict, and the `blocked` verdict is already its autonomous exit when the gate cannot run.

## Behavior

1. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
2. The current stage = the first one without `[x]` in `## Этапы`. Read its `<prefix>-NN-<slug>.md` step file in full: `## Цель шага`, `## Definition of done`, `## Связанные истории`, `## Стратегия гейта`.
3. Select the branch from `## Стратегия гейта` — `test` → test branch, `e2e` → E2E branch. The value is derived from `## Связанные истории` (no story → `test`, one or more → `e2e`); cross-check it against story presence and report a mismatch instead of guessing.
4. Run the selected branch (below) and capture its unfakeable artifact.
5. Write the report to `plans/<prefix>/step-<NN>.md` (template below). Save E2E screenshots under `plans/<prefix>/screenshots/`, each filename prefixed `step-<NN>-` so passes of different stages never collide.
6. Present compact: the verdict (`green` / `defect` / `blocked`) and the report path in a couple of lines. Do not re-dump the report into chat.

## Test branch

Run the full project test suite. Capture its stdout/stderr verbatim — the raw run, never a retelling. All green → `green`. Any failing or skipped test → `defect`, the failing output carried into the report's `## Дефект`.

## E2E branch

Gate on the linked System-Aware Stories, driven through a browser (Playwright). This is also the UI validation branch a `ui`-mode stage relies on for proof.

- **Launch dependency.** The E2E gate needs the application launched and each story's `precondition` seeded. Take the launch mechanism from `## Стратегия гейта`. Mechanism absent, app unreachable, or `precondition` unseedable → verdict `blocked` with the precise reason; never judge around a gate that could not run.
- **Coverage.** Drive every linked story through all its steps and every `negative_path` — the happy path alone is forbidden. Capture a screenshot at each observed `expected`.
- **Observation/verdict split.** Per story the report carries two separate blocks: «Что видно на экране» — a neutral transcription of what was observed, no judgment; «Соответствие expected» — the verdict mapping each observation to the story's `expected` and `system_reaction`. The split lets the orchestrator trust the verdict from the text alone and never load the screenshots.
- Every `expected` and `system_reaction` met across all stories and negative paths → `green`. Any divergence → `defect`, the diverging step carried into `## Дефект`.

## Verdict

Three values, read by the orchestrator from the report text:

- `green` — the gate passed.
- `defect` — the gate ran and behavior diverged; the report carries the failing artifact (raw test output, or the story step where observed ≠ `expected`).
- `blocked` — the gate could not run (E2E launch mechanism or `precondition` seeding missing). Signals Tier C: stop and escalate to a human.

## Report template

```markdown
# Отчёт валидации — Step NN <slug>

## Вердикт
<green | defect | blocked> · <одна строка сути>

## Гейт
<test | e2e> · <как запускался: команда прогона / механизм запуска приложения>

## Сырой вывод
<test-ветка: fenced-блок со stdout/stderr полного прогона, verbatim — не пересказ>

## История <story-id>
<e2e-ветка: блок на каждую связанную историю>
### Что видно на экране
- <шаг / negative_path>: <нейтральная транскрипция наблюдаемого> · screenshots/step-NN-<id>.png

### Соответствие expected
- <expected / system_reaction>: <выполнен | расхождение: …>

## Дефект
<только при defect: неподделываемый артефакт расхождения — упавший тест / шаг истории, где наблюдаемое ≠ expected>
```
