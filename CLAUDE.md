# Code Memory Service

## Specs

Before starting work, read the specification in [`specs/`](specs/), starting
with [`specs/00-overview.md`](specs/00-overview.md). It records the design and
implementation nuances that must be accounted for.

## Skills

Skills live in `skills/` at the repo root — **not** in `.claude/skills/`. They are not loaded when working on this repo; they install into the target project's `.claude/skills/` (copied or linked) and run there.

Cross-references between skills are location-agnostic: name the skill, not a path (e.g. "the `work` skill's `core.md`"), since repo storage and runtime location differ.

## Writing skills

A skill says **what to do**, not why. Write it clearly, structurally, imperatively.

### Style

- Imperative instructions and `case → action` lists. No literary prose, no rationale paragraphs, no rhetoric.
- No illustrative examples — they explain what is already obvious and burn context. Structural examples are allowed: templates, command forms, URI formats.
- A short reason fragment is allowed only when it changes a decision in an edge case. If a "why" affects no decision, cut it.
- No hard line limit — a skill is as long as its content genuinely needs. But terseness applies at every length; do not burn context.
- Consistent terminology — one term per concept.
- No time-sensitive info.

### Progressive disclosure

- The SKILL.md is always loaded. It must be self-sufficient for the **normal** path.
- Deferred content (deep rationale, edge-case detail) may go to a companion file, loaded on demand.
- Split only when the companion content is genuinely doubt-only. If a file would be read on the normal path anyway, splitting wins nothing — keep one file.
- Every pointer to a companion file carries its trigger condition: "unsure about X → see Y". A pointer with no condition is invisible — the file stays unread.

### Description (frontmatter)

The description is the only thing the agent sees when choosing whether to load the skill.

- Third person, max ~1024 chars.
- First sentence — what the skill does.
- Second sentence — "Use when [specific triggers]": keywords, contexts, file types, or the explicit slash command.

### Review checklist

- [ ] Description has what-it-does + explicit triggers.
- [ ] Imperative throughout — no prose, no why-paragraphs, no illustrative examples.
- [ ] SKILL.md self-sufficient for the normal path.
- [ ] Companion pointers carry a trigger condition.
- [ ] Cross-references name the skill, not a path.
- [ ] Consistent terminology, no time-sensitive info.
