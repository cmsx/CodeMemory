---
name: mem-explore
description: Emergency grounding pass — stop the current reasoning, retrieve broadly over the active area in Code Memory, and confront the model's last proposals against stored invariants and antipatterns in a discrepancy dashboard. Use only when explicitly invoked as /mem-explore, when the dialogue has drifted into hallucination or is ignoring project memory.
disable-model-invocation: true
---

# /mem-explore — emergency grounding

**Mode: stop-and-confront brake** — not one of the standard Ask/Architect/Code Modes. A manual brake, not part of the normal workflow. Reading is ambient and owned elsewhere; this skill is a deliberate stop-and-confront the user triggers when the dialogue has drifted.

Communicate with the user in Russian; write the dashboard in Russian. Skill instructions are English — this does not change the output language.

Write no files. Propose no solution until the dashboard is delivered and the user responds.

## Trajectory

Walk these steps in order; the artifact of each is visible before the next.

1. **Stop.** Halt the current line of reasoning — the only output this turn is the dashboard.
2. **Name the active area.** List the entities, files, and symbols the recent dialogue acts on — the targets of the last few proposals. This set is the retrieval scope.
3. **Retrieve broadly.** Recover context across both sources:
   - `list_entities` — refresh the registry; map the active-area concepts onto registered `entity:` anchors.
   - `search anchors: [...]` — every active-area anchor of any kind in one OR-call.
   - `search query: "<тема обсуждения>"` — 1–2 Russian rephrasings of the drifting topic.
   - Read `RULES.md` and the `specs/` parts that govern the active area.

   Report `память: нашёл N`.
4. **Load and extract.** `get_notes` on the chosen `id`s — one call for several; returns full bodies. From each body pull the **`## Инварианты (Must Hold)`** and **`## Антипаттерны и Подводные камни (Must Not)`** sections — these are the rules to confront against. Honor flags: surface every `critical` note, show any `stale` anchor, mark any `draft` / `## Гипотезы` as unverified.
5. **Confront.** Set the model's last 2–3 proposed sentences against each extracted invariant, antipattern, and binding spec rule. Classify each pairing: contradicts / confirmed / not covered.
6. **Dashboard.** Emit the report (template below). Findings only — no fix.
7. **Await direction.** Stop. Wait for the user to choose the course.

## Dashboard template

```markdown
## Сверка с памятью

**Активная область:** entity:<E>, file:<path>, symbol:<path>::<Name>
**Память:** нашёл N, релевантно k

### Противоречия
- ⚠️ «<последнее предложение модели>» ↔ [[id]] инвариант «<правило>» — в чём расходится.

### Подтверждено
- ✅ «<предложение>» ↔ [[id]] — согласуется.

### Не покрыто памятью
- ❓ «<предложение>» — правил в памяти нет; на чём основано?

### Флаги
- `stale`: <anchor> — ссылка протухла.
- `draft` / `Гипотезы`: [[id]] — не проверено, не опираться без проверки.

**Курс:** одна строка — что пересмотреть перед продолжением.
```

Omit any empty section. No contradictions and no flags → say so plainly; the drift was a false alarm.

## Search contract

A `search` call takes two independent axes; they do not mix in one call:

- **`anchors`** — an arbitrary set of relevant anchors of any kind (`entity:`, `file:`, `symbol:`, `env:` mixed freely). OR by default: the result is the union over the set. Pass every relevant anchor in one call.
- **`query`** — Russian descriptive words; OR over keywords, BM25 ranks the densest hit first. `strict: true` switches to AND — every term must match.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchor search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

## Reading contract

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for the chosen `id`s — one call for several; returns the full body of each.
- `[[id]]` mentioned-notes block inside a body — decide by `summary` whether to load via `get_notes`; pull the ones holding rules for the active area.
- `stale` anchor — show to the user, never silently ignore.
- `draft` note or `## Гипотезы` section — flag as unverified; do not treat as a confirmed rule.
