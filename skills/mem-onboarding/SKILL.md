---
name: mem-onboarding
description: Seed the Code Memory Service when connecting it to an existing project — a one-time, multi-session procedure that extracts a starting set of notes from existing sources. Invoked explicitly as /mem-onboarding.
---

# /mem-onboarding — seed Code Memory

Read the `mem` skill's `core.md` once per session before proceeding (skip if already in context).

## 1. Structural index

Automatic — the service full-indexes a project with an empty index on startup. `symbol:` anchors resolve from the first chunk. Nothing to run.

## 2. Setup

- The human explains the transformation logic: where sources live, how raw material maps to notes.
- Declare starting entities: suggest candidates from the code structure, the human prunes, register approved ones via `create_entity`.

## 3. Chunk loop

Feed the source in parts. For each chunk:

1. Read the chunk; determine its entities and files.
2. `search` with `include_drafts: true` — earlier-chunk notes are `draft` and a default `search` misses them.
3. Decide: `create_note` with `status: draft` (new), `update_note` (refine), or skip (covered).
4. Anchor every note per `core.md` § Anchors.
5. Drop the raw chunk text before the next.

## 4. Review

The human reviews draft notes and promotes them to `current` via `update_note`. Unverified stays `draft`.

To inventory the whole store — `search` with `match_all: true` and `include_drafts: true` (compact `id` + `summary` list of every note). `match_all` belongs here only — never use it as a shortcut in routine work.

## Scratch file

Multi-session. Persist `.memory/onboarding.md` between sessions: plan, transformation rules, source checklist (done / queued / skipped). Remove on completion.

## Fuzzy sources

A source with no explicit intent to document decisions (tests, migrations, general docs):

- Create a note only with a verifiable source artifact — the symbol exists per the index, the test is an articulated invariant.
- Do not reconstruct "why it is so" without an explicit source — the LLM will invent.
- Unsure — investigation form (`Verified` / `Hypothesis`), hypotheses marked explicitly.
- General conceptual documentation with no code tie — not a note.

## Boundary of automation

Only the articulated goes into a note — what is in the spec, the discussion, or a verifiable artifact.
