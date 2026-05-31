# /work — canon for the work skill family

Canonical rules for `/work-prime`, `/work-grill`, `/storyteller`, `/work-plan`,
`/work-update`, `/prepare`, `/work`, `/work-step-done`, `/work-done`. This file
is the author's source of truth: each skill inlines the slices it needs at
runtime. When this canon changes, re-derive every skill in the family from it.

Communicate with the user in Russian. Write all plan files, notes, and spec
edits in Russian. Skill instructions are English — this does not change the
output language.

## What this is

A workflow for planning and step-by-step execution of non-trivial tasks. State
lives in plan files under `plans/`, which persist across sessions, accumulate a
log of decisions and deviations, and track progress.

`/work-*` commands activate **only** on explicit invocation. Talk of planning,
steps, or todos without a command is not a trigger — keep working normally.

### The Linux Way

Skills are atomic small verbs, never mega-combinators. There is no "plan and
build" command. A skill's boundary is a phase boundary: the model cannot run
ahead (start coding mid-discussion) because the active skill holds no such
instructions. State passes between atomic skills through the plan files — the
plan is the data bus across sessions.

## Commands

| Command | Mode | Writes files | Job |
|---------|------|--------------|-----|
| `/work-prime` | — (system) | no | Load project context |
| `/work-grill` | Ask → Architect | no | Discuss and settle the approach |
| `/storyteller` | Architect | yes (`specs/`) | Convert a settled need into a System-Aware Story |
| `/work-plan` | Architect | yes (`plans/`) | Create a new plan |
| `/work-update` | Architect | yes (`plans/`) | Apply a discussion outcome to a plan |
| `/prepare` | Reconnaissance | yes (`plans/` run-file) | Scout the current stage; produce the run-file map |
| `/work` | Code | yes (code, tests) | Execute the current stage |
| `/work-step-done` | Architect | yes (`plans/`, memory) | Close the current stage |
| `/work-done` | Architect | yes (`specs/`, memory) | Close the whole plan |

## Modes

Modes are framing mindsets, not separate tools — the command stays atomic, the
Mode sets what is allowed inside it. Each Mode forbids the work of the next, so
the model holds focus instead of running ahead. A standard skill copies its
Mode block below verbatim as its mode declaration; skill-specific constraints
stay in the skill body, not in the block.

### Ask Mode — requirements
Surface business goals, constraints, scope. Ask one question at a time.
Forbidden: proposing any technical implementation (pattern, table, mechanism).

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan,
spec, or note files when the skill calls for it. Forbidden: generating
production code.

### Code Mode — execution
Mechanically write code and tests for the current stage. Forbidden: changing
specs or plans without explicit user permission.

### Mode-shift as a grounding trigger

The boundary between Modes is the most dangerous drift point: crossing from Ask
("what we want") to Architect ("which pattern/queue/table we use") is exactly
when the model's framework training weights light up and override project rules.

At that boundary the model pauses and grounds before proposing anything: a
mandatory `search` of memory on the active area, plus the governing spec where
it bears on the choice (the pattern catalog, a contract). Any shift toward
"how" — a new pattern, a data structure, a mechanism — fires this. It is the
vertical trigger below.

## Structured CoT

Judgment skills (`/work-grill`, `/work-plan`, `/work-update`) do not run a
`case → action` checklist. They walk an explicit cognitive trajectory before
producing output:

1. Name the entities / files / symbols the branch touches.
2. State the assumptions that must hold.
3. Search memory to confirm or disprove; report the status line.
4. Integrate findings using the Synthesis Form.
5. Propose, or ask the next question.

A step may be skipped only visibly — the absent artifact is the signal. The
trajectory is itself imperative: each step is a concrete formulation, never an
exhortation to "think carefully".

## Synthesis Form

Knowledge from memory is integrated into the narrative, never quoted raw and
handed to the user to interpret.

```
Я планировал <X>, но согласно [[id]] мы избегаем этого из-за <Y>,
поэтому предлагаю <Z>.
```

Wrong: "Вот что я нашёл: [[id]] говорит о Y. Давай делать Z." — the model owns
the synthesis, not the user.

