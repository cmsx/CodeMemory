---
name: work-plan
description: Create a new /work plan from the preceding discussion. Triggered ONLY by the explicit command /work-plan. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-plan — create a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context). Plan format, templates, stage granularity, note taxonomy — all from `core.md`.

## Behavior

1. Active plan already exists — warn, ask what to do; do not silently create a second.
2. Present the **architecture block** (retrospective layer) — idioms, antipatterns, effect on stage structure. Wait for confirmation / edits.
3. Pick a `<prefix>` (3–4 letters from the feature name) yourself — never ask the user. Ensure no collision with an existing prefix in `plans/`.
4. Create `plans/<prefix>-00-index.md` with `status: active` and filled sections.
5. Create **all** step files at once — not lazily. Each with goal, Definition of done, sub-task checkboxes.
6. Show the user the list of created files.

No preceding discussion in context — recommend `/work-grill` first.
