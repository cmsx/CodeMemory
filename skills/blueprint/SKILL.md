---
name: blueprint
description: Create or amend the plan files under plans/ that drive step-by-step execution — with no @path it writes a fresh plan; with @path it applies a discussion outcome to the named plan. Use only when explicitly invoked as /blueprint (optionally /blueprint @<path-to-index>).
---

# /blueprint — author and amend plans

Architect Mode. Turn a settled approach into the plan files that drive execution, or apply a later outcome to an existing plan. The trajectory forks on one signal — the presence of `@<path>`.

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

Communicate with the user in Russian. Write all plan files in Russian. Skill instructions are English — this does not change the output language.

## Dispatch — create or amend

The presence of `@<path>` decides the trajectory.

- **No `@<path>` → create** a fresh plan. Scan every `plans/*-00-index.md` for a `status: active` (read all indices, not just one):
  - none active → the new plan is `status: active` — it takes the focus.
  - one already active → the new plan is `status: draft` — backlog, it does not steal the focus.
- **`@<path>` → amend** that named plan, whatever its status. Leave its `status:` unchanged and its closed `[x]` stages intact.
  - Amending a `draft` while no plan is `active` → after writing, offer to promote it to `active` (plain-text confirm, prefill «да»). The focus slot is empty, so this fills it rather than displacing a focus.

## Trajectory (Structured CoT)

Walk these steps in order; the artifact of each is visible before the next, and a skipped step shows by its absent artifact.

1. **Name** the entities / files / symbols the work touches. On amend, also name which existing stages it affects.
2. **Dispatch** (above): decide create vs amend. On create, scan the indices to set the new plan's status. On amend, read the named index in full.
3. **Ground** any area not yet grounded this session — both sources, report the status line (below). On create, most grounding is already done in `/grill`; ground here only what the plan reaches that the discussion did not. On amend, a new tail is a fresh area — ground it as if planning from scratch.
4. **Retrospective check** — test every new or changed stage against the three failures below.
5. **Architecture block** — present it in chat, integrating any memory-driven decision through the Synthesis Form. On amend, the block justifies why the plan changes and how it relates to the closed stages.
6. **Decompose** into stages, each one atomic meaningful commit, Tracer-Bullet slice by default (see Stage granularity). For each stage link the user stories it satisfies, set its gate strategy (see Stage gate contract), and set its development mode (see Stage development mode). On amend, re-decompose only not-yet-done stages, leaving `[x]` untouched.
7. **Write** the files (see Writing below).
8. **Report** the prefix, the changed file list, and any open question left for the user. On amend of a `draft` with no active plan, make the activate offer here.

## Grounding an area

To **ground** an area is to consult both sources before committing it to a stage, not memory alone.

- **Spec** — the system is intricate and runs on deliberate, vetted decisions, not on defaults. The already-loaded `specs/` root index maps the layers; from it, work out which layers the plan will touch and read how each prescribes the work — only the files relevant to the task, never a whole layer or the whole tree.
- **Code Memory** (why it is so, where not to step) — **anchored search** on the area's entities, files, and symbols; those are the coordinates in hand. Report the status line.

A touched layer left unread, or memory not queried, surfaces later as a blind spot — a stage breaks an invariant or a cross-module flow it never saw.

### Reading triggers — when to ground

Grounding is gated on a discrete context-shift event, never on a per-turn audit. Two axes:

- **Horizontal (breadth):** a business entity, file, or feature not yet discussed this session. Folding in a tail always fires this — the tail is new ground.
- **Vertical (depth):** the move from "what we want" to "how we build it" — a pattern, a DB structure, a mechanism.

On routine work inside an already-grounded area, omit the block. Over-reporting a search is an antipattern.

## Retrospective check — before writing

A planning-specific judgment pass. For every new or changed stage, test it against three failures and fix or flag what fails:

- **Repeats a rejected alternative** — the stage reintroduces an approach the discussion or the active index's Решения/Отклонения already ruled out.
- **Violates a known invariant** — the stage contradicts a `## Инварианты` rule from a grounded note or the governing spec.
- **Skips an antipattern guard** — the stage walks into control-flow sprawl, layer mixing, or duplication that the design discipline forbids.

## Architecture block — before writing

Present in chat before touching files: the applicable framework idioms, the antipatterns avoided, and the effect on stage structure. On amend, also why the plan changes and how it relates to the already-closed stages. When a pattern is chosen, name it in the plan. A short honest block is valid — do not invent abstractions to fill the check.

Read the convention docs in `specs/code/` and treat them as binding; a deviation needs explicit justification. No such doc — rely on framework idioms and state which you assumed. Take existing Решения/Отклонения from the active index as settled constraints. Use framework mechanisms by default — authorization, validation, events, middleware, ORM features — not hand-rolled equivalents.

Avoid by default: control-flow sprawl (long `if`/`switch` chains, deep nesting), layer mixing (controller logic in a model, business rules in a view), duplication (copy-pasted branches instead of one abstraction).

