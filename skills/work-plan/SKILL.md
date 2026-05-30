---
name: work-plan
description: Convert a settled approach into plan files under plans/ — run a final retrospective check against rejected alternatives and known invariants, present an architecture block, then write the index and per-stage step files. Use only when explicitly invoked as /work-plan.
---

# /work-plan — create a plan from a settled approach

Architect Mode. The approach was settled in `/work-grill`; this turns it into the plan files that drive execution. Before writing, run the retrospective check and present the architecture block.

### Architect Mode — design
Discuss patterns, invariants, data structures; decompose the work. Write plan, spec, or note files when the skill calls for it. Forbidden: generating production code.

Communicate with the user in Russian. Write all plan files in Russian. Skill instructions are English — this does not change the output language.

## Trajectory (Structured CoT)

Walk these steps in order; the artifact of each is visible before the next, and a skipped step shows by its absent artifact.

1. **Name** the entities / files / symbols the plan touches.
2. **Ground** any area not yet grounded this session — both sources, report the status line (below). Most grounding is already done in `/work-grill`; ground here only what the plan reaches that the discussion did not.
3. **Retrospective check** — test every intended stage against the three failures below.
4. **Architecture block** — present it in chat, integrating any memory-driven decision through the Synthesis Form.
5. **Decompose** into stages, each one atomic meaningful commit.
6. **Write** the index and the step files from the templates.
7. **Report** the prefix, the file list, and any open question left for the user.

## Grounding an area

To **ground** an area is to consult both sources before committing it to a stage, not memory alone.

- **Spec** — the system is intricate and runs on deliberate, vetted decisions, not on defaults. The already-loaded `specs/` root index maps the layers; from it, work out which layers the plan will touch and read how each prescribes the work — only the files relevant to the task, never a whole layer or the whole tree.
- **Code Memory** (why it is so, where not to step) — **anchored search** on the area's entities, files, and symbols; those are the coordinates in hand. Report the status line.

A touched layer left unread, or memory not queried, surfaces later as a blind spot — a stage breaks an invariant or a cross-module flow it never saw.

### Reading triggers — when to ground

Grounding is gated on a discrete context-shift event, never on a per-turn audit. Two axes:

- **Horizontal (breadth):** a business entity, file, or feature not yet discussed this session.
- **Vertical (depth):** the move from "what we want" to "how we build it" — a pattern, a DB structure, a mechanism.

On routine work inside an already-grounded area, omit the block. Over-reporting a search is an antipattern.

## Retrospective check — before writing

A planning-specific judgment pass. For every stage you intend to write, test it against three failures and fix or flag what fails:

- **Repeats a rejected alternative** — the stage reintroduces an approach the discussion or the active index's Решения/Отклонения already ruled out.
- **Violates a known invariant** — the stage contradicts a `## Инварианты` rule from a grounded note or the governing spec.
- **Skips an antipattern guard** — the stage walks into control-flow sprawl, layer mixing, or duplication that the design discipline forbids.

## Architecture block — before writing

Present in chat before writing files: the applicable framework idioms, the antipatterns avoided, and the effect on stage structure. When a pattern is chosen, name it in the plan. A short honest block is valid — do not invent abstractions to fill the check.

Read the convention docs in `specs/code/` and treat them as binding; a deviation needs explicit justification. No such doc — rely on framework idioms and state which you assumed. Take existing Решения/Отклонения from the active index as settled constraints. Use framework mechanisms by default — authorization, validation, events, middleware, ORM features — not hand-rolled equivalents.

Avoid by default: control-flow sprawl (long `if`/`switch` chains, deep nesting), layer mixing (controller logic in a model, business rules in a view), duplication (copy-pasted branches instead of one abstraction).

## Synthesis Form

Integrate memory into your own narrative; never quote a note raw and hand it to the user to interpret.

```
Я планировал <X>, но согласно [[id]] мы избегаем этого из-за <Y>,
поэтому предлагаю <Z>.
```

You own the synthesis — not "Вот что я нашёл: [[id]] говорит о Y. Давай делать Z."

## Stage granularity

A stage = one atomic meaningful commit. Not "add an import", not "do the backend". Split axes: layers (mock → real), sequential integration, refactor → feature, per-module. A commit need not be runnable but must be one meaningful unit of change. Do not smear identical actions across commits; do not mix unrelated concerns in one.

## Index note taxonomy

The index keeps four separate sections — do not merge them:

- **Решения** — settled decisions with rationale.
- **Отклонения** — where implementation left the plan, and why (populated later by `/work-update` and `/work-step-done`).
- **Edge cases** — what to check or cover with tests in later stages.
- **Открытые вопросы** — what needs user clarification.

## Grounding references in the plan

The index holds a `## Grounding` block persisting both watershed sources, drawn from the `/work-grill` discussion; `/work` reads it on stage start to load context before editing.

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

## Templates

### Index — `plans/<prefix>-00-index.md`

```markdown
---
feature: <Название фичи>
status: active
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
<Ссылки `[[id]]` на ADR-заметки и полезные якоря (`entity:`/`file:`/`symbol:`/`env:`), найденные при обсуждении, с кратким пояснением, зачем они здесь.>

## Этапы
- [ ] `<prefix>-01-<slug>.md` — <суть шага>
- [ ] `<prefix>-02-<slug>.md` — <суть шага>

## Решения
<Архитектурные решения, принятые до или во время плана>

## Отклонения
<Отклонения от первоначального плана (пополняется скиллом /work-update)>

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

## Подзадачи
- [ ] <Микро-шаг>
- [ ] <Микро-шаг>

## Рабочие заметки
*(Заполняется в процессе работы скиллом /work. ЗАПРЕЩЕНО писать сюда git diff или пересказ кода. Писать только: с какими проблемами столкнулся, почему тест упал, какое новое ограничение выявил).*
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
- `list_symbols_in_file` for a large file before targeted `Read` — pull the symbol map, read the symbol range, not the whole file.
- Anchor map of a note — coordinates for reading code.
- `[[id]]` mentioned-notes block — decide by `summary` whether to load via `get_notes`.
- `stale` anchor — show to the user, do not silently ignore.
- `draft` note or `## Гипотезы` section — flag to the user as unverified; verify before acting.
