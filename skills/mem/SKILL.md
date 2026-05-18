---
name: mem
description: Code Memory Service — find code knowledge not visible in the code, and capture it as notes. Use when planning or implementing on a connected project (reading memory is part of that work); invoked explicitly as /mem to capture a decision, bug, or edge case.
---

# /mem — capture to Code Memory

Read the `mem` skill's `core.md` once per session before proceeding (skip if already in context).

## When to capture

A decision crystallized during implementation; non-trivial debugging; an edge case or fragile behavior; a fact found by practice not in the docs; an architectural decision; an investigation of unfamiliar code.

Do not capture: a rename, a typo, a trivial change without reasoning.

## Process

1. Draft the note — body per the templates below, anchors per `core.md` § Anchors.
2. `search` the drafted anchors first — note exists → `update_note`, do not duplicate; else `create_note` with `status: current`.
3. Show the result to the user; finalize after confirmation.

## Body templates

Omit any section with no content — do not emit an empty header. Do not skip documenting approaches tried and rejected.

Regular note:

```
## Что сделано
Результат в 2–3 предложениях, не пересказ диффа.

## Ключевые решения и почему
Почему именно так — главная секция.

## Что пробовали и отбросили
Подходы и причины отказа.

## Подводные камни
Gotcha'и, инварианты, cross-effects.

## Ограничения
Незакрытое, осознанные компромиссы.
```

Investigation note (unfamiliar code):

```
## Verified
Проверено кодом или подтверждено пользователем.

## Hypothesis
Правдоподобно, но не проверено. Явная пометка.

## Подводные камни / Ограничения
При наличии.
```

`summary` — an authored announce line: what makes a future agent open the note in full. Not the slug, not the first body sentence.
