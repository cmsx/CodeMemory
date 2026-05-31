---
name: storyteller
description: Convert an already-settled business need into a System-Aware User Story file under specs/product/user-stories/, where every step carries both its observable action and its under-the-hood system_reaction. Use only when explicitly invoked as /storyteller.
---

# /storyteller — write a System-Aware User Story

Architect Mode. The discussion is over; this is a mechanical translation of the settled need into the strict story format.

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

Do not search memory and do not ask questions — the context is already loaded by `/prime` or settled in `/grill`. Draw every field from the dialogue. A field genuinely absent from the discussion → leave a `<...>` placeholder and name it in the report; never invent it.

Communicate with the user in Russian. Skill instructions are English — this does not change the output language.

## Trajectory

1. **Extract** from the dialogue: `actor`, `goal`, `precondition[]`, `steps[]`, `postcondition[]`, `negative_paths[]`, and the `related_entities` the story touches.
2. **Map** each step to its system layer — the table written, the job dispatched, the service called: its `system_reaction`. A step carrying only the observable `action` is not yet a System-Aware step.
3. **Validate** against the gate below.
4. **Choose** the `<id>`: kebab-case derived from `goal`, unique under `specs/product/user-stories/`.
5. **Write** the file to `specs/product/user-stories/<id>.md` from the template.
6. **Report** the path written and any `<...>` placeholder left for the user.

## Validation — before writing

- Every step holds both `action` and `system_reaction`, each non-empty. A step missing `system_reaction` is incomplete: derive it from the discussed system, or mark `<...>` and report it.
- `related_entities` lists the domain entities the story touches.
- `id` is kebab-case and not already taken under `specs/product/user-stories/`.

The file is written on the explicit signal that is the `/storyteller` invocation itself — no separate confirmation.

## Template

```yaml
---
status: stable
related_entities: [EntityA, EntityB]
---
```
```yaml
id: <kebab-case-id>
actor: <role>
goal: <одно-два предложения>

precondition:
  - <состояние системы до старта>

steps:
  - action: <наблюдаемое действие, например: Клик на "Запуск">
    system_reaction: <реакция под капотом, например: Создается IngestionJob, статус Processing>
    expected: <наблюдаемый результат, например: Показывается лоадер>

postcondition:
  - <финальное состояние БД, очередей, интеграций>

negative_paths:
  - description: <что если пошло не так>
    expected: <реакция системы>
```
