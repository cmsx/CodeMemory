---
name: work-update
description: Apply the outcome of a discussion to an active /work plan — record decisions, add stage(s), or amend the plan. Triggered ONLY by the explicit command /work-update (optionally /work-update @<path>).
---

# /work-update — update a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. Resolve the plan (`core.md` invariant 1).
3. `search` the entities and symbols this update touches per the `mem` skill's `core.md`; resolve `[[id]]` pointers in the touched plan sections via `get_notes`.
4. Present the **architecture block** (retrospective layer) for the change. Wait for confirmation / edits.
5. Apply the outcome:
   - **New stage(s)** — create step file(s) with the next number(s); add checkbox line(s) to the end of Этапы (or right after the current stage if "next / urgent"). Show a draft of each step file before creating.
   - **Notes** — add to the relevant index section (Decisions / Edge cases / Open questions / Future ideas).
   - **Amendment** — edit the plan per the discussion.
6. Always show the proposed wording before writing; confirm.
