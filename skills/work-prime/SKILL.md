---
name: work-prime
description: Load project context at the start of a session — read the spec and any active /work plan index. Triggered ONLY by the explicit command /work-prime (or /work-prime full). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-prime — load project context

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

Loads context for later work. Starts no mode, implies no next step.

## Variants

- `/work-prime` — basic: root-level spec documents only.
- `/work-prime full` — all of `specs/` recursively, for deep architecture discussion.

## Behavior

1. Read spec files:
   - basic — only files at the root of `specs/`, no subfolders.
   - full — all of `specs/` recursively.
2. Active plan (`plans/*-00-index.md`, `status: active`) — read the index only, not step files.
3. If connected to Code Memory — call `list_entities`. Do **not** `search` here — priming is a document load only. Topical memory search is mandatory in the work that follows, not at priming (see the `mem` skill).
4. Report what was loaded — a short file list, the active plan, whether the domain map loaded. No content retelling.

## Do not

- Retell spec content.
- Ask questions.
- Propose next steps.
- Read plan step files or project code.

`specs/` empty or absent and no active plan — say so briefly, propose nothing.
