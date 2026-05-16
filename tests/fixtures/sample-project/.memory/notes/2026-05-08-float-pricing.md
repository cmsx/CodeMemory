---
id: 2026-05-08-float-pricing
summary: Устарело — цены когда-то хранились во float, заменено целыми центами.
status: outdated
created: 2026-05-08
updated: 2026-05-12
anchors:
  - uri: symbol:src/pricing.go::NewPrice
    weight: core
---

## Что сделано

Ранняя версия `NewPrice` возвращала цену во `float64`.

## Ограничения

Подход отменён — заменён целочисленным представлением, см.
[[2026-05-12-pricing-minor-units]].
