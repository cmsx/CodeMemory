---
id: 2026-05-15-status-guard-idea
summary: Черновик предложения добавить guard в Order.cancel против вызова после place.
status: draft
created: 2026-05-15
updated: 2026-05-15
anchors:
  - uri: file:src/order.ts
    weight: core
---

## Что сделано

Черновик: предложение добавить в `Order.cancel` guard, запрещающий отмену
после `place`.

## Ограничения

Не подтверждено — статус `draft`. Нужно решить: бросать исключение или
возвращать признак неуспеха.
