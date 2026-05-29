---
name: work-step-done
description: Close the just-finished stage of the active /work plan — summarize its working notes into the index sections, capture durable code knowledge to Code Memory via /mem, and check the stage [x]. Use only when explicitly invoked as /work-step-done.
---

# /work-step-done — close a stage

Architect Mode (reflection). The stage is built and green; this reflects on its residue and routes it: a one-line summary into the plan index, durable code knowledge into Code Memory, then the stage checked `[x]`.

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

This skill writes the plan index and memory notes only — no production code, no spec changes (specs wait for `/work-done`).

Communicate with the user in Russian. Write all plan files and notes in Russian. Skill instructions are English — this does not change the output language.

## Behavior

1. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
2. The current stage = the first one without `[x]` in `## Этапы` — the one just executed. Read its `<prefix>-NN-<slug>.md` step file in full: `## Рабочие заметки`, `## Definition of done`, `## Подзадачи`.
3. Confirm the stage is actually finished — sub-tasks `[x]`, Definition of done met, the full test suite green per the `/work` contract. Not finished → report what remains and stop; do not close it.
4. **Classify** the working notes (trajectory below) — the routing list.
5. **Capture** each ADR-worthy item via `/mem`, collecting its `[[id]]`.
6. **Summarize** the classified items into the index sections, carrying `[[id]]` where one exists.
7. **Check off** the current stage `[x]`.
8. Report: which plan and stage closed, what went to the index, the `[[id]]` captured.

## Classification

Walk `## Рабочие заметки` once. For each residual item decide two things; the visible artifact is the routing list, produced before any write.

1. **Index role** — Решение / Отклонение / Edge case / Открытый вопрос (taxonomy below).
2. **ADR-worthy** — does it carry durable code knowledge: a technical decision, a found invariant, a discovered antipattern or pitfall? Yes → it also goes to Code Memory via `/mem`. A pure plan-process fact (which stage, a scope shuffle) is index-only. A diff retelling is neither — drop it.

An item can be both: a one-line Решение in the index **and** a full ADR in memory — the index line then carries its `[[id]]`.

## Index taxonomy

The index keeps four separate sections — do not merge them:

- **Решения** — settled decisions with rationale.
- **Отклонения** — where implementation left the plan, and why.
- **Edge cases** — what to check or cover with tests in later stages.
- **Открытые вопросы** — what needs user clarification.

The index is the plan-process log: this stage's settled choices, deviations, edge cases, open questions — one condensed line each, the residue, not the working-note prose. ADR substance lives in memory; the index holds the pointer, never a copy of the note body. A line whose item was also captured carries its pointer:

```markdown
- <одна строка сути решения> [[a3f9b]]
```

## Capture to memory

For each ADR-worthy item, run `/mem`. Strip plan-process metadata — no "stage 2", no plan structure; memory holds code knowledge, not plan history. `/mem` runs its own dedup search, drafts the role-structured note, saves it, and returns `[[id]]` — do not re-implement any of it. Write the returned `[[id]]` into the matching index line.

This is the capture point — never capture mid-stage, and never put plan-process metadata into memory.

## Checking off the stage

Edit only the current stage's line in `## Этапы`: `[ ]` → `[x]`. Leave every other stage untouched — never renumber, rewrite, or reopen another stage.
