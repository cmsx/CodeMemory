---
name: work-done
description: Finalize a whole /work plan — sync decisions into the spec and into code memory. Triggered ONLY by the explicit command /work-done. Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-done — finalize a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

Finalizes the whole plan: synchronize accumulated decisions with the spec and code memory.

## Behavior

1. Read the index. Confirm all stages are `[x]` — if not, warn and ask whether the plan is really closing.
2. Verify everything planned is implemented in code.
3. Read the spec from `specs/`.
4. Walk the index sections as a checklist, not in bulk. For each Decision / Deviation / Edge case / Open question:
   - The decision forks (see Memory integration in `core.md`): *what the system does / how to use it* → `specs/`; *how we got here, what was tried and rejected* → a code-memory note via `/mem`.
   - Touch `specs/` only when business logic, the DB model, or a pattern actually changed — most decisions go to memory.
   - Memory: `search` first to avoid duplicates; consolidate and cross-link stage-level notes; add feature-level notes that only make sense now.
   - Edge cases — all covered in code/tests? If not, raise before closing.
   - Open questions — if any still open, warn.
5. Ambiguous places — ask the user, one question at a time. Do not apply spec edits without confirmation.
6. Once spec and memory are updated and confirmed — change `status: active` to `status: completed` in the index frontmatter.
7. Do not delete plan files — deletion is manual.
8. Report: spec updated in N places, N notes to memory, plan completed, files left for manual deletion.
