# Skill ↔ Core coverage

Чек-лист обязательных слайсов `core.md` для каждого скилла корпуса 2.0.

**Зачем.** Скиллы 2.0 не подгружают `core.md` в рантайме (решение `sk2-06`):
каждый скилл обязан заинлайнить нужные ему операционные слайсы и быть
самодостаточным на нормальном пути. Этот файл фиксирует, *какие* слайсы
обязан нести каждый скилл — чтобы при сборке и при ресинке после правки
`core.md` можно было пройти по списку и проверить наличие.

**Как пользоваться.** При создании/правке скилла или после изменения
`core.md` — пройти по списку соответствующего скилла, отметить наличие
каждого слайса. Слайс «есть» = он реально заинлайнен в `SKILL.md`
(не «упомянут где-то рядом»). Источник каждого слайса указан в скобках:
`mem` = `skills/mem/core.md`, `work` = `skills/work/core.md`; цитаты на доки
(`skills.md`, `context-engineering.md`, `user-stories.md`, `formats.md`) —
относительно `docs/workflow/` и `docs/consumer-guide/`.

**Не дублирует** содержание `core.md` — это карта обязательности, а не
сам канон. Логика слайса живёт в `core.md`; здесь только его имя.

Пометки охвата:
- `*` — операционный слайс search/anchor. Композит из трёх блоков
  `mem/core.md`: `### Anchor model` (типы + exact-match URI, передавать все
  уровни) + `## Searching` (две оси + status line) + `### Reading results`.
  Копируются дословно как блоки. Общий для всех скиллов, делающих `search`.
  Authoring-слайс (для пишущих ноты) = `### Anchor model` + `### Two-axis
  rule` + `### Weights`.
- Mode-слайс — **дословная копия одного блока `### <Mode>`** из секции
  `Modes` в `work/core.md` (имя + mindset + forbidden). Не вся секция
  `Modes` (intro + mode-shift не копируются), и не авторский парафраз —
  именно блок, чтобы наличие проверялось бинарно. Скилл-специфичные
  запреты (у `/mem` — «не пересказ диффа») остаются в теле скилла, не в
  блоке. Краевые случаи — bespoke-строка, а не блок: `/work-grill`
  копирует **два** блока (Ask + Architect) + слайс mode-shift trigger;
  `/work-prime` — «no Mode» (он `— (system)`); `/mem-explore` —
  «stop-and-confront brake», не один из трёх режимов.
- Язык общения (рус.) и язык артефактов (рус.) — обязательны везде, в
  списках ниже не повторяются.

---

## Семейство `mem`

### `/mem` — capture (Architect, judgment)

- [ ] Mode-блок `### Architect Mode` дословно; capture-запрет — в теле (work: Modes)
- [ ] Capture-only; reading ambient и owned elsewhere (mem: Two modes)
- [ ] Worth capturing — критерии (mem: Capture discipline)
- [ ] Что НЕ писать: rename, typo, пересказ диффа (mem: Capture discipline)
- [ ] Траектория capture как Structured CoT (work: Structured CoT)
- [ ] Section criteria — выбор секции по роли (mem: Section criteria)
- [ ] Anti-swamp правило для `## Инварианты` (mem: Anti-swamp rule)
- [ ] ADR-тон: outcome не chronology, one role per section, declarative (mem: Notes are ADR)
- [ ] Оба шаблона тела — Regular + Investigation (mem: Note body)
- [ ] `summary` — authored announce line (mem: summary)
- [ ] Якоря по двум осям, все уровни (mem: Two-axis rule)
- [ ] Веса: centrality + `critical` только при Инвариантах (mem: Weights)
- [ ] `*` Search-слайс для dedup-поиска по составленному набору якорей (exact-match, все уровни) + status line (mem: Searching)
- [ ] Контракт `create_note` + резолв `warning` (mem: create_note contract)
- [ ] Контракт `update_note` — merge при совпадении scope, не дублировать (mem: update_note contract)
- [ ] Note IDs — серверный хэш, `[[id]]`, не выдумывать (mem: Note IDs)
- [ ] Незарегистрированная сущность → `create_entity` после подтверждения (mem: Unregistered entity)
- [ ] Подтверждение сохранения plain-text, prefill «да» (mem: confirm policy)
- [ ] Antipatterns capture (mem: Antipatterns)

### `/mem-onboarding` — seed (Architect)

