---
name: work
description: Execute the current stage of the active /work plan. Triggered ONLY by the explicit command /work (optionally /work @<path-to-index>). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work — execute a stage

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Resolving the plan

- No argument — the single `plans/*-00-index.md` with `status: active`. More than one or none — report, ask for `@<path>`.
- `@<path>` — work from the given index.

## Behavior

1. Read the index in full — Цель, Контекст и ограничения, Этапы, all note sections. Follow `specs/` references in Контекст и ограничения and read those spec parts.
2. **Reality check:** scan the codebase and `git log` for done-but-unchecked stages, or checked stages with no trace in code. Anything off — report and ask before proceeding.
3. Find the first stage without `[x]` — the current one.
4. If connected to Code Memory — `search` by the `file:` anchors of the stage's files before editing them; honor any `stale` anchor or `critical` note.
5. Read the current step file in full, including `## Working notes`.
6. If the step file has `[x]` sub-tasks — work was interrupted. Do not restart; continue from the first unchecked sub-task.
7. Report briefly: which plan, which stage, interrupted-work signs, the session plan.
8. Work the stage. Check off `[x]` sub-tasks as you go; write Working notes along the way.
9. Before pausing or ending a turn — reconcile the step file: every done sub-task `[x]`, every needed Working note present. Checkboxes are the resume signal.

Do not capture to memory mid-stage — capture is owned by `/work-step-done`.

## Under plan mode

Plan mode at launch = an instruction for deep planning, not a readiness confirmation. The plan file is WHAT/WHY; the plan-mode job is HOW, detailed enough to execute mechanically.

1. Read the index and current step file.
2. Load every file the stage will change and every file needed for implementation decisions.
3. Apply relevant index Decisions/Deviations to the step detail.
4. Turn sub-tasks from intentions into concrete detail: which files, which signatures, which data structures, which tests with which inputs and outputs.
5. Put everything needed for execution into the plan verbatim — code fragments, signatures, file references. Better redundant but self-contained.
6. A genuinely trivial step — justify explicitly. Do not shorten silently.
