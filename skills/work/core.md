# /work — shared core

Shared discipline for all `/work-*` commands. Each entry point reads this once per session before its job; skip if already in context.

Communicate with the user in Russian. Write all plan files, notes, and spec edits in Russian. Skill instructions are English — this does not change the output language.

## What this is

A workflow for planning and step-by-step execution of non-trivial tasks. The plan persists as files in `plans/`, accumulates a log of decisions and deviations, tracks progress across sessions.

`/work-*` commands activate **only** on explicit invocation. Talk of planning, steps, or todos without a command is not a trigger — keep working normally.

## Commands

- `/work-prime` — load project context. Starts no mode.
- `/work-grill` — discuss a plan or decision. Writes no files.
- `/work-plan` — create a new plan from the discussion.
- `/work-update [@path]` — apply a discussion outcome to a plan.
- `/work [@path]` — execute the current stage.
- `/work-step-done` — close the current stage.
- `/work-done` — close the whole plan.

## Key invariants

1. One active plan at a time. Several `*-00-index.md` with `status: active` — refuse, ask for an explicit `@<path>`.
2. Flat `plans/`, no subfolders. File names `<prefix>-NN-<slug>.md`: `<prefix>` 3–4 letters, `NN` two digits with leading zero (`00` = index).
3. `plans/` is gitignored. Source of truth is `specs/`, which is committed.
4. Progress = checkboxes in the index. The first stage without `[x]` is current. Sub-task checkboxes in step files allow resuming.
5. Files are written only on an explicit signal. `/work-grill` never writes — only `/work-plan` and `/work-update` do.
6. Spec lives in `specs/`. Fixed path.

## Stage granularity

A stage = one atomic meaningful commit. Not "add an import", not "do the backend". Split axes: layers (mock → real), sequential integration, refactor → feature, per-module. A commit need not be runnable but must be one meaningful unit of change. Do not smear identical actions across commits; do not mix unrelated concerns in one.

## Note taxonomy

The index keeps five separate sections — do not merge them:

- **Decisions** — settled decisions with rationale.
- **Deviations** — where implementation left the plan, and why.
- **Edge cases** — what to check or cover with tests in later stages.
- **Future ideas** — ideas deferred beyond this task.
- **Open questions** — what needs user clarification.

During a stage, detailed notes go in `## Working notes` of the step file. `/work-step-done` summarizes them into the index sections.

## Design discipline

Avoid these antipatterns by default, not only when asked:

- control-flow sprawl — long `if`/`switch` chains, deep nesting;
- layer mixing — controller logic in a model, IO in a domain object, business rules in a view;
- duplication — copy-pasted branches instead of one abstraction.

Do not invent abstractions where a simple explicit solution is clearer.

Use framework mechanisms by default — authorization (policies, guards), validation (form requests), events, middleware, ORM features — not hand-rolled equivalents. If the proper mechanism needs user agreement or adds a constraint, flag it; the default still stands.

## Testing discipline

- Tests are mandatory, written in the same stage as the functionality, part of its Definition of done.
- Test against the spec, not the code. Write the test for intended behavior; if the code disagrees, the test fails and the code is wrong.
- Cover failure paths, not only the happy path — network errors, missing artifacts, invalid input, permission denials. List them when designing the stage.
- Bug workflow: first write a failing test that catches the wrong behavior, then fix. Never fix first.
- End-to-end testing is its own plan tied to user stories, not part of a feature plan.

## Architectural thinking

The imperative layer applies to all planning commands (`/work-grill`, `/work-plan`, `/work-update`). The retrospective layer belongs to `/work-plan` and `/work-update`. Neither applies on execution.

**Imperative layer — on entry.** Before proposing structure: read convention docs in `specs/` and treat them as binding. Deviations require explicit justification. No such doc — rely on framework idioms and state which were assumed. Take existing Decisions/Deviations from the active index as settled constraints.

**Retrospective layer — before writing.** `/work-plan` and `/work-update` present an architecture block before writing files: applicable framework idioms, antipatterns avoided, effect on stage structure. Visible in chat. When a pattern is chosen, name it in the plan (step file goal or index Decisions). A short honest block is valid — do not invent abstractions for the check.

## Question style

- Ask one question at a time. Wait for the answer, then move on. Never dump questions in a heap.
- Short question (a choice, yes/no, a name) — use the interactive widget if available.
- Complex or open question — ask as plain text.

## Memory integration

Active only if the project is connected to the Code Memory Service (`mem` skill present). Otherwise this section is inert.

**Division of labor:**

- `specs/` — business level: business logic, user stories, the DB model, a dry catalog of patterns.
- code memory — everything about code: implementation, processes, relationships, "how we got here".

**Reading.** Searching memory is mandatory when planning or preparing an implementation — it holds the decisions, invariants, and edge cases that shape the work and are not visible in code. During implementation memory is on call, not a per-step gate: check it before a non-trivial edit or when a contract is in question. See the `mem` skill. `/work-grill`, `/work-update`, and `/work` execution instruct their concrete reads.

**Writing (plan → memory):**

- `/work-step-done` — capture code/implementation knowledge via `/mem`, `status: current`. Anchor the note to files/symbols; strip plan-process metadata (no "stage 2", no plan structure). That metadata stays in the index, which may hold a `[[id]]` pointer.
- `/work-done` — the main memory work. A decision forks: *what the system does / how to use it* → `specs/`; *how we got here, what was tried and rejected* → a code-memory note. Most decisions are implementation-level → memory; touch `specs/` only when business logic, the DB model, or a pattern changed.

Never put plan-process metadata into memory.

**Resolving `[[id]]`.** Plan files may hold `[[id]]` pointers to memory notes. Resolve via `get_notes` only when the note's substance is needed — lazily, never eagerly on every read. Resolve multiple pointers in one `get_notes` call.

## Behavioral notes

- Do not duplicate with a todo tool — plan mode plus step-file checkboxes are enough.
- Index — navigation and strategy. Step file — detail and history. Do not duplicate content between them.
- When in doubt — ask the user, one question at a time. Especially before destructive operations (editing the spec, changing plan status).
- Never delete plan files automatically — deletion is manual.

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
