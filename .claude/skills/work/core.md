# /work — shared core

This file holds the shared discipline for all `/work-*` commands. Each entry point reads it once per session, before its specific job — if its content is already in context, do not re-read.

Communicate with the user in Russian. Write all plan files, notes, and spec edits in Russian. Skill instructions are in English for token economy; this does not change the language of output.

## What this is

A workflow for planning and step-by-step execution of non-trivial tasks, where the plan survives across sessions. Unlike built-in plan mode (lives one session), `/work` persists the plan as files in `plans/`, accumulates a log of decisions and deviations, and tracks progress between sessions.

The `/work-*` commands activate **only** by explicit invocation. A user talking about planning, breaking work into steps, or todo lists without invoking a command is NOT a trigger — keep working normally.

## Commands

- `/work-prime` — load project context (starts no mode).
- `/work-grill` — relentless discussion of a plan or decision. Never writes files.
- `/work-plan` — create a new plan from the discussion.
- `/work-update [@path]` — apply a discussion outcome to an active plan (default) or the one at `@path`.
- `/work [@path]` — execute the current stage of the active plan (default) or the one at `@path`.
- `/work-step-done` — close the current stage.
- `/work-done` — close the whole plan.

Planning is composed from small verbs: `/work-prime` → `/work-grill` → `/work-plan` or `/work-update`. Each command is one explicit phase — the model knows exactly what is being done and cannot run ahead into writing files.

## Key invariants

1. **One active plan at a time.** If `plans/` has several `*-00-index.md` with `status: active` — refuse to act and ask for an explicit `@<path>`.
2. **Flat `plans/`.** No subfolders. File names: `<prefix>-NN-<slug>.md` — `<prefix>` is 3–4 letters, `NN` is a two-digit number with a leading zero (`00` for the index).
3. **`plans/` is in `.gitignore`.** Plans are the developer's personal space. Source of truth is the spec in `specs/`, which is committed. A plan can be rebuilt from the spec.
4. **Progress = checkboxes in the index.** No separate status fields. The first stage without `[x]` in the index stage list is the current one. Sub-task checkboxes inside a step file allow resuming interrupted work.
5. **Files are written only on an explicit signal.** `/work-grill` never writes. Files appear only via `/work-plan` or `/work-update`.
6. **Spec lives in `specs/`.** Fixed path, not stored in frontmatter.

## Stage granularity

A stage = one atomic meaningful commit. Not too small (not "add an import"), not too large (not "do the backend"). Good split axes: layers (mock → real); sequential integration (service A → service B); refactor → feature; per-module.

A commit need not be buildable/runnable (work is on a branch) but must represent one meaningful unit of change. Do not smear identical actions across commits; do not mix unrelated concerns in one.

## Note taxonomy

The index keeps five separate sections. Do not pile everything into one.

- **Decisions** — settled decisions with rationale. "Chose X over Y because Z."
- **Deviations** — where the real implementation left the plan and why.
- **Edge cases** — what not to forget to check or cover with tests in later stages.
- **Future ideas** — ideas deferred beyond the current task.
- **Open questions** — what needs clarification from the user.

During a stage, detailed notes go in `## Working notes` of the step file. On `/work-step-done` they are summarized and moved into the right index sections.

## Design discipline

**Avoid antipatterns — do not just make it run.** Left implicit, the model optimizes for "it works" and emits code smells. Watch the recurring categories:

- control-flow sprawl — long `if`/`switch` chains, deep nesting;
- layer mixing — controller logic in a model, IO in a domain object, business rules in a view;
- duplication — copy-pasted branches instead of one abstraction.

You already recognize these — apply that recognition by default, not only when asked. This is not a license for the opposite extreme: do not invent abstractions or force patterns where a simple explicit solution is clearer. The goal is the idiomatic structure, not patterns for their own sake.

**Use what the framework provides.** Before hand-writing logic, ask what mechanism the framework already has for it — authorization (policies, guards), validation (form requests), events, middleware, ORM features. The framework's intended mechanism is the default, not a hand-rolled equivalent — and this holds even for a task that looks small, because tasks evolve and raw `if`s that should have been a policy become a rewrite. If the proper mechanism needs user agreement or adds a constraint, flag it — but the default stands: build it the way the framework intends.

## Testing discipline

Tests are mandatory and written **together with the functionality** — in the same stage, part of its Definition of done, not deferred to a later stage. Default levels: unit and feature. End-to-end testing is normally its own plan tied to specific user stories, not part of a feature plan.

**Test against the spec, not against the code.** The default LLM failure is to write tests that exercise whatever the code happens to do, so they go green — that locks in the current behavior, including its bugs. Write the test for what the behavior *should* be per the spec and the intended contract; if the code disagrees, the test should fail and the code is what is wrong.

**Cover failure, not just the happy path.** A thought-out test covers variations of the successful chains *and* the planned failure points — network problems, missing or deleted artifacts, invalid input, permission denials. List these when designing the stage, not after.

