---
id: 2026-05-11-cart-emptiness-check
summary: Почему пустота корзины проверяется отдельной функцией isEmpty.
status: current
created: 2026-05-11
updated: 2026-05-11
anchors:
  - uri: symbol:src/cart.js::isEmpty
    weight: core
  - uri: symbol:src/cart.js::Cart.clear
    weight: supporting
  - uri: entity:Cart
    weight: incidental
---

## Что сделано

`isEmpty` — отдельная функция-предикат вместо геттера на `Cart`.

## Ключевые решения и почему

Предикат вынесен из класса, чтобы корзину можно было проверять, не завязывая
вызывающий код на её внутреннее устройство.
