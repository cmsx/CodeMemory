---
name: work-update
description: Apply the outcome of a discussion to an active /work plan — record decisions, add stage(s), or amend the plan. Triggered ONLY by the explicit command /work-update (optionally /work-update @<path>).
---

# /work-update — update a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. Resolve the plan (`core.md` invariant 1).
3. Search memory for the entities and symbols this update touches. Staged, separate calls — never mix `query` and `anchors` in one call:
   - `search anchors: ["entity:<E>"]` — one call per entity.
   - `search query: "<тема обновления>"` — Russian descriptive words, 1–2 rephrasings; AND-combined; `any_term: true` only on fuzzy recall.
   - `search anchors: ["file:<path>"]` / `["symbol:<path>::<Name>"]` — one call per file or symbol touched.
   - `get_notes` — batched on chosen hits.
   - Resolve `[[id]]` pointers in the touched plan sections via `get_notes`.

   Report: `память: нашёл N, пригодилось k`.
4. Present the **architecture block** (retrospective layer) for the change. Wait for confirmation / edits.
5. Apply the outcome:
   - **New stage(s)** — create step file(s) with the next number(s); add checkbox line(s) to the end of Этапы (or right after the current stage if "next / urgent"). Show a draft of each step file before creating.
   - **Notes** — add to the relevant index section (Decisions / Edge cases / Open questions / Future ideas / Память).
   - **Amendment** — edit the plan per the discussion.
6. Always show the proposed wording before writing; confirm.
