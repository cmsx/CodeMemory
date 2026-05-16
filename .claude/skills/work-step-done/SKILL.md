---
name: work-step-done
description: Close the current stage of the active /work plan — summarize working notes into the index and capture code knowledge to memory. Triggered ONLY by the explicit command /work-step-done. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-step-done — close a stage

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context).

Called when the current stage is finished (tests pass, code reviewed, ready to commit).

## Behavior

1. Find the current stage (first without `[x]` in the index).
2. Read its step file, especially `## Working notes`.
3. **Summarize the notes** into the right index sections: settled decisions with rationale → Decisions; departures from the original plan → Deviations; uncovered things to check → Edge cases; later ideas → Future ideas; unresolved → Open questions.
4. **Memory capture** (if the project is connected to Code Memory): first `search` for an existing note on the same anchors/topic — if one exists, `update_note` rather than creating a duplicate. Otherwise capture code/implementation knowledge via `/mem` with `status: current`. The note is anchored to files/symbols and **stripped of plan-process metadata** — no "stage 2", no plan structure. The index keeps the process-flavored entry and may hold a `[[id]]` pointer to the note. See the Memory integration section of `core.md`.
5. **Show the proposed index changes to the user before writing.** Apply only after confirmation.
6. Keep the summary brief — do not copy long passages from Working notes. If a detail is worth keeping verbatim, leave a reference to the step file § Working notes.
7. Put `[x]` next to the stage in the index.
8. Leave the step file as is — Working notes stay as a historical artifact.
9. Report: what was closed, what was added to the index, what note(s) went to memory, the next stage.
