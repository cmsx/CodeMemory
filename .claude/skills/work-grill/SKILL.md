---
name: work-grill
description: Relentlessly interview the user about a plan or design until shared understanding is reached. Discussion only — never writes files. Triggered ONLY by the explicit command /work-grill (optionally with a topic). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-grill — discussion

Read `.claude/skills/work/core.md` once per session before proceeding (skip if already in context). Apply the **Imperative layer** of Architectural thinking and the **Question style** section. Do not present the architecture block — that belongs to `/work-plan` / `/work-update`.

This command **only discusses** — it never writes files. Materializing the outcome is done by `/work-plan` or `/work-update`. This separation is the point: the discussion phase cannot leak into writing, the user controls the transition.

For quality planning Opus is recommended — note this in one line at the start, no waiting.

## Start

If invoked with the `prime` argument (`/work-grill prime [topic]`) — first invoke the `/work-prime` skill to load project context, then proceed. Otherwise start directly from the context already in the session; pull spec or plan files only as the discussion topic requires. If the topic touches existing code and the project is connected to Code Memory — `search` it by topic as part of that targeted pull.

## Topic

- Text after `grill` (excluding a leading `prime` argument) — that is the topic, start from it.
- No topic — briefly ask the user for the topic.

## Grill discipline

Interview the user relentlessly about every aspect of the plan or design until shared understanding is reached. Walk down each branch of the decision tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer. Ask one question at a time (short question → the interactive widget; open question → plain text — see Question style in `core.md`). If a question can be answered by exploring the codebase — explore instead of asking. Actively criticize proposals, surface edge cases, name assumptions, point out conflicts with existing Decisions or spec conventions.

The result is shared understanding held in session context. The user then invokes `/work-plan` or `/work-update` to write it down. This discussion does not persist on its own — `/work-grill` and the writing command belong to one session.
