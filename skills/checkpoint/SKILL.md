---
name: checkpoint
description: Saves the partial progress of an in-flight /work stage so a fresh session can restart cleanly — assesses what is done, checks off completed sub-tasks, and records where work stopped and the next step into the step file's working notes. Use only when explicitly invoked as /checkpoint, typically mid-stage when the context has grown large.
---

# /checkpoint — save stage progress for restart

Starts no Mode. Mid-stage, when the context has grown large, this saves the stage's state into the step file so a fresh `/work` can restart without re-deriving it. The forbidden-set below carries the guard a Mode would otherwise give.

Communicate with the user in Russian. Write all plan files and notes in Russian. Skill instructions are English — this does not change the output language.

## Forbidden

This skill saves state; it does not close the stage. Its terminal effects are the opposite of `/step-done`:

- Do **not** capture to Code Memory (`/mem`) — capture is owned by `/step-done` on a green stage; mid-stage findings stay in the step file.
- Do **not** delete the `<prefix>-run.md` — it is preserved scaffolding a fresh `/work` re-reads on re-entry.
- Do **not** check the stage `[x]` in the index — the stage is unfinished.
- Do **not** touch `specs/`.

## Behavior

1. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
2. The current stage = the first one without `[x]` in `## Этапы`. Read its `<prefix>-NN-<slug>.md` step file in full: `## Подзадачи`, `## Definition of done`, `## Рабочие заметки`.
3. **Assess readiness** (lens below) — this is the `/step-done` finished-check inverted: it records partial progress instead of gating on full completion.
4. **Check off** every sub-task actually complete: `[ ]` → `[x]` in `## Подзадачи`. Leave unfinished sub-tasks unchecked.
5. **Record** into `## Рабочие заметки`: the session's findings and decisions, then a closing marker — where work stopped and the next concrete step. Struggle and decisions only, never a diff retelling (discipline below).
6. Report: which plan and stage, which sub-tasks are now `[x]`, what remains, where a fresh `/work` resumes.

## Readiness assessment

Walk the step file once against its own checklist:

- **Sub-tasks** — which are done, which are not.
- **Definition of done** — for each item: closed, partial, or untouched.
- **Remainder** — what is left, and the next concrete action to take it up.

The visible artifact is this picture written into `## Рабочие заметки` before stopping.

## Re-entry

No separate resume section is introduced. A fresh `/work` resumes on its normal mechanics: it starts from the first unchecked sub-task and reads `## Рабочие заметки`, including the marker this skill left.

## Working notes discipline

`## Рабочие заметки` records only the struggle and the decisions: what was tried, why it failed, which new invariant surfaced. A retelling of the diff is forbidden — "renamed the variable", "extracted a method". The code is in git; these notes keep the residue git cannot show.
