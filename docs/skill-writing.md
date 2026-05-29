# Writing skills

A skill tells an agent **what to do**, imperatively. Not why, not background.

## Frontmatter

```
---
name: <kebab-case, matches the directory name>
description: <see below>
---
```

- The closing `---` is on its own line. A description that runs into `---` breaks the file.
- `description` — third person, ~1024 chars max. First sentence: what the skill does. Second: `Use when <triggers>` — explicit keywords, contexts, file types, or the slash command. This is the *only* text seen when deciding to load the skill; a vague trigger means it never loads.
- Nothing else in the description — no skill-family label, no "never infer from context" (`Triggered ONLY by <command>` already says that).

## Style

- Imperative sentences. `case → action` lists.
- No prose, no rationale paragraphs, no rhetoric.
- No illustrative examples — they restate the obvious and burn context. Structural examples are allowed: templates, command forms, URI formats. (Antipattern examples below are the one exception — a wrong shape is hard to state abstractly.)
- A reason fragment is allowed only when it changes a decision in an edge case. A "why" that changes no decision — cut it.
- One term per concept; do not rename a thing mid-skill.
- No time-sensitive info — no "currently", no aging version numbers.
- Terse at every length. There is no line limit, but every line earns its place.

## No duplication

The recurring failure. A skill never restates:

- its own `description` — a body that opens by paraphrasing the description;
- content that lives in a companion file or a family `core.md`;
- a definition stated elsewhere — use the term, do not redefine it;
- a list stated elsewhere — a partial copy silently drifts out of sync with the canonical one;
- the contents of a quantifier — "read it in full — A, B, C" after "in full" already means everything.

Rule: content shared by two or more skills belongs in a `core.md`, referenced — never copied.

## Progressive disclosure

- `SKILL.md` is always loaded. It must be self-sufficient for the **normal** path.
- Deep rationale or edge-case detail may move to a companion file.
- Split only when the companion is genuinely doubt-only. If a file would be read on the normal path anyway, keep one file.
- Every pointer to a companion carries its trigger: "unsure about X → see Y". A pointer with no condition is never followed.

## Skill families

When skills share a workflow and a `core.md`:

- Shared discipline lives in `core.md`; each entry skill reads it once per session.
- A skill that needs another skill's work invokes it explicitly as a step ("Run `/other-skill`") — it does not re-implement that logic.
- Cross-references name the skill, not a path: "the `mem` skill's `core.md`". Repo layout and install layout differ; a path rots.
- Dependencies between families stay one-directional. A `core.md` does not mention the family that depends on it.

## Editing an existing skill

- Do not invent behavior the skill did not have. A restructure preserves scope — if the original read only root files, the rewrite does too.
- Do not add a conditional branch for a state that always holds.

## Antipatterns

**Body restates the description.**
- Bad: description `Finalize a /work plan — sync decisions into spec and memory.`; body opens `Finalizes the whole plan: synchronize accumulated decisions with the spec and code memory.`
- Good: body goes straight to the steps.

**Explanatory second sentence.**
- Bad: `Read the mem skill's core.md. It owns the service interface, search rules, and anchoring — this skill does not restate them.`
- Good: `Read the mem skill's core.md.`

**Reason fragment that changes no decision.**
- Bad: `Run /work-prime full — loads the whole specs/ tree, needed for the sync below.`
- Good: `Run /work-prime full.`

**Enumerating a quantifier.**
- Bad: `read its index in full — Цель, Контекст, Этапы, all note sections.`
- Good: `read its index in full.`

**Redefining a term the core defines.**
- Bad: `Find the first stage without [x] — the current one.`
- Good: `Find the current stage.`

**Partial copy of a canonical list.**
- Bad: one skill says `search by file: anchors` while the core defines the order `entity → text → file → symbol`.
- Good: `search per the mem skill's core.md.`

**Conditional that always holds.**
- Bad: `If connected to the service — search ...` when the family always ships the service.
- Good: `search ...`

**Description bloat.**
- Bad: `... Triggered ONLY by /work. Part of the /work skill family. Never infer from conversation context.`
- Good: `... Triggered ONLY by the explicit command /work.`

**Illustrative example.**
- Bad: `Pick a prefix — e.g. for "User Auth" use "auth".`
- Good: `Pick a 3–4 letter prefix from the feature name.`

**Rhetoric restating the previous sentence.**
- Bad: `Only the articulated goes into a note. Extraction is translation of a source, not reconstruction.`
- Good: `Only the articulated goes into a note.`

**Cross-reference by path.**
- Bad: `see ../work/core.md`
- Good: `see the work skill's core.md`

## Review checklist

- [ ] Description: what-it-does + explicit triggers, nothing else.
- [ ] Frontmatter valid — closing `---` on its own line.
- [ ] Imperative throughout — no prose, no rationale, no rhetoric, no illustrative examples.
- [ ] Body does not restate the description.
- [ ] Nothing duplicated from a `core.md` or companion; shared content extracted to `core.md`.
- [ ] No partial copy of a list defined elsewhere; no redefinition of a term.
- [ ] No conditional for an always-true state.
- [ ] Cross-references name the skill, not a path.
- [ ] Companion pointers carry a trigger condition.
- [ ] Consistent terminology; no time-sensitive info.
