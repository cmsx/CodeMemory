---
name: work
description: Execute the current stage of the active /work plan. Triggered ONLY by the explicit command /work (optionally /work @<path-to-index>).
---

# /work — execute a stage

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. Resolve the plan (`core.md` invariant 1) and read its index in full. Read the spec parts referenced in Контекст и ограничения.
3. **Reality check:** scan the codebase and `git log` for done-but-unchecked stages, or checked stages with no trace in code. Anything off — report and ask before proceeding.
4. Find the current stage.
5. Read the current step file in full, including `## Working notes`.
6. `search` the stage's area before editing per the `mem` skill's `core.md` (`entity:` then `file:`); resolve via `get_notes` the index `## Память` pointers relevant to this stage. Report the one-line status `память: нашёл N, пригодилось k`. Honor any `stale` anchor or `critical` note.
7. Step file has `[x]` sub-tasks — work was interrupted. Continue from the first unchecked sub-task, do not restart.
8. Report briefly: which plan, which stage, interrupted-work signs, the session plan.
9. Work the stage. On entering a sub-task whose file/symbol area was not yet searched this session, `search` memory first and report the one-line status `память: нашёл N, пригодилось k`. Check off `[x]` sub-tasks as you go; write Working notes along the way, recording the `[[id]]` of notes that genuinely added understanding — not every note found.
10. Before pausing or ending a turn — reconcile the step file: every done sub-task `[x]`, every needed Working note present.

Do not capture to memory mid-stage — capture is owned by `/work-step-done`.

## Under plan mode

Plan mode at launch = an instruction for deep planning. The plan file is WHAT/WHY; the plan-mode job is HOW, detailed enough to execute mechanically.

1. Read the index and current step file.
2. Load every file the stage will change and every file needed for implementation decisions.
3. Apply relevant index Decisions/Deviations to the step detail.
4. Turn sub-tasks into concrete detail: which files, which signatures, which data structures, which tests with which inputs and outputs.
5. Put everything needed for execution into the plan — signatures, data structures, file references. Do not write code fragments into the plan, except where a complex solution needs specific code shown to be unambiguous.
6. A genuinely trivial step — justify explicitly. Do not shorten silently.
