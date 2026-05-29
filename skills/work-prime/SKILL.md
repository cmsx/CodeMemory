---
name: work-prime
description: Loads session context — the project's base specs, the active /work plan index if one exists, and the domain map via list_entities. Use when explicitly invoked as /work-prime, when another /work command runs its context-loading step, or at the start of a session before working on project code.
---

# /work-prime — load project context

Starts no Mode, proposes no next step. A document load only.

Communicate with the user in Russian. Skill instructions are English — this does not change the output language.

## Behavior

1. Read the base specs — files at the root of `specs/`, no subfolders.
2. Active plan — the single `plans/*-00-index.md` with `status: active`. Read its index only, not the step files. More than one `status: active` — list them and load none; the user resolves the active plan when a `/work-*` command runs (priming stays non-blocking).
3. Call `list_entities` to load the domain map.
4. Report what loaded: a short file list, the active plan name, and the domain map as a count — `домен-карта: N сущностей`. The count proves `list_entities` ran.

`specs/` empty or absent and no active plan — say so in one line.

## Do not

- Read plan step files or project code.
- `search` memory — priming is a document load; topical search belongs to the work that follows.
- Retell spec content.
- Ask questions or propose next steps.
