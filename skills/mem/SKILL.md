---
name: mem
description: Capture a code decision, bug-fix, invariant, or investigation as a role-structured ADR note in Code Memory. Use only when explicitly invoked as /mem.
---

# /mem — capture to Code Memory

**Architect Mode — design.** Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

Capture only on this explicit `/mem` — the residue of a decision, never a retelling of the diff. Reading memory is ambient and owned elsewhere.

## Worth capturing

Capture when one holds: a decision crystallized during implementation; non-trivial debugging surfaced an invariant or cross-effect; an edge case or fragile behavior was discovered; a fact found by practice contradicts or supplements the docs; an architectural decision was made; unfamiliar code was investigated.

Nothing of the above → say so and stop. A rename, a typo, or a trivial change without reasoning is not a note.

## Trajectory

Walk these steps in order; the artifact of each is visible before the next.

1. **Name what crystallized.** State in one line the residual knowledge a future reader needs — the answer to "what must hold here?", "what was considered and dropped?", "what shouldn't I do?". Not the sequence of what was tried.
2. **Pick the template.** Settled decision / bug-fix / found invariant → **Regular**. Unfamiliar code investigated with no final decision → **Investigation**.
3. **Classify each piece into a section by criterion** (below), not by the wording of the source thought. One role per section. Omit any section with no content. Tone — declarative, present, terse: "Применяется паттерн X", not "Мы пришли к тому, что…".
4. **Draft anchors on both axes** (below). State the entities, files, symbols, env vars the note substantively touches, each at every applicable level.
5. **Search the drafted anchors.** Anchor search is exact-match URI equality — pass every level (`file:` + class `symbol:` + member `symbol:` + `env:`) in one OR-call, or a same-scope note hides at the level you skipped. Report the status line `память: нашёл N, пригодилось k`. A hit covering the same scope → `update_note`, merge, do not duplicate. Otherwise `create_note` with `status: current`.
6. **Resolve any `warning`** in the response (empty axis or anchor defect) — fix and call again. Capture the returned `[[id]]`.
7. **Link the note.** Write `[[id]]` into the active plan's `## Рабочие заметки` and into related notes where a reader would follow it; append the `summary` where context needs it: `[[a3f9b]] — отказ от Redis в пользу БД`.
8. **Show the result.** The note is already saved (step 5) — show the user the stored note and its `[[id]]`. No pre-save confirmation: a note is trivially reversible, so the user corrects or drops it afterward if needed.

## Section criteria

Pick the section by what role the knowledge plays for a future reader.

- **Контекст** — the situation that forced the decision: WHY it was needed, not WHAT was done. 2–3 sentences; longer means over-scoped — split the note.
- **Решение** — what was chosen and the technical core of why. Reversible in principle. The main section. A preference with its rationale lives here, not in Инварианты.
- **Альтернативы** — options considered and rejected, each with its reason. Prevents future loops.
- **Инварианты (Must Hold)** — a rule whose violation breaks behavior: would code ignoring it produce a wrong result, a broken contract, or an inconsistent state? "No" → it belongs in Решение. If every preference is written as an invariant the section loses signal — a stylistic choice is not an invariant.
- **Антипаттерны и Подводные камни (Must Not)** — concrete traps: a tempting wrong approach, a side-effect on a distant module, a fragile assumption.
- **Пробелы и ограничения** — what was knowingly left open: a deferred concern, an accepted compromise, a known unknown that did not block.

Investigation classifies by epistemic status instead: `Подтверждено` (confirmed by code, tests, behavior), `Гипотезы` (plausible, unproven — flag explicitly), `Инварианты (подтверждённые)`, `Пробелы`.

## Body templates

Regular note — settled decision, bug-fix, found invariant:

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

Investigation note — exploring unfamiliar code, no final decision:

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

## Anchors — both axes

Every note carries anchors on both axes:

1. **Conceptual — `entity:<Name>`.** Every domain entity the note substantively concerns, even when no file of that name was touched. Invisible to code-level search, so never skip it.
2. **Implementation — `file:` + `symbol:` + `env:`.** Every file, class, member, and env variable the note substantively involves.

Relevance decides *what* to anchor; once decided, anchor at every level. The gate holds: a target is anchored only if the note **substantively** touches it — a one- or two-line formal edit is not an anchor (put such cross-effects in prose under `## Антипаттерны и Подводные камни`). Once a target passes the gate, it is anchored at every applicable level at once — the containing `file:`, the class `symbol:`, the `symbol:` of each member touched, plus `env:` for every env variable involved. There is no middle setting where a target is anchored at some levels but not others. A method without its class and file, or a symbol without its file, is under-anchored — exact-match search misses it at the other levels; `create_note` warns only when an entire axis is empty, so level completeness is on the author.

### Weights

- **Centrality**, per anchor: `core` (main work), `supporting` (substantially related), `incidental` (touched, not the point).
- **Priority**: `critical` only when the note holds a `## Инварианты` section every reader of this anchor must see. No invariants section → no `critical`. `critical` is not "very `core`".

## create_note contract

- Service generates and returns the short hash `id` (5-char base36). Never invent an ID.
- `status: current` for verified knowledge; `draft` for notes pending review.
- Anchor to an unregistered entity → `create_note` rejects. Suggest `create_entity` to the user with a short "what and why", repeat after confirmation.

## Antipatterns

- Capturing a note with no reasoning, or a retelling of the diff.
- Under-anchoring: a target anchored at one level only, a method without its class and file, or a note missing the `entity:` axis.
- Marking an ordinary decision `critical` with no `## Инварианты` section.
- Mixing `query` and `anchors` in one `search` call — they are separate axes.
