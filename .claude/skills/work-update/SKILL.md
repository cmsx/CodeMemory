---
name: work-update
description: Apply the outcome of a discussion to an active /work plan — record decisions, add stage(s), or amend the plan. Triggered ONLY by the explicit command /work-update (optionally /work-update @<path>). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-update — update a plan

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context).

Applies the outcome of a `/work-grill` discussion to an active plan. A general verb: depending on what the discussion produced, it may record decisions into the Decisions section, add one or more stages, or amend the plan.

## Resolving the plan

- No argument — the active plan (`plans/*-00-index.md`, `status: active`). If more than one or none — report and ask for `@<path>`.
- `@<path>` — the given index.

## Behavior

1. Present the **architecture block** (retrospective layer of Architectural thinking) for the change. Wait for confirmation / edits.
2. Apply the outcome to the index and step files:
   - **New stage(s)** — create step file(s) with the next number(s), continuing the existing numbering; add checkbox line(s) to the **end** of the Этапы list (or right after the current stage if the user said "next / urgent"). Show a draft of each step file (Цель / DoD / Подзадачи) before creating.
   - **Notes** — add to the relevant index section (Decisions / Edge cases / Open questions / Future ideas). The note sections are part of the index that this command maintains — there is no separate command for them.
   - **Amendment** — edit the plan per the discussion.
3. Always show the proposed wording before writing; confirm.