On amend, the block's substance is then recorded into the index `## Отклонения` — a plan change is itself a deviation from what was first written.

## Synthesis Form

Integrate memory into your own narrative; never quote a note raw and hand it to the user to interpret.

```
Я планировал <X>, но согласно [[id]] мы избегаем этого из-за <Y>,
поэтому предлагаю <Z>.
```

You own the synthesis — not "Вот что я нашёл: [[id]] говорит о Y. Давай делать Z."

## Writing

**Create** — write the index and every step file from the templates. Set the index `status:` to the value Dispatch determined (`active` or `draft`). Fill `## Grounding` with both sources collected in `/grill`. In each step file fill `## Связанные истории` and `## Стратегия гейта` per the Stage gate contract and `## Режим разработки` per Stage development mode; leave `## Журнал проходов` and `## Отложенные решения` as their template stubs — `/autopilot` owns them.

**Amend** — update the named index in place:

- Closed `[x]` stages stay as they are — never renumber, rewrite, or reopen them.
- A new step file takes the next free `NN` (max existing + 1); place its line in `## Этапы` at its execution position. The list order is the execution sequence; `NN` is only file identity.
- Re-decomposition applies only to not-yet-done stages: replace an open stage's line with the new ones, create the new step files, leave closed stages untouched.
- Fold the change rationale into `## Отклонения`, move any settled choice into `## Решения`, refresh `## Grounding` with newly grounded sources. Leave `status:` unchanged.

## Stage granularity

A stage = one atomic meaningful commit. Not "add an import", not "do the backend". Split axes: layers (mock → real), sequential integration, refactor → feature, per-module. A commit need not be runnable but must be one meaningful unit of change. Do not smear identical actions across commits; do not mix unrelated concerns in one.

**Tracer-Bullet is the default cut.** Decompose into thin vertical slices — a stage carries its micro-backend, its UI, and the E2E that proves the slice end to end, in one commit. A backend-only stage is allowed but is the justified exception (infrastructure with no user-facing surface yet, a pure algorithm, a migration) — name the reason in the stage. The default is the slice, not the layer.

## Stage gate contract

Every stage declares how it will be validated, in two sections the step file carries:

- **`## Связанные истории`** — the `<id>` of the System-Aware User Stories under `specs/product/user-stories/` the stage must satisfy. Link a story whenever the stage delivers a user-facing slice it describes. The presence of a story is the gate selector — an invariant of the format, not a free choice.
- **`## Стратегия гейта`** — derived from the stories, never chosen freely: no linked story → `test` (gate on the raw full-suite output); one or more → `e2e` plus a pointer to the project's launch mechanism and `precondition` seeding, without which the E2E gate cannot run.

Leave both empty (`—`) only for a stage with no user-facing behavior — the same exception that justifies a backend-only cut.

## Stage development mode

Every stage also declares `## Режим разработки` — how `/work` writes its code: `standard` (the default, also when absent), `tdd`, or `ui`. An authored choice, not derived from the stories. `standard` is the normal flow — the full Testing Discipline without strict test-first ordering. Set `tdd` for a stage whose testable logic is worth writing Red-Green-Refactor. Set `ui` only for an exploratory UI or markup stage where a test cannot precede the code; it is proved by the UI validation branch instead. The mode is independent of the gate — a `tdd` stage may still gate on `e2e`.

## Index note taxonomy

The index keeps four separate sections — do not merge them:

- **Решения** — settled decisions with rationale.
- **Отклонения** — where the plan changed or implementation left it, and why (populated by amend and by `/step-done`).
- **Edge cases** — what to check or cover with tests in later stages.
- **Открытые вопросы** — what needs user clarification.

## Grounding references in the plan

The index holds a `## Grounding` block persisting both watershed sources; `/work` reads it on stage start to load context before editing. On create, draw it from the `/grill` discussion; on amend, refresh it with whatever this change newly grounded.

- **`### Спецификации`** — the spec files relevant to the plan: path + a one-line note of what it holds for this work. A pointer with a hint, not a spec summary — do not duplicate spec content into the plan.
- **`### Память`** — the `[[id]]` of every note that shaped a decision and any useful anchors (full set: `entity:`, `file:`, `symbol:`, `env:`), each with a one-line note of its use.

## Prefix and file invariants

- **Prefix** — 3–4 letters derived from the feature name, lowercase, unique among existing `plans/*-00-index.md`.
- Flat `plans/`, no subfolders. File names `<prefix>-NN-<slug>.md`: `NN` two digits with leading zero, `00` = index.
- `plans/` is gitignored; the source of truth is the committed `specs/`.
- Progress = checkboxes in the index. The first stage without `[x]` is current. Step files carry sub-task checkboxes for resuming.

## Question style

- Ask one question at a time. Wait for the answer, then move on.
- Short question (a choice, yes/no, a name) — use the interactive widget if available.
- Complex or open question — ask as plain text.
- A confirmation — plain text, no widget; pre-fill the answer with «да».

## Templates