**Bug workflow — reproduce first.** When the user reports a bug: first write the test(s) that catch the wrong behavior (and fail), then fix the code until they pass. Never fix first and test after.

## Architectural thinking

**Goal:** keep decisions and stage structure from drifting away from framework idioms and established design practice. The imperative layer applies to all planning commands (`/work-grill`, `/work-plan`, `/work-update`); the retrospective layer is owned by `/work-plan` and `/work-update` — the commands that write. Not on execution.

### Imperative layer — on entry

Before proposing structure or a solution: read the project's convention docs in `specs/` if they exist, and treat their conventions as binding. Deviations require explicit justification in discussion. If there is no such doc — rely on widely accepted framework idioms, and note explicitly which conventions were assumed. Framework built-in mechanisms are the default solution from the start, not a fallback (see Design discipline) — shape the plan around them. Take existing Decisions/Deviations from the active index as already-settled constraints.

### Retrospective layer — before writing

`/work-plan` and `/work-update` present an architecture block right before writing files: applicable framework idioms and why; antipatterns avoided here; effect on stage structure. This is a visible part of the chat, not an internal check. `/work-grill` does not present it — grilling is discussion; the block belongs to the write step.

When a pattern is chosen, name it explicitly in the plan — in the relevant step file's goal or the index Decisions — so the executing model latches onto it rather than re-deriving the structure.

Do not invent abstractions for the sake of the check. If the task is simple and the standard mechanism is obvious — say so. A short honest block is valid.

## Question style

Applies everywhere clarification is needed.

**Do not dump questions in a heap.** Ask one at a time, wait for the answer, then move on.

- **Short question** — one sentence, expects a short answer (a choice, yes/no, a name/number) — use the interactive question widget if available.
- **Complex or open question** — needs a discursive answer or discussion — ask as plain text, wait, move on. Do not use the widget.

## Memory integration

If the project is connected to the Code Memory Service (the `mem` skill is present), `/work` integrates with it. Otherwise this section is inert.

**Division of labor:**

- `specs/` — business level: business logic, descriptions, user stories (BA/PM language); the DB model; a dry catalog of architectural and code-design patterns.
- code memory — everything about code: implementation, processes, relationships, "how we got here".

Reading from memory is instructed by each command that needs it (`/work-prime`, `/work-grill`, `/work` execution) — not centrally here. The ambient `mem` skill also does reading on its own triggers.

**Writing (plan → memory):**

- `/work-step-done` — capture code/implementation knowledge to memory via `/mem`, with `status: current` (the work was actually done, the knowledge is verified — no `draft` ceremony). The note is anchored to files/symbols and **stripped of plan-process metadata** — no "decided at stage 2", no "edge case from stage 3", no plan structure. That metadata stays in the plan index; the index may hold a `[[id]]` pointer to the note.
- `/work-done` — the main memory work. A crystallized decision forks: *what the system does / how to use it* → `specs/`; *how we got here, what was tried and rejected, why exactly so* → a code-memory note. Most plan decisions are implementation-level — they go to memory; `specs/` is touched only when business logic, the DB model, or a pattern actually changed.

**Never** put plan-process metadata (which stage, plan structure, deviation-from-plan) into memory.

**Resolving `[[id]]`.** Plan files — the index and step files — may contain `[[id]]` pointers to code-memory notes. Any command reading a plan file resolves a pointer via `get_notes` by that id when, and only when, the note's substance is needed for the work at hand — lazily, never eagerly on every read. When several pointers are needed at once, resolve them in a single `get_notes` call.

## Behavioral notes

- **Do not duplicate with a todo tool.** Native plan mode at launch plus step-file checkboxes are enough.
- **Index — navigation and strategy. Step file — detail and history.** Do not duplicate content between them.
- **When in doubt — ask the user**, one question at a time. Especially before potentially destructive operations (editing the spec, changing plan status).
- **Never delete plan files automatically.** Deletion is a manual user operation.

## Templates

### Index — `plans/<prefix>-00-index.md`

```markdown
---
feature: <feature name>
status: active
created: <YYYY-MM-DD>
---

# <Feature name>

## Цель
<briefly: why this work, what problem it solves>

## Контекст и ограничения
<what matters across all stages: architectural premises, constraints,
agreements, links to relevant spec parts>

## Этапы
- [ ] `<prefix>-01-<slug>.md` — short description
- [ ] `<prefix>-02-<slug>.md` — short description

## Decisions
<settled decisions with the "why">

## Deviations
<where the real implementation left the plan and why>

## Edge cases
<what to check / cover with tests in later stages>

## Future ideas
<ideas deferred beyond this task>

## Open questions
<needs clarification from the user>
```

### Step file — `plans/<prefix>-NN-<slug>.md`

```markdown
# Step NN — <stage name>

## Цель шага
<what we do and why — specific to this stage>

## Definition of done
- <criterion>

## Подзадачи
- [ ] <concrete action>

## Working notes
<written during work: what was tried, what failed, decisions made along
the way. On /work-step-done summarized and moved into the index.>
```
