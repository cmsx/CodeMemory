---
name: work-done
description: Finalize a whole /work plan — sync decisions into the spec and into code memory. Triggered ONLY by the explicit command /work-done.
---

# /work-done — finalize a plan

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context).

## Behavior

1. Run `/work-prime` (basic) — skip if project context already loaded this session.
2. Read the index in full and the spec parts it references in Контекст и ограничения. Confirm all stages are `[x]` — if not, warn and ask whether the plan is really closing.
3. Verify everything planned is implemented in code.
4. Walk the index sections as a checklist, not in bulk. For each Decision / Deviation / Edge case / Open question:
   - Apply the spec/memory fork from `core.md` § Memory integration.
   - Memory capture — run `/mem`. At finalize, additionally consolidate and cross-link stage-level notes, and add feature-level notes that only make sense now.
   - Edge cases not covered in code/tests — raise before closing.
   - Open questions still open — warn.
5. Ambiguous places — ask the user. Do not apply spec edits without confirmation.
6. Once spec and memory are updated and confirmed — change `status: active` to `status: completed` in the index frontmatter.
7. Do not delete plan files — deletion is manual.
8. Report: spec updated in N places, N notes to memory, plan completed, files left for manual deletion.
