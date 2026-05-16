---
id: 2026-05-12-pricing-minor-units
summary: Цены хранятся в целых центах ради защиты от дрейфа округления float.
status: current
created: 2026-05-12
updated: 2026-05-12
anchors:
  - uri: symbol:src/pricing.go::NewPrice
    weight: core
  - uri: symbol:src/pricing.go::Price
    weight: supporting
  - uri: entity:Pricing
    weight: core
  - uri: symbol:src/pricing.go::Pricer
    weight: supporting
  - uri: env:PRICING_PRECISION
    weight: incidental
---

## Что сделано

`Price` хранит сумму в целых центах; `NewPrice` принимает сумму в основной
валюте и домножает на 100.

## Ключевые решения и почему

Целые центы вместо float — деньги не должны накапливать ошибку округления.

## Что пробовали и отбросили

Пробовали `float64` с округлением на выводе — отказались: ошибка протекала
в промежуточные суммы.
