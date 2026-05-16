---
name: work-prime
description: Load project context at the start of a session — read the spec and any active /work plan index. Triggered ONLY by the explicit command /work-prime (or /work-prime full). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-prime — load project context

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context).

Load context so later work can proceed freely — answering questions, discussing code, helping with tasks outside the `/work` cycle. Starts no mode and implies no next step.

## Variants

- `/work-prime` — basic: only top-level documents of the spec.
- `/work-prime full` — full: all of `specs/` recursively. For deep architecture discussion.

## Behavior (basic)

1. Read **only the files at the root of `specs/`** — no subfolders. The root holds architectural overviews; subfolders hold detailed feature specs not needed for a basic load.
2. If there is an active plan (`plans/*-00-index.md`, `status: active`) — read **only the index**, not step files.
3. If the project is connected to Code Memory — call `list_entities` for the domain entity map. Do not `search` — that is topic-specific and `/work-prime` has no topic.
4. **Report what was loaded** — a short list of files, one or two lines, plus the active plan and whether the domain map was loaded. No retelling of content.

## Behavior (`full`)

1. Read all of `specs/` recursively.
2. Active plan — index only, as in basic mode.
3. Domain entity map via `list_entities`, as in basic mode.
4. Report the loaded files and subfolders, plus the active plan if any.

## Do NOT

- Retell spec content — the report is a list of loaded files, not a summary.
- Ask questions.
- Propose next steps.
- Read plan step files or project code.

If `specs/` is empty or absent and there is no active plan — say so briefly and propose nothing.
