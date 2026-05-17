---
name: mem-onboarding
description: Use to seed the Code Memory Service when connecting it to an existing project — a one-time, multi-session procedure that extracts a starting set of notes from existing sources. Invoked explicitly as /mem-onboarding.
---

# Code Memory — onboarding

Used only when connecting the service to an already existing project, to give a starting seed. The main mode of work is organic growth via capture in live sessions (see the `mem` skill).

Communicate with the user in Russian. Write all note content in Russian. Skill instructions are in English for token economy.

Onboarding is skill-driven: no dedicated MCP tools or CLI commands. Everything is over the ordinary tools — `search`, `get_notes`, `create_note`, `create_entity`, `update_note`.

## 1. Structural index — automatic

The `symbol_index` (built via tree-sitter so `symbol:` anchors resolve) is bootstrapped automatically: the service performs a full index when it starts on a project with an empty index. Nothing for you to run — symbol anchors resolve from the first chunk.

## 2. Setup

The human explains the **transformation logic**: where the sources live, how raw material maps to notes (e.g. "specs in `docs/`, a `##`-level section = one note").

Declare **starting entities**: suggest candidates from the code structure, the human prunes, register the approved ones via `create_entity`.

## 3. Chunk loop

The source is fed in parts — it cannot all be absorbed in one pass. For each chunk:

1. Read the chunk, determine which entities and files it is about.
2. `search` with `include_drafts: true` — are there already related notes. The flag is required: notes from earlier chunks are `draft` and a default `search` will not return them.
3. Decide: `create_note` with `status: draft` (new knowledge), `update_note` (refine an existing one), or skip (already covered).
4. Drop the raw chunk text before the next one.

**The store as working memory:** between chunks the raw text is dropped so it does not bleed into interpreting the next document. But notes from earlier chunks stay reachable via `search` with `include_drafts: true` — that is dedup instead of duplicates.

## 4. Review

Draft notes are reviewed by the human — in a batch or along the way — and promoted to `current` via `update_note`. Unverified stays `draft`.

To enumerate the whole store — see what exists, check statuses, eyeball how notes turned out — call `search` with `match_all: true` together with `include_drafts: true` (a compact `id` + `summary` list of every note). `match_all` is a standard `search` parameter, but its place is here: it is the onboarding way to inventory the base. In routine work you search by anchors/text — never reach for `match_all` as a shortcut.

## Scratch file

Onboarding is multi-session. Between sessions persist `.memory/onboarding.md`: the plan, transformation rules, a source checklist (done / queued / skipped). Scaffolding — removed on completion.

## Fuzzy sources

If a source has no explicit intent to document decisions (tests, migrations, general docs):

- A note is created only with a **verifiable source artifact**: the symbol exists per the index, the test is an articulated invariant.
- "Why it is so" with no explicit source is **not reconstructed** — that is interpretation, the LLM will fill the gap with invention.
- When unsure — investigation form: `Verified` / `Hypothesis`, hypotheses marked explicitly.
- General conceptual documentation with no tie to code is not turned into notes.

## Boundary of automation

Only the **articulated** goes into a note — what is in the spec, in the discussion, in a verifiable artifact. Extraction is translation of a source, not reconstruction of general notions.
