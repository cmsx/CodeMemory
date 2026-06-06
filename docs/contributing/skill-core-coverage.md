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
- [ ] Запись в `specs/user-stories/`, имя `<id>-<slug>.md`, свободная подпапка без зеркалирования `features/` (consumer-guide/user-stories.md, documentation-system.md)
- [ ] Идентичность по id: 4-симв. `[a-z0-9]` токен, глобальная уникальность FS-сканом `**/<id>-*.md`, коллизия → перегенерация (consumer-guide/user-stories.md; storyteller)
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
- [ ] Tracer-Bullet — дефолт декомпозиции (тонкий вертикальный слайс), бэкенд-only как обоснованное исключение (blueprint)
- [ ] Stage gate contract: линковка историй по `<id>` (путь не несущий) + стратегия гейта, производная от наличия истории (селектор-инвариант, не свободный маркер) (formats.md; blueprint)
- [ ] Stage test targets: называние тест-мишеней этапа в DoD (из `expected`/`system_reaction` истории или `## Цель шага`), указатель на relevance-канон `work`, без копии; этап без поведения — пред-declare исключения (blueprint)
- [ ] Stage development mode: проставление `## Режим разработки` — авторский выбор из трёх (`standard` дефолт, `tdd`, `ui`), не производное от историй и независимое от гейта (formats.md; blueprint)
- [ ] Key invariants: flat `plans/`, имена `<prefix>-NN-<slug>`, gitignored, чекбоксы (work: Key invariants)
- [ ] Шаблоны index + step заинлайнены; step несёт секции трека `/autopilot`: авторские при создании плана (Связанные истории, Стратегия гейта, Режим разработки) + стабы `/autopilot` (Журнал проходов, Отложенные решения) (work: Templates; formats.md)
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
- [ ] Run-file: запись `plans/<prefix>/run-<NN>.md` + «Проверено и отброшено» + escape hatch (consumer-guide/formats.md; work: The run-file)
- [ ] Шаблон run-файла заинлайнен (consumer-guide/formats.md)
- [ ] Презентация супер-компактная: не дублировать run-файл, одна standout-находка как финальный self-check (skills.md: /prepare)
- [ ] Antipatterns разведки (prepare)
- [ ] Interaction mode: no-op слайс — run-файл единственный выход на любом пути, не блокируется (work: Interaction mode)

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
- [ ] Testing discipline: mandatory + явный порядок relevance → completeness (сначала мишень и уровень, потом полнота) (work: Testing discipline)
- [ ] Relevance — презумпция теста: новый код тестируется по умолчанию, пропуск — объясняемое исключение (UI / no-behavior), логика внутри правки тестируется (work: Testing discipline — Relevance)
- [ ] Relevance — уровень решает, не ключевое слово: unit=наша логика в изоляции / feature=наш контракт (валидация вне границ на unit, в границах на feature) (work: Testing discipline — Relevance)
- [ ] Relevance — Must-Not framework behavior in isolation: горстка примеров + общая формула; feature-проверка контракта не под запретом (work: Testing discipline — Relevance)
- [ ] Completeness — под требования, не под написанный код (work: Testing discipline — Completeness)
- [ ] Completeness — State-Machine & Flow Coverage: покрытие не ограничено happy-path (work: Testing discipline — Completeness)
- [ ] Test Strategy Doc до сложного фичевого теста (work: Testing discipline)
- [ ] Red-Green при багфиксе (work: Testing discipline)
- [ ] Development mode overlay: маркер `## Режим разработки` — три значения (`standard`/пусто → обычный поток без строгого test-first; `tdd` → жёсткий Red-Green-Refactor на всю новую функциональность; `ui` → выкл/UI-ветка), наследование Testing Discipline (incl. relevance) всеми режимами (work: Testing discipline — Development mode overlay)
- [ ] Failure paths, не только happy (work: Testing discipline)
- [ ] Шаг завершается только при зелёном полном прогоне (work: Testing discipline)
- [ ] Working notes discipline — борьба и решения, не пересказ диффа (work: Working notes)
- [ ] `rename_anchor` при переименовании символа/файла (mem: rename_anchor contract)
- [ ] Interaction mode: реальная ветка — autonomous решает дефолт+лог сам, needs-human → pointer-возврат; attended «when in doubt ask»; канал вызова = режим (work: Interaction mode)

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
- [ ] Гейт качества тестов на закрытии (шаг 3): тесты этапа пиннят наше поведение по канону relevance `work`, не дублируя его; отсутствие теста — обоснование в `## Рабочие заметки` либо пред-declared этап без поведения (`## Связанные истории: —`/`## Режим разработки: ui`); несоответствие — стоп без `[x]` (work: Testing discipline — Relevance)
- [ ] Суммаризация в секции индекса (Решения/Отклонения/Edge/Открытые) (work: Index taxonomy)
- [ ] Вызов `/mem` для новых знаний; strip plan-process метаданных (work: Writing — plan to memory)
- [ ] Водораздел: что идёт в память (work: watershed)
- [ ] Простановка `[x]` в индексе (skills.md: /step-done)
- [ ] Никакого capture mid-stage (work: Writing — plan to memory)
- [ ] Interaction mode: no-op слайс — нет ветки вопроса к человеку; not-finished стоп = autonomous-exit (work: Interaction mode)

