---
id: 2026-05-14-external-services-config
summary: Какие переменные окружения подключают внешние сервисы.
status: current
created: 2026-05-14
updated: 2026-05-14
anchors:
  - uri: env:DATABASE_URL
    weight: core
  - uri: env:REDIS_URL
    weight: supporting
---

## Что сделано

Подключения к Postgres и Redis читаются из `DATABASE_URL` и `REDIS_URL`.

## Подводные камни

При отсутствии `REDIS_URL` сервис стартует без кэша — отказ тихий.
