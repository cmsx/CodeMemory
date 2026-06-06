# Writing skills

A skill tells an agent **what to do**. Imperatively, in the form the skill's
purpose demands.

This document is the style guide. Architectural decisions (Modes, structured
CoT, Memory Grounding, Synthesis Form, mode-shift triggers) live in
`docs/workflow/context-engineering.md`; this file governs only how those
decisions are expressed in a `SKILL.md`.

## Frontmatter

```
---
name: <kebab-case, matches the directory name>
description: <see below>
---
```

- The closing `---` is on its own line.
- `description` — third person, ~1024 chars max. First sentence: what the
  skill does. Second: `Use when <triggers>` — explicit keywords, contexts,
  file types, or the slash command. This is the only text seen when deciding
  to load the skill; a vague trigger means it never loads.
- Description contains nothing else. `Triggered ONLY by /<command>` already
  says "do not infer from context".

## Two skill styles

A skill picks one style based on what it does. Mixing is allowed when a single
skill spans both phases (rare).

### Procedural

For rutinous skills with a defined end (`/prime`, `/work`,
`/step-done`, `/finalize`). Form: `case → action` imperative steps. The
model executes the list.

### Judgment (Structured CoT)

For skills that require reasoning under context-drift pressure (`/grill`,
`/blueprint`, `/mem` capture, `/storyteller`). Form: an
explicit cognitive trajectory the model walks through before producing
output. Each step of the trajectory is a concrete action or formulation, not
an exhortation to "think carefully".

A judgment skill is still imperative — it commands the trajectory:
1. Name the entities/files the branch touches.
2. State the assumptions that need to hold.
3. Search memory to confirm or disprove; report the status line.
4. Integrate findings using Synthesis Form (see `docs/workflow/context-engineering.md`).
5. Propose / ask the next question.

The model can skip a step only visibly — the absent artifact is the signal.

## Style

- Imperative throughout. The trajectory of a judgment skill is still
  imperative — the steps are commands, not descriptions.
- Prefer positive formulations. State what to do; let it anchor. Add a "do
  not" only when the prohibited shape is genuinely tempting and the positive
  rule alone does not exclude it.
- No prose, no rhetoric, no rationale paragraphs.
- No illustrative examples — they restate the obvious and burn context.
  Structural examples are allowed: templates, command forms, URI formats,
  Synthesis Form skeletons.
- One term per concept; do not rename mid-skill.
- No time-sensitive info — no "currently", no aging version numbers.
- No edit-narration. A skill is read whole and as-is; it carries no history of
  its own versions. Remove behavior by deleting the instruction, not by noting
  it was removed or moved; change behavior by stating only the new rule.
  "No longer …", "previously …", "now handled by X instead" never should appear in the skill
- Terse at every length. No line limit, but every line earns its place.

## Description discipline

The description is the gate to loading. Two sentences, nothing else:
1. What the skill does (third person).
2. `Use when <triggers>` — explicit, specific, the actual command if any.

No skill-family labels, no "Part of …", no philosophy.

## Core.md as author canon

A skill family shares a `core.md`. The role of `core.md` is **single source of
truth for the author**, not a runtime include.

- `core.md` is not loaded by skills at runtime. Skills inline the slices of
  it that apply to their step.
- When `core.md` changes, the author re-derives every skill in the family
  from canon. Variance always resolves toward `core.md`.
- The duplication that results is the deliberate price of keeping the rule
  live in the skill at the moment of execution, rather than behind a
  pointer the model may not follow under drift.
- A block that is universally needed at every invocation (the search contract,
  anchor shape, mandatory contracts) is copied verbatim. Framing,
  philosophy, and rationale stay in `core.md` and are not copied — they
  configure the author, not the runtime.
- An inlined slice carries no provenance label. The runtime reads the rule,
  not its origin: a heading or aside like "(inlined from mem core)" or
  "(from canon)" is author bookkeeping and never appears in a `SKILL.md`.
  Title the slice by what it is — `## Search contract`, not its source.

## No duplication within a skill

