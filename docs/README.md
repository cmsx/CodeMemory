# Документация Code Memory

Дизайн **сервера** живёт в [`../specs/`](../specs/). Здесь — всё вокруг скиллов
и работы с системой, разложенное по аудиториям.

## [`workflow/`](workflow/) — экосистема скиллов

Корпус скиллов как часть продукта: планирование и пошаговая разработка.

- [`README.md`](workflow/README.md) — жизненный цикл задачи `/work-*`, обзор.
- [`skills.md`](workflow/skills.md) — справочник по 10 скиллам: режим, задача, механика.
- [`context-engineering.md`](workflow/context-engineering.md) — принципы: Context Drift, Structured CoT, Grounding, Synthesis Form, Modes, водораздел Specs/Memory.

## [`consumer-guide/`](consumer-guide/) — методология целевого проекта

Как обустроить документацию проекта, чтобы скиллы и память работали в полную силу.

- [`documentation-system.md`](consumer-guide/documentation-system.md) — 6-слойная спека, `RULES.md`, Functional Map.
- [`user-stories.md`](consumer-guide/user-stories.md) — System-Aware User Stories: концепт + шаблон.
- [`formats.md`](consumer-guide/formats.md) — шаблоны артефактов (планы; указатели на канон заметок и историй).

## [`setup/`](setup/) — подключение в проект

- [`migration-guide.md`](setup/migration-guide.md) — миграция консьюмера 1.x → 2.0.

## [`contributing/`](contributing/) — разработка сервиса и скиллов

- [`skill-writing.md`](contributing/skill-writing.md) — стиль-гайд написания скиллов.
- [`skill-core-coverage.md`](contributing/skill-core-coverage.md) — чек-лист обязательных слайсов `core.md` по скиллам.
- [`manual-testing.md`](contributing/manual-testing.md) — ручной чек-лист (TUI, Docker, онбординг).
