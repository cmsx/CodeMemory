---
name: work-plan
description: Create a new /work plan from the preceding discussion. Triggered ONLY by the explicit command /work-plan. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-plan — create a plan

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context).

Materializes the outcome of a `/work-grill` discussion into a new plan. The plan format, index/step-file templates, stage granularity, and note taxonomy all come from `core.md`.

## Behavior

1. If an active plan already exists (`plans/*-00-index.md`, `status: active`) — warn and ask what to do; do not silently create a second.
2. Present the **architecture block** (retrospective layer of Architectural thinking) — applicable idioms, antipatterns, effect on stage structure. Wait for confirmation / edits.
3. Pick a `<prefix>` (3–4 letters from the feature name) yourself — **never ask the user**. Just ensure it does not collide with an existing prefix in `plans/`.
4. Create `plans/<prefix>-00-index.md` with `status: active` and filled sections (Цель, Контекст и ограничения, Этапы, plus empty note sections).
5. Create **all** step files `plans/<prefix>-NN-<slug>.md` at once — not lazily one by one. Each with its goal, Definition of done, and sub-task checkboxes.
6. Show the user the list of created files.

If there is no preceding discussion in context — recommend `/work-grill` first rather than planning blind.