- [ ] Mode-блок `### Architect Mode` дословно (work: Modes)
- [ ] Skill-driven; своих MCP/CLI-инструментов нет (mem-onboarding spec)
- [ ] Бутстрап индекса: `reindex` автоматом на пустом индексе (spec §1)
- [ ] Setup: логика преобразования + стартовые сущности через `create_entity` (spec §2)
- [ ] Chunk-loop: read → search → decide → author → drop raw (spec §3)
- [ ] `*` Search-слайс: `include_drafts: true`, anchor exact-match (все уровни), status line (mem: Searching)
- [ ] Note authoring: ролевая структура + оба шаблона (mem: Note body)
- [ ] Якоря по двум осям, все уровни (mem: Two-axis rule)
- [ ] Веса: centrality + `critical` (mem: Weights)
- [ ] `summary` (mem: summary)
- [ ] Все ноты `status: draft`; хранилище как сквозная память (spec)
- [ ] Инвентаризация: `match_all: true` + `include_drafts` (только онбординг)
- [ ] Review: промоут draft→current через `update_note` (spec §4)
- [ ] Scratch-файл `.memory/onboarding.md`, многосессионность (spec)
- [ ] Нечёткие источники — усиленная дисциплина, только verifiable artifact (spec)
- [ ] Граница автоматики: только артикулированное, без реконструкции «почему» (spec)
- [ ] Подтверждение сущностей plain-text, prefill «да» (mem: confirm policy)

### `/mem-explore` — emergency (Ask/Architect)

- [ ] Mode bespoke: «stop-and-confront brake», не один из трёх режимов (work: Modes — краевой случай)
- [ ] Manual brake; не часть workflow; `disable-model-invocation` (context-engineering.md)
- [ ] Stop-генерация; файлов не пишет; решения нет до дашборда (skills.md: /mem-explore)
- [ ] Назвать активную область — scope retrieval'а (skills.md: /mem-explore)
- [ ] Широкий retrieval: `list_entities` + anchors + query + `RULES.md`/`specs` (context-engineering.md)
- [ ] `*` Search contract (две оси, exact-match, все уровни одним OR) (mem: Searching)
- [ ] Reading contract: компакт-лист, `get_notes` пачкой, `[[id]]`-блок (mem: Reading results)
- [ ] Извлечь `## Инварианты` + `## Антипаттерны` из тел (mem: Note body)
- [ ] Флаги: `stale` / `draft` / `## Гипотезы` / `critical` (mem: Reading results)
- [ ] Confront: последние 2–3 предложения ↔ правила (context-engineering.md)
- [ ] status line (`нашёл N, пригодилось/релевантно k`) (mem: Searching)
- [ ] Шаблон дашборда (Противоречия/Подтверждено/Не покрыто/Флаги/Курс)
- [ ] Await direction — ждать выбора пользователя (skills.md: /mem-explore)

---

## Семейство `work`

### `/work-prime` — load context (— system)

- [ ] Не стартует Mode, не предлагает шаг; только загрузка (work: Commands)
- [ ] Чтение base specs (корень `specs/`, без подпапок) (skills.md: /work-prime)
- [ ] Активный план: единственный `*-00-index.md`, `status: active`, только индекс (skills.md: /work-prime)
- [ ] `list_entities` — доменная карта (skills.md: /work-prime)
- [ ] Репорт загруженного + счётчик-артефакт `домен-карта: N` (work: behavioral)
- [ ] Разрешение неоднозначности плана (>1 active / `@<path>`) — graceful (work: invariant 1)
- [ ] Do-not: не `search`, не step-файлы/код, не пересказ, не вопросы

### `/work-grill` — discuss (Ask → Architect, judgment)

- [ ] Modes Ask + Architect, их forbidden-списки (work: Modes)
- [ ] Mode-shift как триггер grounding-а (work: Mode-shift trigger)
- [ ] Structured CoT — когнитивная траектория (work: Structured CoT)
- [ ] Synthesis Form (work: Synthesis Form)
- [ ] Reading triggers: горизонтальный + вертикальный (work: Reading triggers)
- [ ] `*` Search-слайс + status line (mem: Searching)
- [ ] Водораздел specs vs memory для grounding — двухисточниковый pull (управляющая спека + память), спека не уходит из фокуса (work: watershed)
- [ ] Сбор обоих источников (спек-указатели + `[[id]]`/якоря) для будущего `## Grounding` плана (work: Grounding references)
- [ ] Файлов НЕ пишет (work: invariant 5)
- [ ] Design discipline — архитектурный фрейминг (work: Design discipline)
- [ ] Question style — один вопрос за раз (work: Question style)

### `/storyteller` — User Story (Architect)

- [ ] Architect Mode (work: Modes)
- [ ] Контекст не ищет, вопросов не задаёт — он уже загружен (skills.md: /storyteller)
- [ ] Формат System-Aware Story: `action` + `system_reaction` в каждом шаге (skills.md: /storyteller, consumer-guide/user-stories.md)
- [ ] Запись в `specs/product/user-stories/` (skills.md: /storyteller)
- [ ] Шаблон Story заинлайнен (consumer-guide/formats.md / work: Templates)
- [ ] Пишет файл — на явном сигнале (work: invariant 5)

### `/work-plan` — create plan (Architect, judgment)

