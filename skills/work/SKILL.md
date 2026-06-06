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

1. Resolve the plan: `@<path>` → that index; no argument → the single `plans/*-00-index.md` with `status: active`. None or several active without an argument → refuse, report, ask for `@<path>`. Read the index in full.
2. Find the current stage — the first one without `[x]` in `## Этапы`. Read its `<prefix>-NN-<slug>.md` step file in full, including `## Рабочие заметки`.
3. **Reconnaissance — decide the route, load context to match.** State the route in one explicit line. The rules floor — the `specs/` root incl. `RULES.md` (the index is read in step 1) — is always loaded; the routes differ on the domain map.
   - A current `run-<NN>.md` exists → use it. This is also re-entry after an interruption — a fresh context returns through the map instead of researching the stage again. Load the rules floor; take the domain map from the run-file's `## Сущности` slice.
   - No run-file → **delegate** by default (`этап крупный → делегирую разведку`). The map is the norm: it carries the stage's full context and anchors that re-entry — stage size is not the gate. Load only the rules floor yourself — do not pull the full `list_entities`. Spawn a general-purpose subagent on the Sonnet model and task it with invoking `/prepare @<index-path>` — the subagent runs the skill, `prepare` is not an agent type. It self-primes the domain map in its own context, writes the run-file, returns. Take entities from the run-file slice; reach for the full `list_entities` only through the run-file's escape hatch.
   - No run-file, and the stage is trivial — gathering is a couple of obvious reads, nothing to chart and no re-entry concern → **self** (`этап мал → читаю сам`). Run `/prime`, including the domain map, and scout the stage yourself.
4. **Ground before code.** Run-file present → read it: per-file coordinates, `[[id]]` notes (`get_notes`, one batched call), entities, plus the `## Grounding` `### Спецификации` pointers the stage needs. Self-read stage → ground from the `## Grounding` block (`### Спецификации` pointers and `get_notes` on the `### Память` `[[id]]`) and your quick scout. Report the status line.
5. Step file has `[x]` sub-tasks — work was interrupted. Continue from the first unchecked sub-task; do not restart done work.
6. Report briefly: which plan, which stage, the reconnaissance decision, any interrupted-work signs, the session plan.
7. Work the stage — reason the HOW (signatures, data structures, approach, test strategy) from the map, then write the code and the tests. On the first touch this session of a file or symbol neither the run-file nor the `## Grounding` block covered, ground that area before editing it (Grounding an area, below); report the status line. Check off `[x]` sub-tasks as they complete. Write `## Рабочие заметки` along the way, recording the `[[id]]` of notes that genuinely added understanding — not every note found.
8. After renaming a symbol or file in the codebase, call `rename_anchor(old_uri, new_uri)` so note links do not go `stale`.
9. Before pausing or ending a turn, reconcile the step file: every done sub-task `[x]`, every needed working note present.
10. Stage finished (sub-tasks `[x]`, Definition of done met) — run the full project test suite. ALL tests must pass. Do not advance to `/step-done` with any failing or skipped test; fix within the stage, or raise it if the failure is out of scope.

Do not capture to memory mid-stage — capture is owned by `/step-done`.

## Grounding an area

To **ground** an area touched during the stage is to consult both sources before editing it, not memory alone.

- **Spec** — the system is intricate and runs on deliberate, vetted decisions, not on defaults. When the governing spec for the area is deeper than what `/prime` loaded (the `specs/` root and the plan index), read the relevant files — only those the task needs, never a whole layer or the whole tree.
- **Code Memory** (why it is so, where not to step) — **anchored search** on the area's entities, files, and symbols; those are the coordinates in hand. Report the status line.

A touched layer or note left unread surfaces later as a blind spot — the change breaks an invariant or a cross-module flow it never saw.

### Reading triggers — when to ground

Grounding is gated on a discrete context-shift event, never on a per-turn audit. Two axes:

- **Horizontal (breadth):** a file or symbol not yet touched this session and not covered by the plan's `## Grounding` block.
- **Vertical (depth):** reaching for a pattern, a data structure, or a mechanism not yet settled.

Inside an already-grounded area, routine edits need no re-query. Over-reporting a search is an antipattern.

## Search contract

A `search` call has two paths, each with its own yield — separate calls, never two fields of one call.

- **Anchored search** (`anchors`) is the precise, information-dense path: it returns the notes pinned to the exact nodes in hand. Anchors union by OR — pass every relevant anchor in one call. Use it whenever a coordinate is known.
- **Full-text search** (`query`) is the orienting path — Russian descriptive words, 1–2 rephrasings, BM25 over summary and body, OR by default (`strict: true` for AND). Reach for it when no coordinate is in hand: boundaries still fuzzy, not all relevant anchors known, or the anchored search came back empty.

