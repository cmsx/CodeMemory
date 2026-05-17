---
name: work-step-done
description: Close the current stage of the active /work plan — summarize working notes into the index and capture code knowledge to memory. Triggered ONLY by the explicit command /work-step-done. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-step-done — close a stage

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

Called when the current stage is finished — tests pass, code reviewed, ready to commit.

## Behavior

1. Find the current stage (first without `[x]` in the index).
2. Read its step file, especially `## Working notes`.
3. Summarize the notes into the index sections: decisions → Decisions; plan departures → Deviations; things to check → Edge cases; later ideas → Future ideas; unresolved → Open questions.
4. Memory capture (if connected to Code Memory): `search` for an existing note on the same anchors/topic — if one exists, `update_note`, do not duplicate. Otherwise capture via `/mem`, `status: current`. Anchor to files/symbols; strip plan-process metadata (no "stage 2", no plan structure). The index keeps the process entry and may hold a `[[id]]` pointer.
5. Show the proposed index changes before writing. Apply only after confirmation.
6. Keep the summary brief — do not copy long Working-notes passages; reference the step file § Working notes if a detail is worth keeping verbatim.
7. Put `[x]` next to the stage in the index.
8. Leave the step file as is — Working notes stay as history.
9. Report: what closed, what was added to the index, note(s) to memory, the next stage.
