---
id: 2026-05-14-invoice-totals
summary: Как Invoice накапливает начисления и где задаётся SQL-схема.
status: current
created: 2026-05-14
updated: 2026-05-14
anchors:
  - uri: symbol:src/billing.php::Invoice.invoiceTotal
    weight: core
  - uri: symbol:src/billing.php::formatCents
    weight: supporting
  - uri: entity:Billing
    weight: supporting
  - uri: symbol:src/billing.php::Discountable
    weight: supporting
  - uri: symbol:src/billing.php::PaymentMethod
    weight: incidental
  - uri: file:docs/schema.sql
    weight: incidental
---

## Что сделано

`Invoice.invoiceTotal` возвращает накопленную сумму начислений в центах.

## Ограничения

Миграций нет — схема БД применяется вручную из `docs/schema.sql`.
