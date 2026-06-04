---
name: finalize
description: Finalize a completed /work plan — split the plan's accumulated decisions across the specs-vs-memory watershed, update specs and capture plan-global ADRs via /mem, then mark the plan completed. Use only when explicitly invoked as /finalize.
---

# /finalize — finalize a plan

Architect Mode (consolidation). Every stage is built and checked; this reflects across the whole plan and routes its decisions: behavior-and-usage facts into `specs/`, plan-global "how/why" into Code Memory, then the plan is marked `completed`.

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

This skill edits `specs/` and captures memory notes only — no production code. The plan's record files — the index and step files — are never deleted automatically; that is manual.

Communicate with the user in Russian. Write all spec edits and notes in Russian. Skill instructions are English — this does not change the output language.

## Behavior

1. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
2. Confirm every stage in `## Этапы` is `[x]`. Any stage unchecked → report which remain and stop; do not finalize an unfinished plan.
3. Review the index's four sections — Решения, Отклонения, Edge cases, Открытые вопросы — as the plan's accumulated knowledge. Edge cases still uncovered by code or tests, and Открытые вопросы still open → attended: raise with the user before closing; autonomous: surface them in the return and stop without marking `completed`, leaving escalation to the parent (`## Interaction mode`).
4. **Classify** the plan's decisions at the watershed (trajectory below) — the routing list, produced before any write.
5. **Update specs** for the spec-side items.
6. **Capture** each plan-global ADR via `/mem`, collecting its `[[id]]`.
7. **Mark completed**: change `status: active` → `status: completed` in the index frontmatter.
8. **Sweep the run-files**: delete the plan's `plans/<prefix>/run-<NN>.md` reconnaissance files.
9. Report: which spec files changed and where, which `[[id]]` captured, that the plan is `completed`, and that the plan's record files are left for manual deletion.

## Classification

Walk the index's Решения and Отклонения once. For each decision decide where it belongs at the watershed; the visible artifact is the routing list, produced before any write.

A decision can fork to both sides — the behavior into a spec, the reasoning into a note. Strip plan-process metadata from anything bound for specs or memory — no "stage 2", no plan structure; that history stays in the index.

Most stage-level "how/why" was already captured by `/step-done`, and those index lines carry their `[[id]]` — do not re-capture them. At finalize the memory work is **plan-global**: consolidate or cross-link the stage notes where the whole now reads as one decision, and add feature-level notes that only make sense across the completed plan.

### specs vs memory — the watershed

- `specs/` — the system is intricate and runs on deliberate, vetted decisions, not on defaults, recorded across a layered `specs/` tree. A fact answering *"how should the system behave / how is it used"* belongs here — business rules, the data model, contracts, new routes. Touch `specs/` only when business logic, the data model, or a pattern actually changed.
- code memory — *"why it is so and how it is built"*: ADRs, point invariants, pitfalls, rejected alternatives, anchored to concrete classes and algorithms. A fact answering *"how we wrote the code to make it work, and where not to step"* belongs here.

A spec layer or a note left unwritten surfaces later as a blind spot — the next change breaks an invariant or a contract it never saw.

## Capture to memory

For each plan-global ADR, run `/mem`. `/mem` runs its own dedup search, drafts the role-structured note, saves it, and returns `[[id]]` — do not re-implement any of it. Its dedup search is also what keeps already-captured stage notes from being duplicated.

This is the plan's final capture point — fold the stage-level residue into the lasting picture, do not restate the diff.

## Marking completed

Edit only the `status:` field in the index frontmatter: `active` → `completed`. Leave the stages, sections, and Grounding block intact — the finalized index stays as the plan's record.

## Interaction mode

Attended or autonomous, orthogonal to Architect Mode and set by the invocation
channel: an inline `/finalize` is attended — it may stop and ask the user; a
`/finalize` spawned as a subagent is always autonomous — no channel to a person,
so it never blocks on a question and falls back to its stop-and-surface exit
(step 3) instead.
