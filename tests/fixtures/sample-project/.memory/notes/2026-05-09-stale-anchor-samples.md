---
id: 2026-05-09-stale-anchor-samples
summary: Служебная заметка фикстура с намеренно битыми якорями всех типов для тестов верификатора.
status: current
created: 2026-05-09
updated: 2026-05-09
anchors:
  - uri: symbol:src/order.ts::Order.archive
    weight: core
  - uri: symbol:src/cart.js::computeDiscount
    weight: incidental
  - uri: file:src/legacy/removed.ts
    weight: supporting
  - uri: env:UNUSED_KEY
    weight: supporting
  - uri: entity:Wizard
    weight: incidental
---

## Что сделано

Служебная заметка фикстура: каждый якорь намеренно битый, чтобы контрактные
и интеграционные тесты проверяли пометку `stale` по всем типам якорей.

## Подводные камни

Заметка существует только ради тестов верификатора. Цели якорей отсутствуют
в коде фикстура by design. `entity:Wizard` ссылается на незарегистрированную
сущность намеренно — заметка написана руками в обход `create_note`, поэтому
доменный инвариант «entity обязан резолвиться» формально не нарушается.
