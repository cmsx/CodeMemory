---
name: work-plan
description: Create a new /work plan from the preceding discussion. Triggered ONLY by the explicit command /work-plan.
---

# /work-plan — create a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. No preceding discussion in context — recommend `/work-grill` first, stop.
3. Active plan already exists — warn, ask what to do; do not silently create a second.
4. Present the **architecture block** (retrospective layer) — idioms, antipatterns, effect on stage structure. Wait for confirmation / edits.
5. Pick a `<prefix>` (3–4 letters from the feature name) yourself — never ask the user. Ensure no collision with an existing prefix in `plans/`.
6. Create `plans/<prefix>-00-index.md` with `status: active` and filled sections. Fill `## Память` with the note `[[id]]` and `file:`/`symbol:` anchors `/work-grill` surfaced as useful for implementation.
7. Create **all** step files at once — not lazily. Each with goal, Definition of done, sub-task checkboxes.
8. Show the user the list of created files.