### `/finalize` — finalize (Architect)

- [ ] Architect Mode (work: Modes)
- [ ] Проверка, что все шаги `[x]` (skills.md: /finalize)
- [ ] Разнос по водоразделу specs vs memory (work: Writing — plan to memory)
- [ ] Обновление `specs/` только при изменении бизнес-логики/модели/паттерна (work: Writing)
- [ ] Вызов `/mem` для глобальных архитектурных решений плана (skills.md: /finalize)
- [ ] Смена статуса плана на `completed` (skills.md: /finalize)
- [ ] Файлы-запись плана (индекс, шаги) не удалять автоматом — вручную (work: Behavioral notes)
- [ ] Sweep run-файлов `plans/<prefix>/run-<NN>.md` при закрытии плана — per-step леса, не запись (work: The run-file)
- [ ] Interaction mode: реальная ветка — шаг raise (edge/открытые) mode-условен; autonomous surface+стоп без `completed`; канал вызова = режим (work: Interaction mode)

### `/validate` — gate a stage (bespoke Verification Mode, procedural)

- [ ] Mode bespoke: «Verification Mode — gate; вердикт только под неподделываемый артефакт», не один из трёх режимов (work: Modes — краевой случай, как `/prepare`)
- [ ] Дуальность inline / спавн + оркестрационная нейтральность; единственный выход — файл отчёта (skills.md: /prepare — Duality; work: Delegation)
- [ ] Разрешение плана: `@<path>` / единственный `active` / refuse при неоднозначности (work: invariant 1)
- [ ] Текущий шаг = первый без `[x]`; чтение step-файла целиком (Цель/DoD/Связанные истории/Стратегия гейта) (work: Key invariants)
- [ ] Селектор ветки из `## Стратегия гейта`, производной от наличия истории; кросс-чек presence, не угадывать (blueprint: Stage gate contract; formats.md)
- [ ] Резолв связанной истории по `<id>` через glob `specs/user-stories/**/<id>-*.md`, не по фиксированному пути; нет файла → `blocked` (consumer-guide/user-stories.md; validate)
- [ ] Test-ветка: полный прогон, сырой stdout/stderr verbatim (не пересказ); skipped = defect (work: Testing discipline — зелёный полный прогон)
- [ ] E2E-ветка: зависимость от запуска приложения + сева `precondition`; отсутствие → `blocked`/Tier C, не суждение на ходу (formats.md: Стратегия гейта; index edge case)
- [ ] E2E coverage: все `negative_paths`, не только happy path (consumer-guide/user-stories.md; work: State-Machine coverage — аналог)
- [ ] Observation/verdict split: «Что видно на экране» (нейтральная транскрипция) отдельно от «Соответствие expected» (вердикт) — оркестратор читает текст, картинки не грузит (index: решение)
- [ ] Вердикт-контракт `green` / `defect` / `blocked`, читается оркестратором из текста отчёта
- [ ] UI validation branch: E2E-ветка закрывает форвард-референс из `/work` для `ui`-режима (work: Development mode overlay)
- [ ] Шаблон отчёта (Markdown) заинлайнен; место хранения `plans/<prefix>/step-<NN>.md` + `screenshots/` (consumer-guide/formats.md — аналог)
- [ ] Презентация компактная: вердикт + путь к отчёту, не дублировать отчёт в чат (skills.md: /prepare — презентация)
- [ ] Interaction mode: no-op слайс в Duality — не блокируется на человеке, вердикт `blocked` уже autonomous-exit (work: Interaction mode)

