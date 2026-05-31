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
  уровни) + `## Searching` (два пути — anchored vs full-text, смешивание осей
  в одном вызове — ошибка, + status line) + `### Reading results`.
  Копируются дословно как блоки — целиком, без сокращения буллетов: при
  ресинке легко обронить буллет чтения кода (якорная карта + символьная карта
  `list_symbols_in_file`, чтение диапазоном); проверять его наличие явно. Общий
  для всех скиллов, делающих `search`.
  Authoring-слайс (для пишущих ноты) = `### Anchor model` + `### Two-axis
  rule` + `### Weights`.
- Mode-слайс — **дословная копия одного блока `### <Mode>`** из секции
  `Modes` в `work/core.md` (имя + mindset + forbidden). Не вся секция
  `Modes` (intro + mode-shift не копируются), и не авторский парафраз —
  именно блок, чтобы наличие проверялось бинарно. Скилл-специфичные
  запреты (у `/mem` — «не пересказ диффа») остаются в теле скилла, не в
  блоке. Краевые случаи — bespoke-строка, а не блок: `/grill`
  копирует **два** блока (Ask + Architect) + слайс mode-shift trigger;
  `/prime` — «no Mode» (он `— (system)`); `/mem-explore` —
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

### `/prime` — load context (— system)

- [ ] Не стартует Mode, не предлагает шаг; только загрузка (work: Commands)
- [ ] Чтение base specs (корень `specs/`, без подпапок) (skills.md: /prime)
- [ ] Активный план: единственный `*-00-index.md`, `status: active`, только индекс; `draft`/`completed` не грузятся (skills.md: /prime; work: Plan lifecycle)
- [ ] `list_entities` — доменная карта (skills.md: /prime)
- [ ] Репорт загруженного + счётчик-артефакт `домен-карта: N` (work: behavioral)
- [ ] Разрешение неоднозначности плана (>1 active / `@<path>`) — graceful (work: invariant 1)
- [ ] Do-not: не `search`, не step-файлы/код, не пересказ, не вопросы

### `/grill` — discuss (Ask → Architect, judgment)

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

### `/blueprint` — create or amend plan (Architect, judgment)

- [ ] Architect Mode (work: Modes)
- [ ] Диспетчеризация create/amend по `@<path>`; статус нового плана (active при пустом фокусе, иначе draft); offer-activate на amend `draft` без активного (work: Plan lifecycle; blueprint dispatch)
- [ ] Разрешение плана: `@<path>` → named любого статуса (amend); нет `@<path>` → create (work: invariant 1)
- [ ] Structured CoT — единая траектория с развилкой create/amend (work: Structured CoT)
- [ ] Synthesis Form (work: Synthesis Form)
- [ ] Use cases amend: скоуп ±, «хвосты», ре-декомпозиция (skills.md: /blueprint)
- [ ] Reading triggers + `*` search-слайс + status line, особо для нового «хвоста»; двухисточниковый grounding (спека области + память) (work/mem)
- [ ] Retrospective чек / Architecture Block в чат до записи; на amend — обоснование правки + запись в `## Отклонения` (work: Design discipline)
- [ ] Design discipline — антипаттерны, framework-механизмы (work: Design discipline)
- [ ] Таксономия индекса: Решения/Отклонения/Edge cases/Открытые вопросы (work: Index taxonomy)
- [ ] `## Grounding`: `### Спецификации` (пути + однострочник, не пересказ) + `### Память` (`[[id]]` + якоря полного набора); на amend — обновление обоих источников (work: Grounding references)
- [ ] Writing rules amend: не ломать закрытые `[x]`; new step = next free `NN`; re-decomp только открытых шагов (skills.md: /blueprint)
- [ ] Stage granularity — один шаг = один осмысленный коммит (work: Stage granularity)
- [ ] Key invariants: flat `plans/`, имена `<prefix>-NN-<slug>`, gitignored, чекбоксы (work: Key invariants)
- [ ] Шаблоны index + step заинлайнены (work: Templates)
- [ ] Question style; confirm prefill «да» для offer-activate (work: Question style)

### `/prepare` — reconnaissance (bespoke Reconnaissance Mode, judgment)