- [ ] Architect Mode (work: Modes)
- [ ] Structured CoT (work: Structured CoT)
- [ ] Synthesis Form (work: Synthesis Form)
- [ ] Reading triggers + `*` search-слайс + status line; двухисточниковый grounding (спека области + память) (work/mem)
- [ ] Retrospective чек / Architecture Block в чат до записи (work: Design discipline)
- [ ] Design discipline — антипаттерны, framework-механизмы (work: Design discipline)
- [ ] Таксономия индекса: Решения/Отклонения/Edge cases/Открытые вопросы (work: Index taxonomy)
- [ ] `## Grounding`: `### Спецификации` (пути + однострочник, не пересказ) + `### Память` (`[[id]]` + якоря полного набора) (work: Grounding references)
- [ ] Stage granularity — один шаг = один осмысленный коммит (work: Stage granularity)
- [ ] Key invariants: flat `plans/`, имена `<prefix>-NN-<slug>`, gitignored, чекбоксы (work: Key invariants)
- [ ] Шаблоны index + step заинлайнены (work: Templates)
- [ ] Question style (work: Question style)

### `/work-update` — modify plan (Architect, judgment)

- [ ] Architect Mode (work: Modes)
- [ ] Structured CoT (work: Structured CoT)
- [ ] Synthesis Form (work: Synthesis Form)
- [ ] Use cases: скоуп ±, «хвосты», ре-декомпозиция (skills.md: /work-update)
- [ ] Reading triggers + `*` search-слайс + status line, особо для нового «хвоста»; двухисточниковый grounding (спека области + память) (skills.md: /work-update)
- [ ] Architecture Block — обоснование правки плана (skills.md: /work-update)
- [ ] Таксономия индекса (work: Index taxonomy)
- [ ] Обновление `## Grounding` — оба источника (work: Grounding references)
- [ ] Не ломать закрытые `[x]` шаги (skills.md: /work-update)
- [ ] Разрешение активного плана (`@<path>` / единственный active) (work: invariant 1)
- [ ] Шаблоны index/step при создании новых шагов (work: Templates)
- [ ] Question style (work: Question style)

### `/work` — execute (Code Mode, procedural)

- [ ] Code Mode + forbidden: не менять specs/планы без разрешения (work: Modes)
- [ ] Чтение `00-index.md` + текущего `NN-step.md` (skills.md: /work)
- [ ] Текущий шаг = первый без `[x]` (work: Key invariants)
- [ ] `## Grounding`: читает `### Спецификации`-указатели + `get_notes` по `[[id]]` из `### Память` — подгрузить контекст до кода (work: Grounding references)
- [ ] Reading triggers (first touch file/symbol, вертикаль) + `*` search + status line; двухисточниковый grounding (спека области + память) (work/mem)
- [ ] Testing discipline полностью: mandatory, под требования (work: Testing discipline)
- [ ] Unit vs Feature (work: Testing discipline)
- [ ] State-Machine & Flow Coverage — запрет happy-path-only (work: Testing discipline)
- [ ] Test Strategy Doc до сложного фичевого теста (work: Testing discipline)
- [ ] Red-Green при багфиксе (work: Testing discipline)
- [ ] Failure paths, не только happy (work: Testing discipline)
- [ ] Шаг завершается только при зелёном полном прогоне (work: Testing discipline)
- [ ] Working notes discipline — борьба и решения, не пересказ диффа (work: Working notes)
- [ ] `rename_anchor` при переименовании символа/файла (mem: rename_anchor contract)

### `/work-step-done` — close stage (Architect)

- [ ] Architect Mode рефлексии (skills.md: /work-step-done)
- [ ] Чтение `## Рабочие заметки` из файла шага (skills.md: /work-step-done)
- [ ] Суммаризация в секции индекса (Решения/Отклонения/Edge/Открытые) (work: Index taxonomy)
- [ ] Вызов `/mem` для новых знаний; strip plan-process метаданных (work: Writing — plan to memory)
- [ ] Водораздел: что идёт в память (work: watershed)
- [ ] Простановка `[x]` в индексе (skills.md: /work-step-done)
- [ ] Никакого capture mid-stage (work: Writing — plan to memory)

### `/work-done` — finalize (Architect)

- [ ] Architect Mode (work: Modes)
- [ ] Проверка, что все шаги `[x]` (skills.md: /work-done)
- [ ] Разнос по водоразделу specs vs memory (work: Writing — plan to memory)
- [ ] Обновление `specs/` только при изменении бизнес-логики/модели/паттерна (work: Writing)
- [ ] Вызов `/mem` для глобальных архитектурных решений плана (skills.md: /work-done)
- [ ] Смена статуса плана на `completed` (skills.md: /work-done)
- [ ] Не удалять файлы плана автоматом (work: Behavioral notes)
