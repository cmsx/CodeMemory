---
name: work-prime
description: Load project context at the start of a session — read the spec and any active /work plan index. Triggered by the explicit command /work-prime (or /work-prime full), and invoked by the other /work commands as their context-loading step.
---

# /work-prime — load project context

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

Starts no mode, implies no next step.

Other `/work` commands invoke `/work-prime` as their first step and state the depth. A direct `/work-prime` defaults to basic; `/work-prime full` selects full.

## Depth

- **basic** — spec files at the root of `specs/` only, no subfolders.
- **full** — all of `specs/` recursively.

## Behavior

1. Read spec files at the selected depth.
2. Active plan (`plans/*-00-index.md`, `status: active`) — read the index only, not step files.
3. Call `list_entities`. Do **not** `search` here — priming is a document load only; topical search belongs to the work that follows (see the `mem` skill's `core.md`).
4. Report what was loaded — a short file list, the active plan, whether the domain map loaded. No content retelling.

## Do not

- Retell spec content.
- Ask questions.
- Propose next steps.
- Read plan step files or project code.

`specs/` empty or absent and no active plan — say so briefly, propose nothing.