## Memory integration

How to search, read, anchor, and capture lives in the `mem` skill's `core.md`,
including the `память: нашёл N, пригодилось k` status line. This section is only
the work-side division of labor: **when** each command touches memory.

### specs vs memory — the watershed

- `specs/` — the system is intricate and runs on deliberate, vetted decisions,
  not on defaults, recorded across a layered `specs/` tree. `/work-prime` loads
  only the root (incl. `RULES.md`) and the plan index. The specs root index
  maps the layers; on entering an area, use it to work out which layers the
  change will touch and read how each prescribes the work — only the files
  relevant to the task, never a whole layer or the whole tree.
- code memory — "why it is so and how it is built": ADRs, point invariants,
  pitfalls, rejected alternatives, anchored to concrete classes and algorithms.
  Queried by **anchored search** on the node before editing it — the entity,
  file, or symbol in hand is the coordinate; **full-text search** only when no
  such coordinate exists or the anchored search came back empty.

A fact answering "how should the system behave" → `specs/`. A fact answering
"how we wrote the code to make it work, and where not to step" → memory.

A touched layer or note left unread surfaces later as a blind spot — the change
breaks an invariant or a cross-module flow it never saw.

### Reading triggers — when a command searches

Grounding is gated on a discrete context-shift event, never on a per-turn
audit (over-reporting is an antipattern). Two axes:

- **Horizontal (breadth):** a business entity, file, or feature not yet
  discussed this session.
- **Vertical (depth):** the shift from business requirements ("what") to
  technical realization ("how" — choosing a pattern, a DB structure). This is
  the Ask→Architect boundary.

On the trigger the model pauses and grounds before proposing — from **both**
sources per the watershed: it reads the governing spec for the area when that
spec is deeper than what `/work-prime` loaded (the root specs and the plan
index), and queries code memory for its invariants and pitfalls. Neither
source is skipped on a horizontal trigger — the focus on memory does not
retire the spec.
On routine turns inside an already-grounded area the block is omitted.
`/work-grill`, `/work-update`, `/work`, and `/prepare` instruct their concrete
reads.

### Grounding references in the plan

The index holds a `## Grounding` block that persists both watershed sources, so
the grounding done once in discussion is not re-discovered every session:

- **`### Спецификации`** — pointers to the spec files relevant to the plan: the
  path plus a one-line note of what it holds for this work. A pointer with a
  hint, not a spec summary — duplicating spec content into the plan is forbidden
  (the spec stays the source). It saves re-finding the layer, not re-reading
  it: the model reads the file when the substance is needed.
- **`### Память`** — `[[id]]` of notes and any useful anchors (`entity:`,
  `file:`, `symbol:`, `env:`), each with a one-line note of its use. Resolve
  `[[id]]` via `get_notes` lazily — only when the substance is needed, several
  pointers per call.

`/work-grill` collects both while discussing; `/work-plan` and `/work-update`
write them in; `/work` reads the block on stage start as the pointer to what to
load before editing.

## Reconnaissance and the run-file

`/prepare` is the reconnaissance phase that front-loads a stage's context
discovery so `/work` does not spend its own context re-exploring. It produces a
map — pointers, not content — and writes it to a run-file; it never designs the
implementation (the HOW stays in `/work`).

Division of labor:

- `/prepare` — discovery and relevance: which files, symbols, notes, and
  entities the stage touches, where to look, and why each matters. Relevance
  verdicts, never implementation prescriptions.
- `/work` — the HOW (signatures, structures, approach, test strategy) and the
  code, reasoned from the map.

### Delegation

A stage's reconnaissance is heavy — a wide fan-out of search and full reading.
`/work` delegates it to a subagent by default: reaching a stage with no current
run-file, it spawns a subagent to run the `/prepare` reconnaissance, which
writes the run-file and returns; the heavy load burns in the disposable context
while `/work`'s stays clean. Only a clearly small stage — one `/work` can cover
with a quick read itself — skips delegation. Either way `/work` states the
decision in one explicit line (`этап крупный → делегирую разведку` / `этап мал
→ читаю сам`) so it does not slip by.

