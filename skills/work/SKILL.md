---
name: work
description: Executes the current stage of the active /work plan in Code Mode — loads the plan's grounding, writes code and tests against the requirements, keeps working notes, and stops only when the full test suite is green. Use only when explicitly invoked as /work (optionally /work @<path-to-index>).
---

# /work — execute a stage

Code Mode. Execute the first unchecked stage of the active plan: load its grounding, write the code and the tests, keep the working notes, stop on green.

### Code Mode — execution
Mechanically write code and tests for the current stage. Forbidden: changing specs or plans without explicit user permission.

Communicate with the user in Russian. Write all plan files and notes in Russian. Skill instructions are English — this does not change the output language.

## Behavior

1. Run `/work-prime` if project context is not yet loaded this session.
2. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
3. Find the current stage — the first one without `[x]` in `## Этапы`. Read its `<prefix>-NN-<slug>.md` step file in full, including `## Рабочие заметки`.
4. Ground from the plan's `## Grounding` block before writing code: read the `### Спецификации` pointers whose substance the stage needs, and `get_notes` on the `[[id]]` from `### Память` (one batched call). Report the status line.
5. Step file has `[x]` sub-tasks — work was interrupted. Continue from the first unchecked sub-task; do not restart done work.
6. Report briefly: which plan, which stage, any interrupted-work signs, the session plan.
7. Work the stage. On the first touch this session of a file or symbol the `## Grounding` block did not already cover, ground that area before editing it (Grounding an area, below); report the status line. Check off `[x]` sub-tasks as they complete. Write `## Рабочие заметки` along the way, recording the `[[id]]` of notes that genuinely added understanding — not every note found.
8. After renaming a symbol or file in the codebase, call `rename_anchor(old_uri, new_uri)` so note links do not go `stale`.
9. Before pausing or ending a turn, reconcile the step file: every done sub-task `[x]`, every needed working note present.
10. Stage finished (sub-tasks `[x]`, Definition of done met) — run the full project test suite. ALL tests must pass. Do not advance to `/work-step-done` with any failing or skipped test; fix within the stage, or raise it if the failure is out of scope.

Do not capture to memory mid-stage — capture is owned by `/work-step-done`.

## Under plan mode

Plan mode active at launch = a design pass over the current stage, reviewed before any code. Run through the implementation, map it onto the architectural decisions already settled (the plan's `## Grounding`, the index Решения, the governing spec), and translate them into concrete code-level decisions. The plan files carry WHAT/WHY at stage granularity; this pass produces the HOW.

1. Read the index and the current step file; ground the stage up front (Grounding an area, below).
2. Load every file the stage will change and every file a decision depends on.
3. For each sub-task, decide and state: which files change, the signatures and data structures, the chosen approach, and the test strategy — which states, transitions, and failure paths to cover (Testing discipline, below).
4. A genuinely trivial stage — justify that explicitly; do not shorten silently.

Decisions, not code. Write no production code and no test code in this pass — writing it is the executor's job, and front-loading it leaves the executor nothing but a file save. Express a point as the approach in prose; a short fragment is allowed only when it clarifies a decision better than words can — an illustration of the choice, never the implementation to hand off.

This is elaboration of an already-settled stage, not a re-opening of architecture — patterns and scope belong to `/work-grill` and `/work-plan`.

The pass produces the approval artifact, not a file write. On approval, execute it — now the code and tests get written.

## Grounding an area

To **ground** an area touched during the stage is to consult both sources before editing it, not memory alone.

- **Spec** — the system is intricate and runs on deliberate, vetted decisions, not on defaults. When the governing spec for the area is deeper than what `/work-prime` loaded (the `specs/` root and the plan index), read the relevant files — only those the task needs, never a whole layer or the whole tree.
- **Code Memory** (why it is so, where not to step) — `search` Code Memory on the area's anchors and topic, then report the status line.

A touched file or note left unread surfaces later as a blind spot — the change breaks an invariant or a cross-module flow it never saw.

### Reading triggers — when to ground

Grounding is gated on a discrete context-shift event, never on a per-turn audit. Two axes:

- **Horizontal (breadth):** a file or symbol not yet touched this session and not covered by the plan's `## Grounding` block.
- **Vertical (depth):** reaching for a pattern, a data structure, or a mechanism not yet settled.

Inside an already-grounded area, routine edits need no re-query. Over-reporting a search is an antipattern.

## Search contract

A `search` call takes two independent axes; they do not mix in one call:

- **`anchors`** — an arbitrary set of relevant anchors of any kind (`entity:`, `file:`, `symbol:`, `env:` mixed freely). OR by default: the result is the union over the set. Pass every relevant anchor in one call.
- **`query`** — Russian descriptive words for the topic; 1–2 rephrasings. OR over keywords, BM25 ranks the densest hit first. `strict: true` switches to AND — every term must match.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchor search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

Each search tied to a discrete unit of work reports a one-line status in chat: `память: нашёл N, пригодилось k` — counts only. The count cannot be written without searching — that is the point.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for the chosen `id`s — one call for several; returns the full body of each.
- `[[id]]` mentioned-notes block inside a body — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, never silently ignore.
- `draft` note or `## Гипотезы` section — flag as unverified; verify before relying on it.

## Testing discipline

- Tests are mandatory, written in the same stage as the functionality, part of its Definition of done.
- Tests are written against the requirements, not the written code. If the code disagrees with the intended behavior, the test fails and the code is wrong.
- **Unit vs Feature.** Unit tests for isolated algorithms and DTOs; feature (functional) tests for usage scenarios.
- **State-Machine & Flow Coverage.** For feature tests of multi-step flows (wizards, pipelines) the happy path alone is forbidden. Cover state transitions, steps back, repeated calls, and attempts to enter invalid states.
- **Test Strategy Doc.** Before a complex feature test, briefly document — in a docblock or `## Рабочие заметки` — which states and transitions it will cover.
- **Red-Green.** A bug fix starts with a failing test that catches the wrong behavior, then the fix. Never fix first.
- Cover failure paths, not only the happy path — network errors, missing artifacts, invalid input, permission denials.
- End-to-end testing is its own plan tied to user stories, not part of a feature plan.
- A stage ends only when the full project test suite passes — no failing or skipped test carries into `/work-step-done`.

## Working notes discipline

`## Рабочие заметки` in the step file records only the struggle and the decisions: what was tried, why it failed, which new invariant surfaced. A retelling of the diff is forbidden — "renamed the variable", "extracted a method". The code is in git; these notes keep the residue git cannot show.
