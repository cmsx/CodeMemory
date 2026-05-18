---
name: work-grill
description: Relentlessly interview the user about a plan or design until shared understanding is reached. Discussion only — never writes files. Triggered ONLY by the explicit command /work-grill (optionally with a topic). Part of the /work workflow skill family. Never infer from conversation context.
---

# /work-grill — discussion

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context). Apply the **Imperative layer** of Architectural thinking and **Question style**. Do not present the architecture block — that belongs to `/work-plan` / `/work-update`.

Discusses only — never writes files. Recommend Opus for planning quality — one line at the start, no waiting.

## Start

- `/work-grill prime [topic]` — first invoke `/work-prime`, then proceed.
- Otherwise — start from session context; pull spec or plan files as the topic requires.
- If the topic touches existing code and the project is connected to Code Memory — `search` it by topic as part of that pull.
- As the discussion branches into a new area, `search` memory for that area too — not only the initial topic. Per the `mem` skill: the search scope is not fixed at the start.

## Topic

- Text after `grill` (excluding a leading `prime`) — the topic, start from it.
- No topic — ask the user for it.

## Grill discipline

Interview the user relentlessly about every aspect until shared understanding is reached. Walk each branch of the decision tree, resolving dependencies one by one. For each question give your recommended answer. Ask one question at a time (short → widget; open → plain text). If a question can be answered by exploring the codebase — explore, do not ask. Criticize proposals, surface edge cases, name assumptions, flag conflicts with existing Decisions or spec conventions.

Output is shared understanding in session context. The user then invokes `/work-plan` or `/work-update` to write it down — same session.