The delegation branch also splits the context load. `/work` loads only the
rules floor itself — the `specs/` root incl. `RULES.md`, and the plan index —
and skips the full `list_entities`; the subagent self-primes the domain map in
its disposable context and returns the relevant entity slice in the run-file.
The self-read branch runs `/work-prime` in full, the domain map included.

`/prepare` invoked directly by the user runs inline in the main thread (manual
preparation); the skill itself is orchestration-neutral — spawning is the
caller's job.

### The run-file

One `<prefix>-run.md` per plan — the current stage's scaffolding. Overwritten on
each stage, gitignored with the rest of `plans/`, deleted by `/work-step-done`
when the stage closes. It carries the reconnaissance map (template in
`docs/consumer-guide/formats.md`): the stage scope, a per-file relevance verdict
with coordinates, the relevant notes (`[[id]]` + why), the relevant entities,
what was checked and ruled out, and an escape hatch for deeper research.

Persisting for the whole stage is deliberate. The map is the stage's context
bundle — sized to the atomic unit of work, not to a file count — and its second
role is re-entry: if a large stage is interrupted and the context reset, a fresh
`/work` re-reads the existing run-file and resumes through its pointers instead
of researching the stage again. Delegation is therefore the norm; only a stage
trivial enough that one quick read covers it skips reconnaissance.

When a run-file is present, `/work` leans on its entity slice instead of loading
the full domain map, and follows the escape hatch (`list_entities` + full-text
search) only if execution needs research the map did not cover.

### Writing — plan to memory

Capture is owned by the `mem` family; the work side only routes into it.

- `/work-step-done` — capture new code knowledge via `/mem`. Strip
  plan-process metadata (no "stage 2", no plan structure) — that metadata stays
  in the index, which may hold a `[[id]]` pointer.
- `/work-done` — the main memory work. A decision forks at the watershed:
  *what the system does / how to use it* → `specs/`; *how we got here, what was
  tried and rejected* → a memory note. Touch `specs/` only when business logic,
  the data model, or a pattern changed.

Never capture mid-stage, and never put plan-process metadata into memory.

## Key invariants

1. One active plan at a time. Resolving the plan for a command that takes an
   optional `@<path>`: `@<path>` → that index; no argument → the single
   `plans/*-00-index.md` with `status: active`; none or several active without
   an argument → refuse, report, ask for `@<path>`.
2. Flat `plans/`, no subfolders. File names `<prefix>-NN-<slug>.md`: `<prefix>`
   3–4 letters, `NN` two digits with leading zero (`00` = index).
3. `plans/` is gitignored. Source of truth is `specs/`, which is committed.
4. Progress = checkboxes in the index. The first stage without `[x]` is
   current. Sub-task checkboxes in step files allow resuming.
5. Files are written only on an explicit signal. `/work-grill` never writes —
   only `/work-plan`, `/work-update`, `/storyteller`, and the closing commands do.
6. Spec lives in `specs/`. Fixed path.

## Stage granularity

A stage = one atomic meaningful commit. Not "add an import", not "do the
backend". Split axes: layers (mock → real), sequential integration, refactor →
feature, per-module. A commit need not be runnable but must be one meaningful
unit of change. Do not smear identical actions across commits; do not mix
unrelated concerns in one.

## Index note taxonomy

The index keeps four separate sections — do not merge them:

- **Решения** — settled decisions with rationale.
- **Отклонения** — where implementation left the plan, and why.
- **Edge cases** — what to check or cover with tests in later stages.
- **Открытые вопросы** — what needs user clarification.

During a stage, detail goes in `## Рабочие заметки` of the step file.
`/work-step-done` summarizes them into the index sections.

## Design discipline

The architectural framing applies to all planning commands (`/work-grill`,
`/work-plan`, `/work-update`); a retrospective check belongs to `/work-plan`
and `/work-update`. Neither applies on execution.

**On entry to planning.** Read the convention docs in `specs/code/` and treat
them as binding; deviations require explicit justification. No such doc — rely on
framework idioms and state which were assumed. Take existing
Решения/Отклонения from the active index as settled constraints.

