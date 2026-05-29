---
name: mem-onboarding
description: Seed Code Memory when connecting it to an existing project — a one-time, multi-session batch that extracts a starting set of draft notes from existing sources. Use only when explicitly invoked as /mem-onboarding.
---

# /mem-onboarding — seed Code Memory

**Architect Mode — design.** Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

Extract the articulated residue of existing sources into draft notes. Communicate with the user in Russian; write note `summary` and `body` in Russian.

Onboarding is skill-driven discipline over the ordinary tools (`search`, `get_notes`, `create_note`, `update_note`, `create_entity`) — no tools of its own.

## 1. Structural index

`reindex` builds the symbol index so `symbol:` anchors of created notes resolve. It runs automatically on an empty index — nothing to invoke.

## 2. Setup

- The user states the **transformation logic** for this project: where the sources live, how raw material maps to notes (e.g. "specs in `docs/`, one `##` section = one note").
- Declare **starting entities**: suggest candidates from the code structure, the user prunes, register approved ones via `create_entity`. Confirm in plain text pre-filled with «да».

## 3. Chunk loop

Feed the source in parts — one pass cannot absorb it all. For each chunk:

1. Read the chunk; determine its entities and files.
2. `search` the drafted anchors with `include_drafts: true` — earlier-chunk notes are `draft` and a default `search` misses them. Anchor search is exact-match URI equality — pass every level (`file:` + class `symbol:` + member `symbol:` + `env:`) in one OR-call, or a same-scope draft hides at the level you skipped; anchors and `query` stay on separate calls. Report the status line `память: нашёл N, пригодилось k`.
3. Decide: `create_note` with `status: draft` (new knowledge), `update_note` (refine an existing note covering the same scope), or skip (already covered).
4. Author the note per **Note authoring** below — role structure and both anchor axes.
5. Drop the raw chunk text before the next chunk.

Raw text is dropped between chunks so one document does not bleed into another's reading; draft notes persist as the cross-chunk working memory, which is why every note is `draft` and every `search` carries `include_drafts`.

## Note authoring

Body follows one of two role-structured templates — the same structure as `/mem`. Pick by the source: a settled decision/invariant → **Regular**; unfamiliar code with no final decision → **Investigation**. One role per section; omit any section with no content; tone declarative, present, terse.

Regular:

```markdown
## Контекст
Какая проблема решалась, почему потребовалось решение. 2–3 предложения.

## Решение
Что выбрано и почему. Техническая суть.

## Альтернативы
Что рассматривали и отбросили — и почему.

## Инварианты (Must Hold)
Жёсткие правила, обязанные сохраниться при будущих правках.

## Антипаттерны и Подводные камни (Must Not)
Чего делать нельзя; неочевидные side-effects на другие модули.

## Пробелы и ограничения
Что осознанно не закрыто; компромиссы; технический долг.
```

Investigation:

```markdown
## Контекст
Что исследовалось и зачем.

## Подтверждено
Факты, подтверждённые кодом, тестами или поведением системы.

## Гипотезы
Правдоподобно, но не проверено. Явная пометка.

## Инварианты (подтверждённые)
Подтверждённо обязано быть истиной.

## Пробелы
Что не покрыто; что требует дальнейшего исследования.
```

`summary` — an authored announce line: what makes a future agent open the note in full. Not the slug, not the first body sentence.

Anchor every note on **both** axes:

1. **Conceptual — `entity:<Name>`.** Every domain entity the note substantively concerns, even when no file of that name was touched.
2. **Implementation — `file:` + `symbol:` + `env:`.** For each substantively involved target, anchor at every applicable level at once: the containing `file:<path>`, the class `symbol:<path>::<Class>`, the `symbol:<path>::<Class>.<member>` of each method touched, plus `env:<VAR>` for every env variable involved.

Relevance decides *what* to anchor; once a target passes the gate it is anchored at every level — there is no middle setting where a target is anchored at some levels but not others.

Set anchor weights: centrality (`core` / `supporting` / `incidental`) per anchor; `critical` only when the note holds a `## Инварианты` section every reader of this anchor must see — no invariants section → no `critical`.

`create_note` returns a `warning` when an entire axis is empty — fix and call again. Level completeness is the author's responsibility; under-anchoring is the most frequent onboarding defect. The service generates and returns the short hash `id` — never invent one. An anchor to an unregistered entity is rejected → propose `create_entity` to the user, repeat after confirmation.

## 4. Review

The user reviews draft notes — in batches or inline — and promotes verified ones to `current` via `update_note`. Unverified stays `draft`.

To inventory the whole store, `search` with `match_all: true` and `include_drafts: true` returns a compact `id` + `summary` list of every note. `match_all` belongs to onboarding only — never a shortcut in routine work.

## Scratch file

Onboarding is multi-session. Persist `.memory/onboarding.md` between sessions: the plan, the transformation rules, a source checklist (done / queued / skipped). It is scaffolding — remove or archive it on completion. Notes and the entity registry persist normally.

## Fuzzy sources

A source with no explicit intent to document decisions (tests, migrations, marked comments, general docs) — same flow, stricter discipline:

- Create a note only against a **verifiable source artifact**: the symbol exists per the index, the test name is an articulated invariant.
- Do not reconstruct "why it is so" without an explicit source — the gap gets filled with plausible invention.
- Unsure → Investigation template, hypotheses marked explicitly under `## Гипотезы`.
- General conceptual documentation with no code tie is not a note.

Genuinely foreign code is better mapped organically — through `/mem` investigation notes during real work sessions, not a batch pass.

## Boundary of automation

A standing principle, not only for onboarding: only the **articulated** goes into a note — what is in the spec, the discussion, or a verifiable artifact. Extraction is translation of the source, not reconstruction of its rationale.
