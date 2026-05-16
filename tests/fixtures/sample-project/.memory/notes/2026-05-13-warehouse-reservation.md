---
id: 2026-05-13-warehouse-reservation
summary: Как Warehouse.reserve ограничивает остаток и где его допущения о конкурентности не проверены.
status: current
created: 2026-05-13
updated: 2026-05-13
anchors:
  - uri: symbol:src/inventory.py::Warehouse.reserve
    weight: critical
  - uri: entity:Inventory
    weight: core
---

## Verified

`Warehouse.reserve` бросает `ValueError`, когда запрошенное количество
превышает остаток. Подтверждено чтением `src/inventory.py`.

## Hypothesis

Похоже, `reserve` рассчитан на однопоточное использование: проверка остатка
и его уменьшение не атомарны. В коде это не зафиксировано — гипотеза.