Inside a single `SKILL.md`:
- Do not restate the description in the body.
- Do not state the same rule twice in different words.
- Do not enumerate after a quantifier — "read it in full" already means
  everything.
- Do not redefine a term used elsewhere in the same skill — use it.

Duplication between two skills of the same family is handled by the
`core.md` sync workflow above; duplication inside one skill is always a
defect.

## Locality — a skill states only what binds it

A skill describes its own behavior: what it does, what it must not do, what it
produces. A fact about *another* skill's behavior — who else reads the artifact
it writes, who deletes it later, why a downstream skill needs it — imposes no
constraint here; the skill does the same thing whether or not the note is
present. Such a fact has one home: the skill it binds, plus the shared lifecycle
in its contract doc (`formats.md`, a family `core.md`), named once — not
cross-posted into every skill that touches the artifact.

Binary test for any sentence naming another skill: does cutting it change what
**this** skill must do? No → it is commentary; cut it. A reference that routes
control stays — "Run `/other-skill`", "the verdict the orchestrator reads" bind
this skill's own flow; a description of the other skill's reasoning does not.

## Progressive disclosure

- `SKILL.md` is always loaded. It must be self-sufficient for the normal
  path.
- A companion file is justified only when its content is genuinely
  doubt-only — read only when an edge case fires. If a file would be read
  on the normal path, keep one file.
- Every pointer to a companion carries its trigger: "unsure about X →
  see Y". A pointer without a trigger is invisible.

## Skill families

When skills share a workflow and a `core.md`:
- Shared discipline lives in `core.md` as canon. Skills inline the
  relevant slices.
- A skill that needs another skill's work invokes it explicitly as a step
  ("Run `/other-skill`"). It does not re-implement that logic.
- Cross-references name the skill, not a path: "the `mem` skill's
  `core.md`". Repo and install layouts differ; a path rots.
- Dependencies between families stay one-directional. A `core.md` does
  not mention the family that depends on it.

## Editing an existing skill

- Preserve scope. A restructure does not invent behavior the skill did not
  have.
- Do not add conditional branches for states that always hold.
- When the change is a `core.md` ressync — replace only the inlined slices
  that drifted from canon, do not rewrite the skill.

## Terseness pass

The "no illustrative examples / terse" rule is a write-time prohibition the
author drops under generation pressure, and a bare "terse, ok" verdict is
written without doing the work. Before declaring the review passed, walk the
drafted or edited slice once and emit a ledger.

List every element whose job is to **illustrate, justify, or restate** rather
than instruct — an example, a rationale clause, a gloss. For each, one line:
**keep** with its warrant, or **cut**. Warrants for keep, closed set:

- structural form — template, command shape, URI/format skeleton;
- pinned by a requirement — a decision or edge case mandating the example to
  block a misreading;
- disambiguates a genuinely tempting wrong reading the positive rule alone does
  not exclude.

No warrant → cut. No such element → the ledger reads "none". The unit is the
illustrative element, not every parenthesis: a parenthetical naming a term or
giving a format is structural, not a ledger entry.

## Review checklist

- [ ] Terseness pass run: ledger of illustrate/justify/restate elements, each
      kept-with-warrant or cut (or "none").
- [ ] Description: what-it-does + explicit triggers, nothing else.
- [ ] Frontmatter valid; closing `---` on its own line.
- [ ] Style chosen consciously (procedural or judgment); form matches.
- [ ] Positive formulations dominate; "do not" reserved for genuine
      temptations.
- [ ] Imperative throughout; no prose, no rhetoric, no illustrative
      examples.
- [ ] No edit-narration: current behavior only, no "no longer / previously /
      moved elsewhere" notes about what changed.
- [ ] Body does not restate the description; no internal duplication.
- [ ] Locality: every sentence naming another skill binds this skill's own
      behavior or routes its control — no commentary describing what another
      skill does with the artifact.
- [ ] Inlined slices match the current `core.md`; framing/rationale not
      copied; no provenance label on the slice.
- [ ] Companion pointers carry trigger conditions.
- [ ] Cross-references name the skill, not a path.
- [ ] Consistent terminology; no time-sensitive info.
