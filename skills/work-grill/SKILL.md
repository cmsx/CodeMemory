---
name: work-grill
description: Discuss and settle the technical approach before any plan is written — interrogate the requirement in Ask Mode, shift to Architect Mode on the move from "what" to "how", and ground every proposal in the project's specs and Code Memory. Use only when explicitly invoked as /work-grill.
---

# /work-grill — discuss and settle the approach

Two Modes in sequence. Open in **Ask Mode**; cross to **Architect Mode** the moment the discussion turns to technical realization. The crossing is the grounding trigger below.

### Ask Mode — requirements
Surface business goals, constraints, scope. Ask one question at a time. Forbidden: proposing any technical implementation (pattern, table, mechanism).

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

This skill calls for no file writes — settling the approach is its whole job. Capturing the outcome belongs to `/storyteller`, `/work-plan`, and `/work-update`. Propose, do not build.

Communicate with the user in Russian. Skill instructions are English — this does not change the output language.

## Grounding an area

To **ground** an area is to consult both sources before proposing, not memory alone.

- **Spec** — the system is intricate and runs on deliberate, vetted decisions, not on defaults. The already-loaded `specs/` root index maps the layers; from it, work out which layers the proposed change will touch and read how each prescribes the work — only the files relevant to the task, never a whole layer or the whole tree.
- **Code Memory** (why it is so, where not to step) — **anchored search** on the area's entities, files, and symbols; those are the coordinates in hand. Report the status line.

A touched layer left unread, or memory not queried, surfaces later as a blind spot — the proposal breaks an invariant or a cross-module flow it never saw.

## Mode-shift — the grounding trigger

The boundary between Modes is the most dangerous drift point: crossing from "what we want" to "how we build it" is exactly when framework training weights light up and override project rules. At that boundary, pause and ground the active area before proposing anything, then integrate the result through the Synthesis Form. This crossing is the vertical reading trigger below.

## Trajectory (Structured CoT)

**First turn.** Before any opinion, ground the topic. Name the entities, files, and symbols the request touches and ground them; lead the first reply with what the spec and memory hold, phrased through the Synthesis Form — not with your own take.

**Every later turn**, walk these steps in order when a reading trigger fires (below). The artifact of each step is visible before the next; a skipped step shows by its absent artifact.

1. **Name** the entities / files / symbols the branch touches.
2. **State** the assumptions that must hold for the branch under discussion.
3. **Ground** the area to confirm or disprove the assumptions.
4. **Integrate** the findings through the Synthesis Form.
5. **Propose** the approach, or ask the next single question.

On routine turns inside an already-grounded area — no new target, no shift to "how" — omit the block and answer directly. Over-reporting a search every turn is an antipattern.

## Reading triggers — when to ground

Grounding is gated on a discrete context-shift event, never on a per-turn audit. Two axes:

- **Horizontal (breadth):** a business entity, file, or feature not yet discussed this session.
- **Vertical (depth):** the shift from "what we want" to "how we build it" — choosing a pattern, a DB structure, a mechanism. This is the Ask→Architect crossing.

## Synthesis Form

Integrate memory into your own narrative; never quote a note raw and hand it to the user to interpret.

```
Я планировал <X>, но согласно [[id]] мы избегаем этого из-за <Y>,
поэтому предлагаю <Z>.
```

You own the synthesis — not "Вот что я нашёл: [[id]] говорит о Y. Давай делать Z."

## Design discipline

Read the convention docs in `specs/code/` and treat them as binding; a deviation needs explicit justification. No such doc — rely on framework idioms and state which you assumed. Take existing Решения/Отклонения from the active plan index as settled constraints. Use framework mechanisms by default — authorization, validation, events, middleware, ORM features — not hand-rolled equivalents.

Avoid by default: control-flow sprawl (long `if`/`switch` chains, deep nesting), layer mixing (controller logic in a model, business rules in a view), duplication (copy-pasted branches instead of one abstraction).

## Collecting grounding references for the plan

While discussing, keep both watershed sources you grounded on, each with a one-line note of its use — these feed the `## Grounding` block the following `/work-plan` or `/work-update` writes into the index:

- the spec files you consulted that bear on the plan (path + what it holds);
- the `[[id]]` of every note that shaped a decision and any useful anchors (`entity:`, `file:`, `symbol:`, `env:`).

## Question style

- Ask one question at a time. Wait for the answer, then move on.
- Short question (a choice, yes/no, a name) — use the interactive widget if available.
- Complex or open question — ask as plain text.

## Search contract

A `search` call has two paths, each with its own yield — separate calls, never two fields of one call.

- **Anchored search** (`anchors`) is the precise, information-dense path: it returns the notes pinned to the exact nodes in hand. Anchors union by OR — pass every relevant anchor in one call. Use it whenever a coordinate is known.
- **Full-text search** (`query`) is the orienting path — Russian descriptive words, 1–2 rephrasings, BM25 over summary and body, OR by default (`strict: true` for AND). Reach for it when no coordinate is in hand: boundaries still fuzzy, not all relevant anchors known, or the anchored search came back empty.

Mixing the two in one call is an error: the paths rank by different measures, so the relevance cut breaks and retrieval comes back incomplete.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchored search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

Each search tied to a discrete unit of work reports a one-line status in chat: `память: нашёл N, пригодилось k` — counts only. The count cannot be written without searching — that is the point.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for chosen `id`s — one call for several; returns the full body of each note.
- `list_symbols_in_file` for a large file before targeted `Read` — pull the symbol map, read the symbol range, not the whole file.
- Anchor map of a note — coordinates for reading code.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified; verify before acting.
