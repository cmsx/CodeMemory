---
name: work-update
description: Apply the outcome of a discussion to an active /work plan — record decisions, add stage(s), or amend the plan. Triggered ONLY by the explicit command /work-update (optionally /work-update @<path>). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-update — update a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

Applies a `/work-grill` outcome to an active plan: record decisions, add stage(s), or amend the plan.

## Resolving the plan

- No argument — the active plan. More than one or none — report, ask for `@<path>`.
- `@<path>` — the given index.

## Behavior

1. If connected to Code Memory — `search` the entities and symbols this update touches before proposing anything; resolve `[[id]]` pointers in the touched plan sections via `get_notes`.
2. Present the **architecture block** (retrospective layer) for the change. Wait for confirmation / edits.
3. Apply the outcome:
   - **New stage(s)** — create step file(s) with the next number(s); add checkbox line(s) to the end of Этапы (or right after the current stage if "next / urgent"). Show a draft of each step file before creating.
   - **Notes** — add to the relevant index section (Decisions / Edge cases / Open questions / Future ideas).
   - **Amendment** — edit the plan per the discussion.
4. Always show the proposed wording before writing; confirm.
