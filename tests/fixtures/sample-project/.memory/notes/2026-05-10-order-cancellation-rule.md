---
id: 2026-05-10-order-cancellation-rule
summary: Отмена заказа односторонняя и не должна вызываться после place.
status: current
created: 2026-05-10
updated: 2026-05-10
anchors:
  - uri: symbol:src/order.ts::Order.cancel
    weight: critical
  - uri: file:src/order.ts
    weight: core
  - uri: entity:Order
    weight: supporting
---

## Что сделано

`Order.cancel` переводит заказ в терминальный статус `Cancelled` без
возможности возврата.

## Ключевые решения и почему

Отмена сделана односторонней: восстановить заказ нельзя, создаётся новый.
Это убирает класс гонок между `place` и `cancel`.

## Подводные камни

Вызов `cancel` после `place` молча затирает статус — guard не добавлен
намеренно, см. [[2026-05-15-status-guard-idea]]. Исторический контекст —
[[2099-01-01-nonexistent]] (заметки нет, ссылка намеренно битая).