- [ ] Mode bespoke: «reconnaissance — карта для исполнителя, без HOW/кода» (work: Modes — краевой случай, как `/mem-explore`)
- [ ] Две морковки: complete map (front) + partial map хуже чем none (back) (skills.md: /prepare)
- [ ] Траектория разведки как Structured CoT, 8 шагов (work: Structured CoT)
- [ ] Self-prime: plan resolution + index/step + specs root/`RULES` + `list_entities` (work: invariant 1; skills.md: /prepare)
- [ ] Назвать всю территорию-кандидатов, не первые (skills.md: /prepare)
- [ ] `*` Search-слайс (две оси, exact-match, все уровни OR) + status line (mem: Searching)
- [ ] Reading results, с релаксацией: полное чтение ключевых файлов (mem: Reading results, адаптировано)
- [ ] Вердикт релевантности по каждому кандидату, без рецепта реализации (work: Reconnaissance)
- [ ] Валидация шаг 1: реверс blind-spots — контекст-less читатель (skills.md: /prepare)
- [ ] Валидация шаг 2: достаточность против `## Цель шага`/`## Definition of done`/`## Подзадачи` — каждый пункт DoD имеет координату (skills.md: /prepare)
- [ ] Run-file: запись + «Проверено и отброшено» + escape hatch (consumer-guide/formats.md; work: Reconnaissance)
- [ ] Шаблон run-файла заинлайнен (consumer-guide/formats.md)
- [ ] Презентация супер-компактная: не дублировать run-файл, одна standout-находка как финальный self-check (skills.md: /prepare)
- [ ] Antipatterns разведки (prepare)

### `/work` — execute (Code Mode, procedural)

- [ ] Code Mode + forbidden: не менять specs/планы без разрешения (work: Modes)
- [ ] Чтение `00-index.md` + текущего `NN-step.md` (skills.md: /work)
- [ ] Текущий шаг = первый без `[x]` (work: Key invariants)
- [ ] Reconnaissance decision: делегация по умолчанию / self-read на малом + явная строка (work: Delegation)
- [ ] Сплит загрузки: делегация — только rules floor (specs root + RULES), домен-карту даёт субагент; self-read — полный `/prime` (work: Delegation)
- [ ] Потребление run-файла: координаты + `[[id]]` + срез `## Сущности`; escape hatch для полного реестра (work: Reconnaissance)
- [ ] HOW выводится из карты интринсиком Code Mode, без отдельной design-pass-секции (work: Reconnaissance)
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

### `/checkpoint` — save partial progress (— system, procedural)

- [ ] Не стартует Mode; защиту несёт явный forbidden-set («no Mode» как `/prime`) (work: Commands — краевой случай)
- [ ] Forbidden-set контрастный к `step-done`: не `/mem`, не удалять run-файл, не `[x]` этапа, не `specs/`; capture mid-stage запрещён (work: Writing — plan to memory; The run-file)
- [ ] Разрешение плана: `@<path>` / единственный `active` / refuse при неоднозначности (work: invariant 1)
- [ ] Текущий шаг = первый без `[x]`; чтение step-файла целиком (work: Key invariants)
- [ ] Оценка готовности (подзадачи / DoD / остаток) — инверсия finished-check `step-done` (skills.md: /checkpoint)
- [ ] Простановка `[x]` готовым подзадачам, незавершённые не трогает (skills.md: /step-done — checking off, адаптировано)
- [ ] Находки + маркер «где встал / следующий шаг» в `## Рабочие заметки` (work: Working notes)
- [ ] Working notes discipline — борьба и решения, не пересказ диффа (work: Working notes)
- [ ] Re-entry на штатной механике `/work` (первая неотмеченная подзадача + рабочие заметки), без resume-секции (work: The run-file; /work re-entry)

### `/step-done` — close stage (Architect)

- [ ] Architect Mode рефлексии (skills.md: /step-done)
- [ ] Чтение `## Рабочие заметки` из файла шага (skills.md: /step-done)
- [ ] Суммаризация в секции индекса (Решения/Отклонения/Edge/Открытые) (work: Index taxonomy)
- [ ] Вызов `/mem` для новых знаний; strip plan-process метаданных (work: Writing — plan to memory)
- [ ] Водораздел: что идёт в память (work: watershed)
- [ ] Простановка `[x]` в индексе (skills.md: /step-done)
- [ ] Удаление `<prefix>-run.md` на закрытии этапа (work: The run-file)
- [ ] Никакого capture mid-stage (work: Writing — plan to memory)

### `/finalize` — finalize (Architect)

- [ ] Architect Mode (work: Modes)
- [ ] Проверка, что все шаги `[x]` (skills.md: /finalize)
- [ ] Разнос по водоразделу specs vs memory (work: Writing — plan to memory)
- [ ] Обновление `specs/` только при изменении бизнес-логики/модели/паттерна (work: Writing)
- [ ] Вызов `/mem` для глобальных архитектурных решений плана (skills.md: /finalize)
- [ ] Смена статуса плана на `completed` (skills.md: /finalize)
- [ ] Не удалять файлы плана автоматом (work: Behavioral notes)