### Index — `plans/<prefix>-00-index.md`

```markdown
---
feature: <Название фичи>
status: active   # active при пустом фокусе, иначе draft — см. Dispatch
created: YYYY-MM-DD
---

# <Название фичи>

## Цель
<Зачем это делается>

## Контекст и ограничения
<Вводные данные, жесткие лимиты>

## Grounding
### Спецификации
<Указатели на файлы спеки, релевантные плану: путь + однострочник «что там полезного». Указатель с подсказкой, не пересказ спеки.>
### Память
<Ссылки `[[id]]` на ADR-заметки и полезные якоря (`entity:`/`file:`/`symbol:`/`env:`) с кратким пояснением, зачем они здесь.>

## Этапы
- [ ] `<prefix>-01-<slug>.md` — <суть шага>
- [ ] `<prefix>-02-<slug>.md` — <суть шага>

## Решения
<Архитектурные решения, принятые до или во время плана>

## Отклонения
<Почему план изменился и как это соотносится с закрытыми шагами (пополняется при amend и в /step-done)>

## Edge cases
<Что нужно не забыть покрыть тестами>

## Открытые вопросы
<Вопросы без ответа>
```

### Step file — `plans/<prefix>-NN-<slug>.md`

```markdown
# Step NN — <Название шага>

## Цель шага
<Что делаем конкретно здесь>

## Затрагиваемые файлы / символы
- `file:path/to/file.php` (Зачем трогаем)
- `symbol:Class::method` (Что меняем)

## Definition of done
- <Метрика успеха 1>
- <Метрика успеха 2 (например, написан функциональный тест на смену статусов)>

## Связанные истории
<id историй из specs/product/user-stories/, которые этап обязан удовлетворить. Наличие хотя бы одной — селектор ветки гейта: пусто → тест-гейт; есть → E2E по истории. Это инвариант формата, а не украшение. Пусто — оставить «—».>
- <story-id>

## Стратегия гейта
<Производна от ## Связанные истории, не свободный выбор. Пусто историй → `test` (гейт по сырому выводу полного прогона тестов). Есть истории → `e2e` плюс указатель на механизм запуска приложения и сева precondition — без него E2E-гейт невозможен.>

## Режим разработки
<Как /work пишет код на этапе. Авторский выбор, не производное от историй. `standard` (дефолт, он же пусто) → обычный поток: полная Testing Discipline без строгого test-first. `tdd` → надстройка Red-Green-Refactor на всю новую функциональность. `ui` → исследовательский UI/вёрстка, проверяемая UI-веткой валидации. Режим независим от гейта.>

## Подзадачи
- [ ] <Микро-шаг>
- [ ] <Микро-шаг>

## Рабочие заметки
*(Заполняется в процессе работы скиллом /work. ЗАПРЕЩЕНО писать сюда git diff или пересказ кода. Писать только: с какими проблемами столкнулся, почему тест упал, какое новое ограничение выявил).*

## Журнал проходов
*(Счётчик-артефакт стоп-крана, заполняется /autopilot. Строка на каждый проход валидации; 3 прохода без зелёного → стоп и эскалация. Пусто при ручном /work.)*
- проход 1: <вердикт · дефект, если есть>

## Отложенные решения
*(Tier-B моки, заполняется /autopilot: что отложено · почему · маркер в коде · downstream-зависимость. Обязаны всплыть в финальном отчёте. Пусто при ручном /work.)*
- <решение> · <маркер> · <downstream>
```

## Search contract

A `search` call has two paths, each with its own yield — separate calls, never two fields of one call.

- **Anchored search** (`anchors`) is the precise, information-dense path: it returns the notes pinned to the exact nodes in hand. Anchors union by OR — pass every relevant anchor in one call. Use it whenever a coordinate is known.
- **Full-text search** (`query`) is the orienting path — Russian descriptive words, 1–2 rephrasings, BM25 over summary and body, OR by default (`strict: true` for AND). Reach for it when no coordinate is in hand: boundaries still fuzzy, not all relevant anchors known, or the anchored search came back empty.

Mixing the two in one call is an error: the paths rank by different measures, so the relevance cut breaks and retrieval comes back incomplete.

Anchor types, closed set: `file:<path>`, `symbol:<path>::<Name>` (member: `<path>::<Class>.<member>`), `entity:<Name>` (registry via `list_entities`), `env:<VAR>`. Anchored search is exact-match URI equality — no hierarchy, no containment; `file:` does not pull in symbols inside it. To cast wide, pass the file, the class symbol, and member symbols all in the one OR-call.

Each search tied to a discrete unit of work reports a one-line status in chat: `память: нашёл N, пригодилось k` — counts only. The count cannot be written without searching — that is the point.

## Reading results

- Compact `search` list — read whole, pick by `summary`.
- `get_notes` for chosen `id`s — one call for several; returns the full body of each note.
- To read code, take coordinates from the note's anchor map and the `list_symbols_in_file` symbol map — read the symbol range, not the whole file.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified; verify before acting.
