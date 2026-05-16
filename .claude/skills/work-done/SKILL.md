---
name: work-done
description: Finalize a whole /work plan — sync decisions into the spec and into code memory. Triggered ONLY by the explicit command /work-done. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-done — finalize a plan

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context).

Finalizes the whole plan. The main job is to synchronize accumulated decisions and logic with the spec and with code memory.

## Behavior

1. Read the index. Confirm all stages are `[x]`. If not — warn and ask for confirmation that the plan really is closing.
2. Verify everything planned is implemented in code.
3. Read the spec from `specs/`.
4. **Walk the index sections as a checklist, not in bulk.** For each Decision / Deviation / Edge case / Open question:
   - The decision **forks** (see Memory integration in `core.md`): *what the system does / how to use it* → `specs/`; *how we got here, what was tried and rejected, why* → a code-memory note via `/mem`.
   - `specs/` is touched **only** when business logic, the DB model, or a pattern actually changed — most implementation-level decisions go to memory, not the spec.
   - Memory: `search` first to avoid duplicates; consolidate and cross-link existing stage-level notes; add feature-level notes that only make sense now.
   - Edge cases — all covered in code/tests? If not, raise before closing.
   - Open questions — should be resolved by now. If any are still open — warn.
5. In ambiguous places — ask the user, one question at a time. Do not apply spec edits without confirmation.
6. Once the spec and memory are updated and confirmed — change `status: active` to `status: completed` in the index frontmatter.
7. **Do not delete plan files.** Deletion is manual.
8. Report: spec updated in N places, N notes to memory, plan marked completed, files left for manual deletion.