**Before writing a plan.** `/work-plan` and `/work-update` present an
architecture block in chat: applicable framework idioms, antipatterns avoided,
effect on stage structure. When a pattern is chosen, name it in the plan. A
short honest block is valid — do not invent abstractions for the check.

Avoid these antipatterns by default, not only when asked:

- control-flow sprawl — long `if`/`switch` chains, deep nesting;
- layer mixing — controller logic in a model, IO in a domain object, business
  rules in a view;
- duplication — copy-pasted branches instead of one abstraction.

Use framework mechanisms by default — authorization (policies, guards),
validation (form requests), events, middleware, ORM features — not hand-rolled
equivalents. If the proper mechanism needs user agreement or adds a constraint,
flag it; the default still stands. Do not invent abstractions where a simple
explicit solution is clearer.

## Testing discipline

- Tests are mandatory, written in the same stage as the functionality, part of
  its Definition of done.
- Tests are written against the requirements, not the written code. If the code
  disagrees with the intended behavior, the test fails and the code is wrong.
- **Unit vs Feature.** Unit tests for isolated algorithms and DTOs; feature
  (functional) tests for usage scenarios.
- **State-Machine & Flow Coverage.** For feature tests of multi-step flows
  (wizards, pipelines) the happy path alone is forbidden. Cover state
  transitions, steps back, repeated calls, and attempts to enter invalid
  states.
- **Test Strategy Doc.** Before a complex feature test, briefly document — in a
  docblock or `## Рабочие заметки` — which states and transitions it will cover.
- **Red-Green.** A bug fix starts with a failing test that catches the wrong
  behavior, then the fix. Never fix first.
- Cover failure paths, not only the happy path — network errors, missing
  artifacts, invalid input, permission denials.
- End-to-end testing is its own plan tied to user stories, not part of a
  feature plan.
- A stage ends only when the full project test suite passes — no failing or
  skipped test carries into `/work-step-done`.

## Working notes discipline

`## Рабочие заметки` in the step file records only the struggle and the
decisions: what was tried, why it failed, which new invariant surfaced. A
retelling of the diff is forbidden — "renamed the variable", "extracted a
method". The code is in git; these notes keep the residue git cannot show.

## Question style

- Ask one question at a time. Wait for the answer, then move on. Never dump
  questions in a heap.
- Short question (a choice, yes/no, a name) — use the interactive widget if
  available.
- Complex or open question — ask as plain text.
- A confirmation — plain text, no widget; pre-fill the answer with «да» so the
  user confirms in one keystroke.

## Behavioral notes

- Do not duplicate with a todo tool — the plan files plus step-file checkboxes
  are enough.
- Index — navigation and strategy. Step file — detail and history. Do not
  duplicate content between them.
- When in doubt — ask the user. Editing the spec or changing plan status is
  not such a case: both are tracked in git and follow already-settled
  decisions, so apply them without a re-confirmation pause.
- Never delete plan files automatically — deletion is manual.

## Templates

The canonical plan templates — index and step file — live in
`docs/consumer-guide/formats.md`; the System-Aware Story template in
`docs/consumer-guide/user-stories.md`; the role-structured note bodies in
`specs/04-note-authoring.md`.
`/work-plan`, `/work-update`, and `/storyteller` inline the slice they produce.
The role-structured note templates belong to the `mem` family; the work side
references them through `/mem`.

## Reference — plan-mode design pass (dormant)

Not inlined by any active skill. Kept here so a future author can restore it
without digging through git. Earlier `/work` ran a design pass when launched
under harness plan mode: map the stage's files, translate the settled
architectural decisions (the plan's `## Grounding`, the index Решения, the
governing spec) into concrete code-level decisions (signatures, data structures,
approach, test strategy) as an approval artifact — decisions, not code —
reviewed before any code was written. Superseded by `/prepare` (discovery) plus
`/work`'s intrinsic Code Mode HOW reasoning; the harness blocks writes under
plan mode on its own.

## Cross-references

The `mem` skill family owns memory: search, anchor, capture, note structure,
and the status line. This family depends on it one-directionally — it calls
`/mem` for capture and follows `mem`'s search discipline. `mem/core.md` does
not mention this family.