Mixing the two in one call is an error: the paths rank by different measures, so the relevance cut breaks and retrieval comes back incomplete.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchored search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

Each search tied to a discrete unit of work reports a one-line status in chat: `память: нашёл N, пригодилось k` — counts only. The count cannot be written without searching — that is the point.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for chosen `id`s — one call for several; returns the full body of each note.
- To read code, take coordinates from the note's anchor map and the `list_symbols_in_file` symbol map — read the symbol range, not the whole file.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified; verify before acting.

## Testing discipline

Tests are mandatory, written in the same stage as the functionality, part of its Definition of done. Two filters, in order: **relevance** (worth a test, and at what level), then **completeness** (cover the target fully).

### Relevance — what earns a test

- **Presumption of test.** New code is tested by default; a skip is an explained exception in `## Рабочие заметки`, never silent. Legitimate: not soundly testable (exploratory UI → `ui` mode, proved by `/validate`); no behavior of ours (migration-only, rename, config). Logic inside such an edit — a data transform in a migration — is still tested.
- **Level decides, not the keyword.** Unit tests our logic in isolation; feature tests our usage scenarios. One subject splits by level: validation through framework `fillable`/casts is framework behavior, out of bounds; validation in a feature test — the rule fires, auth blocks — is our contract, in bounds.
- **Must-Not — framework behavior in isolation.** Do not test `fillable`/`guarded`, casts, a relation's bare presence, default CRUD, proxy accessors. A feature check that our contract holds is not this case.

### Completeness — cover the chosen target

- Tests are written against the requirements, not the written code. If the code disagrees with the intended behavior, the test fails and the code is wrong.
- **State-Machine & Flow Coverage.** For feature tests of multi-step flows (wizards, pipelines) coverage is not limited to the happy path. Cover state transitions, steps back, repeated calls, and attempts to enter invalid states.
- **Test Strategy Doc.** Before a complex feature test, briefly document — in a docblock or `## Рабочие заметки` — which states and transitions it will cover.
- **Red-Green.** A bug fix starts with a failing test that catches the wrong behavior, then the fix. Never fix first.
- Cover failure paths, not only the happy path — network errors, missing artifacts, invalid input, permission denials.
- End-to-end testing is its own plan tied to user stories, not part of a feature plan.
- A stage ends only when the full project test suite passes — no failing or skipped test carries into `/step-done`.

### Isolation & self-positioning

- **Framework isolation.** Reset environment state between tests through the framework's own mechanism (`RefreshDatabase`, transactional rollback), and confirm the test under work actually opts into it — not a hand-written teardown.
- **Self-positioning assertions.** Measure the baseline, then assert the delta or invariant the operation produces, so the test fails on its own behavior and never on residue from another test. Reserve an assertion on a concrete absolute state for the case that needs it, named as an exception in `## Рабочие заметки`.

### Development mode overlay

The stage's `## Режим разработки` marker selects the writing discipline — `standard` (the default, also when the marker is absent), `tdd`, or `ui`:

- **standard** — the normal flow: the full Testing Discipline above, code and its tests written together in the stage, with no strict test-first ordering on new functionality. The bug-fix Red-Green rule still holds — it belongs to the Testing Discipline, not to this overlay.
- **tdd** — adds the strict Red-Green-Refactor overlay below, generalizing the bug-fix Red-Green to all new functionality.
- **ui** — overlay off: the stage is exploratory UI or markup where a test cannot precede the code, proved by the UI validation branch (`/validate`) on its linked story instead.

Under the `tdd` overlay the order is strict, one failing test at a time:

- **Red** — write a single failing test for the next required behavior; run it and confirm it fails for the intended reason.
- **Green** — write the minimal code that makes it pass, no more than the test demands.
- **Refactor** — an explicit third phase while green: remove duplication and clarify names with the suite as the safety net.

The `tdd` overlay generalizes the bug-fix Red-Green above to all new functionality; everything else in this section — relevance, against requirements, level, state-machine coverage, failure paths — is inherited unchanged by every mode.

## Working notes discipline

`## Рабочие заметки` in the step file records only the struggle and the decisions: what was tried, why it failed, which new invariant surfaced. A retelling of the diff is forbidden — "renamed the variable", "extracted a method". The code is in git; these notes keep the residue git cannot show.

## Interaction mode

Attended or autonomous — whether the stage may block on the user — set by the
invocation channel and orthogonal to Code Mode: an inline `/work` is attended; a
`/work` spawned as a subagent is always autonomous.

- **attended** — when in doubt, ask the user before proceeding.
- **autonomous** — never block on a question. An obvious default or settled
  best-practice is decided in place and logged to `## Рабочие заметки`; a choice
  that needs a human — a deferred mock, an unresolved blocker — is carried back
  to the spawning parent as a pointer in the return, never asked as a blocking
  question.
