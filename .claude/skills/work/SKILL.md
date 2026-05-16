---
name: work
description: Execute the current stage of the active /work plan. Triggered ONLY by the explicit command /work (optionally /work @<path-to-index>). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work — execute a stage

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context) — it holds the shared discipline.

## Resolving the plan

- No argument — find the single `plans/*-00-index.md` with `status: active`. If more than one or none — report and ask for `@<path>`.
- `@<path>` — work from the given index.

## Behavior

1. Read the index in full — Цель, Контекст и ограничения, Этапы, all note sections. Follow any `specs/` references in Контекст и ограничения and read those spec parts — that section is execution's route to the business spec.
2. **Light reality check** (this replaces the old `sync` command): scan the codebase and `git log` for signs that stages already done are not checked, or checked stages with no trace in code. If something looks off — report it and ask before proceeding.
3. Find the first stage in the list without `[x]` — the current one.
4. Read its step file in full, including `## Working notes` (may hold interrupted work from a prior session).
5. If the step file has `[x]` sub-tasks — work was interrupted. Do not restart. Continue from the first unchecked sub-task, using Working notes.
6. Report briefly: which plan, which stage, signs of interrupted work, a proposed plan for this session.
7. Work the stage, checking off `[x]` sub-tasks as you go, writing Working notes along the way (what was tried, what failed, decisions made).
8. **Before pausing or ending a turn — reconcile.** Sweep the step file: every sub-task actually done must be `[x]`, every Working note that should exist must exist. The checkboxes are the resume signal for the next session, so they must match reality — do not rely on having ticked them perfectly while heads-down in the work.

If the project is connected to Code Memory — before editing the stage's files, `search` code memory by their `file:` anchors; honor any `stale` anchor or `critical` note surfaced. Do not capture to memory mid-stage — capture is owned by `/work-step-done`.

## Under plan mode

If plan mode is active at launch, treat it as an instruction for deep planning, not a readiness confirmation. The plan file is WHAT and WHY; the plan-mode job here is HOW, detailed enough that the executing model works mechanically.

1. Read the index and current step file.
2. Load every file the stage will change and every file needed to make implementation decisions. Do not pass to the executing model questions whose answers are in the code.
3. Apply relevant Decisions/Deviations from the index to the step's detail.
4. Turn sub-tasks from intentions ("add input validation") into concrete detail: which files, which method signatures, which data structures, which tests with which inputs and expected outputs.
5. Put any information needed for precise execution into the output plan verbatim — code fragments, signatures, file references. The plan is single-use; better redundant but self-contained.
6. If a step is genuinely trivial — justify it explicitly (what was checked, why there is nothing to detail). Do not shorten silently.
