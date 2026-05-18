---
name: work-grill
description: Relentlessly interview the user about a plan or design until shared understanding is reached. Discussion only — never writes files. Triggered ONLY by the explicit command /work-grill (optionally with a topic).
---

# /work-grill — discussion

Read the `work` skill's `core.md` once per session before proceeding (skip if already in context). Apply the **Imperative layer** of Architectural thinking and **Question style**.

Recommend Opus — one line at the start, no waiting.

## Start

1. `/work-grill prime [topic]` — run `/work-prime` (basic) first; otherwise skip priming.
2. Topic — text after `grill` (excluding a leading `prime`). No topic — ask the user for it.
3. Pull spec or plan files as the topic requires.
4. `search` per the `mem` skill's `core.md`: by the topic, and again for each new area the discussion branches into.

## Grill discipline

- Interview the user relentlessly about every aspect until shared understanding is reached. 
- Walk each branch of the decision tree, resolving dependencies one by one. 
- For each question give your recommended answer. 
- If a question can be answered by exploring — explore (search memory first, then read code), do not ask.
- Criticize proposals, surface edge cases, name assumptions, flag conflicts with existing Decisions or spec conventions.
