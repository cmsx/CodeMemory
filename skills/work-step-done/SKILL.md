---
name: work-step-done
description: Close the current stage of the active /work plan — summarize working notes into the index and capture code knowledge to memory. Triggered ONLY by the explicit command /work-step-done.
---

# /work-step-done — close a stage

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. Find the current stage. Read its step file, especially `## Working notes`.
3. Summarize the `## Working notes` into the index note sections (taxonomy in `core.md`). Keep it brief — reference the step file § Working notes for detail worth keeping verbatim, do not copy long passages.
4. Memory capture — run `/mem`; see `core.md` § Memory integration for the work-specific part.
5. Show the proposed index changes before writing. Apply only after confirmation.
6. Put `[x]` next to the stage in the index. Leave the step file as is — Working notes stay as history.
7. Report: what closed, what was added to the index, note(s) to memory, the next stage.