### `/diagnose` — locate the root cause (bespoke Diagnosis Mode, judgment)

- [ ] Mode bespoke: «Diagnosis Mode — трасса к корню, карта координат, без рецепта/правок», не один из трёх режимов (work: Modes — краевой случай, как `/prepare`//`/validate`)
- [ ] Дуальность inline / спавн + оркестрационная нейтральность; единственный выход — файл отчёта (skills.md: /prepare — Duality; work: Delegation)
- [ ] Принцип долговечного знания: корень реконструируется из долговечных артефактов (якоря плана `## Затрагиваемые файлы`/`## Grounding`, удерживаемый `run-<NN>.md`, `[[id]]`, коммитнутый код), не из мёртвого контекста исполнителя; fix-forward без rewind закрытых `[x]` (index: Решения — кросс-слойное падение)
- [ ] Разрешение плана: `@<path>` / единственный `active` / refuse при неоднозначности; спавнящий `/autopilot` передаёт путь (work: invariant 1)
- [ ] Текущий шаг = первый без `[x]`; вход = `## Дефект` из отчёта `/validate` (work: Key invariants)
- [ ] Траектория диагностики как Structured CoT, 7 шагов (work: Structured CoT)
- [ ] Назвать всю подозреваемую территорию по слоям (фронт/бэк/проводка), полный набор кандидатов, не ближний слой (skills.md: /prepare — назвать территорию, адаптировано)
- [ ] Run-файл как durable-карта подозреваемой территории: текущий `run-<NN>.md` в шаге 2, ранний `run-<MM>.md` — только при заходе трассы в закрытый этап (consumer-guide/formats.md; work: The run-file)
- [ ] `*` Search-слайс (две оси, exact-match, все уровни OR) + status line (mem: Searching)
- [ ] Reading results (mem: Reading results)
- [ ] Локализация: координаты корня отделены от поверхности симптома, без рецепта починки (work: Reconnaissance — вердикт без рецепта, аналог)
- [ ] Валидация корня: корень объясняет весь симптом; не локализуется из долговечных артефактов → `inconclusive`, не угадывать (skills.md: /prepare — валидация достаточности, аналог)
- [ ] Вердикт-контракт `located` / `inconclusive`, читается оркестратором из текста; `inconclusive` = Tier C стоп + эскалация (index: Решения — политика «не застрять» Tier C / стоп-кран)
- [ ] Шаблон отчёта (Markdown) заинлайнен; место хранения `plans/<prefix>/diagnose-<NN>.md` (consumer-guide/formats.md — аналог /validate)
- [ ] Презентация компактная: вердикт + путь к отчёту, не дублировать в чат (skills.md: /prepare — презентация)
- [ ] Antipatterns диагностики (diagnose)
- [ ] Interaction mode: no-op слайс в Duality — не блокируется, `inconclusive` уже autonomous-exit (work: Interaction mode)

### `/autopilot` — orchestrate an autonomous run (bespoke Orchestration Mode, procedural)

- [ ] Mode bespoke: «Orchestration Mode — spawn and decide; инвариант тонкости», не один из трёх режимов (work: Modes — краевой случай, как `/prepare`/`/validate`/`/diagnose`)
- [ ] Model-driven скилл, НЕ harness-Workflow; имя `autopilot` (запрет имени «workflow») (index: Контекст)
- [ ] Только на готовом `active`-плане; планирование (`/grill`/`/storyteller`/`/blueprint`) ручное, не входит (index: Контекст)
- [ ] Разрешение плана: `@<path>` / единственный `active` / refuse при неоднозначности (work: invariant 1)
- [ ] Текущий шаг = первый без `[x]`; цикл по этапам до пустого остатка, затем `/finalize` (work: Key invariants)
- [ ] Управляющий цикл: `work→validate→[diagnose→work fix-forward]→step-done`, повтор, `finalize` (index: DoD)
- [ ] Спавн атомарных скиллов субагентами с передачей `@<index-path>`; тип субагента — `general-purpose`, задача — вызвать слэш-команду скилла (скилл ≠ agent type); `/prepare` делегируется внутри `/work`, отдельно не спавнится (work: Delegation)
- [ ] Subagent models: модель задаётся при спавне (скиллы фронтматтерной модели не несут); `work`=Sonnet/Opus-по-тяжести этапа, `validate`=Sonnet, `step-done`/`diagnose`/`finalize`=Opus (autopilot: Subagent models)
- [ ] Ветка work/validate не выбирается оркестратором — живёт в спавнимых скиллах по маркерам `## Стратегия гейта`/`## Режим разработки` (blueprint: Stage gate contract; formats.md; index: DoD)
- [ ] Вердикт `/validate` читается из текста отчёта (`green`/`defect`/`blocked`); green→step-done, blocked→Tier C (validate: Verdict)
- [ ] Вердикт `/diagnose` читается из текста отчёта (`located`/`inconclusive`); located→fix-forward, inconclusive→Tier C (diagnose: Verdict)
- [ ] Стоп-кран — счётчик-строка на каждый non-green проход в `## Журнал проходов` step-файла; решение читается из файла, не из головы (formats.md: Журнал проходов; index: DoD)
- [ ] Порог стоп-крана: 3 прохода без `green` → стоп + эскалация человеку (formats.md: Журнал проходов; index: Решения — стоп-кран)
- [ ] Spawn watchdog: каждый спавн цикла в фоне + дедлайн (по весу шага, err long); резолв — заверш. → вердикт / wakeup + нет отчёта → аборт + timeout-проход + стоп-кран + ре-спавн с чекпоинта; абортный триггер = дедлайн+отсутствие артефакта, не суждение (autopilot: Spawn watchdog)
- [ ] Стоп-кран считает и timeout-проходы watchdog'а, не только дефекты валидации (formats.md: Журнал проходов; autopilot: Stop-brake)
- [ ] Кросс-слойное падение → `diagnose` → fix-forward в текущем этапе; rewind закрытых `[x]` запрещён (index: Решения — кросс-слойное падение)
- [ ] 3-уровневая политика: A решай+лог (в `/work`) / B мок-отложить (судит оркестратор) / C стоп+вопрос (index: Решения — политика «не застрять»)
- [ ] Tier-B судит оркестратор как держатель плана по downstream индекса; задевает закрытый `[x]`/неизвестную зависимость → Tier C (index: Решения)
- [ ] Tier-B артефакт: `## Отложенные решения` в step-файле + маркер в коде; `blocked`/`inconclusive` = уже материализованный Tier C (formats.md: Отложенные решения; index: Решения)
- [ ] Оркестрационная тонкость: оркестратор читает только индекс/step/отчёты/возвраты, пишет только Журнал проходов/Отложенные решения/отчёт; тяжёлый рендер/прогон/чтение кода — в субагентах (index: DoD — тонкость)
- [ ] Финальный отчёт `plans/<prefix>/autopilot-report.md`: итог + прогон по этапам + Tier-B отложенные + Tier-C эскалации + счётчики; пишется на любом завершении (finalize / Tier-C / стоп-кран), молча терять нельзя (index: DoD; index: Открытые вопросы — структура отчёта)
- [ ] Run mode: walk-away дефолт / attended по позиционному слову `attended` (`/autopilot attended`, ⊥ `@<index>`); видимая строка объявления режима до цикла (autopilot: Run mode; index apl-08 DoD)
- [ ] Субагенты всегда autonomous по каналу — attended живёт только на оркестраторе (держателе канала к человеку); спавн передаёт только `@<index>`, контракт едет с каналом (work: Interaction mode; index apl-08)
- [ ] Mode-gated 3-уровневая политика: walk-away → полная A/B/C; attended → Tier A сам, всё за ним → сразу стоп+вопрос человеку (без Tier-B-мока/поиска приемлемого дефолта) (autopilot: Run mode / Three-tier; index apl-08 DoD)
- [ ] Канал эскалации walk-away Tier-C: запись вопроса в `## Эскалации` отчёта → уведомление хоста (нет механизма → деградация в чистый стоп) → останов прогона (autopilot: Run mode; index apl-08 DoD)
- [ ] Бесплатный resume: повторный вызов стартует с первого этапа без `[x]` по чекбоксам; спец-паузы/resume-маркера нет (autopilot: Run mode; index apl-08 DoD)
- [ ] Antipatterns оркестрации, incl. run-режим (attended-блокировка субагента / Tier-search под attended / выдуманный resume-маркер) и watchdog (foreground без дедлайна / аборт по суждению / ре-спавн без timeout-прохода) (autopilot)
