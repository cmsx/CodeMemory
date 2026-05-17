# Code Memory Service

Сервис хранения и поиска знаний о коде для LLM-агентов. Хранит структурированные
заметки — что и **почему** было сделано — привязанные к коду гибкими якорями,
и даёт Claude Code быстро находить нужный контекст, не перечитывая весь код
и документацию.

Полное описание дизайна — в [`specs/`](specs/), начиная с
[`specs/00-overview.md`](specs/00-overview.md). Сценарии использования —
в [`specs/stories/`](specs/stories/).

## Как устроено

- **Source of truth** — markdown-заметки в `.memory/` внутри репозитория проекта
  (лежат в git, читаемые диффы).
- **SQLite-индекс** рядом — производный, полностью пересобираемый, для скорости
  поиска.
- **MCP-сервер** (8 инструментов, транспорт HTTP) — доступ для Claude Code.
- **CLI + TUI** — инспекция базы и операционка.
- Структурный индекс символов кода — через tree-sitter.

## Установка в проект

memory-service — постоянный контейнер в `docker-compose.yml` целевого проекта.
Один контейнер на проект: свой `.memory/`, свой `index.db`. Claude Code из своего
контейнера обращается к нему по compose-сети — `http://memory:8765`.

### 1. Образ

`Dockerfile` лежит в этом репозитории. Образ собирается локально из SSH-клона
приватного репозитория либо берётся из приватного Docker-реестра.

### 2. Блок `service` в `docker-compose.yml` целевого проекта

```yaml
  memory:
    build: ../code-memory-service   # путь к клону репозитория сервиса
    # или: image: registry.example.com/code-memory-service:latest
    environment:
      CMS_PROJECT_ROOT: /project
      CMS_PORT: 8765
    volumes:
      - .:/project:ro                      # репозиторий целиком — read-only
      - ./.memory:/project/.memory:rw      # .memory/ — read-write
    ports:
      - "8765:8765"   # только для отладки с хоста; доступ контейнер→контейнер
                      # по имени `memory` публикации порта не требует
    restart: unless-stopped
```

Репозиторий монтируется целиком `ro`, поверх — более специфичный `rw`-mount
на `.memory/`. Блок коммитится в проект — память «приезжает» вместе с ним.

`.memory/*.md` и `entities.md` — в git целевого проекта; производный индекс
и lock-файл — в его `.gitignore`. SQLite работает в режиме WAL, поэтому рядом
с `index.db` появляются sidecar-файлы `index.db-wal` / `index.db-shm` — их тоже
не коммитят. Добавьте в `.gitignore`:

```gitignore
# code-memory-service — производный индекс и lock
.memory/index.db*
.memory/lock
```

### 3. Запуск

```sh
docker compose up -d memory
```

На старте сервис сверяет content hash файлов с индексом и переиндексирует
расхождения.

## Подключение Claude Code к сервису

Claude Code обращается к сервису по MCP. Добавьте в `.mcp.json` в корне целевого
проекта (файл коммитится — подключение «приезжает» с проектом):

```json
{
  "mcpServers": {
    "code-memory": {
      "type": "http",
      "url": "http://memory:8765/mcp"
    }
  }
}
```

Либо командой:

```sh
claude mcp add --transport http --scope project code-memory http://memory:8765/mcp
```

Claude Code должен быть на той же compose-сети, что и контейнер `memory` —
обращение идёт по имени сервиса.

## Использование

### Скилл

Знание о коде на стороне Claude держат два скилла:

- `.claude/skills/mem/` — основной. **Ambient-часть** подхватывается по
  описанию-триггеру и отвечает за **чтение**: когда звать поиск (перед правкой
  файла, при упоминании доменной сущности). **Capture** вызывается явной
  командой `/mem` и учит, **как** оформлять заметку. Проактивно скилл заметки не
  создаёт.
- `.claude/skills/mem-onboarding/` — команда `/mem-onboarding`: разовый
  пошаговый онбординг существующего проекта.

### MCP-инструменты

Claude получает через MCP восемь инструментов:

| Инструмент | Назначение |
|------------|------------|
| `search` | Поиск заметок по якорям и/или тексту; компактная выдача |
| `get_notes` | Разворот 1..N заметок: тело, карта якорей, блок `[[id]]` |
| `create_note` | Создать заметку |
| `update_note` | Изменить заметку — тело, якоря, статус |
| `rename_anchor` | Обновить URI якоря во всех заметках при рефакторинге |
| `create_entity` | Зарегистрировать доменную сущность |
| `list_entities` | Реестр доменных сущностей — доменная карта |
| `list_symbols_in_file` | Символы файла без чтения файла |

### CLI

Внутри работающего контейнера — `docker compose exec memory cms <команда>`:

| Команда | Назначение |
|---------|------------|
| `reindex [--notes\|--code\|--all]` | Пересобрать производный индекс |
| `verify [note-id]` | Проверить якоря — все или одной заметки |
| `stats` | Статистика индекса |
| `search [query] [--anchor --context --archived --limit]` | Поиск заметок (ранжированный) |
| `note list [--status --entity --anchor]` | Список заметок |
| `note show <id…>` | Показать заметку(и) в виде `get_notes` |
| `note edit <id>` | Открыть заметку в `$EDITOR`, затем reindex |
| `note delete <id>` | Удалить заметку |
| `note create` | Интерактивно создать заметку |
| `entity list` | Список доменных сущностей |
| `entity show <name>` | Показать сущность |
| `entity update <name>` | Изменить описание сущности в `$EDITOR` |
| `entity remove <name>` | Удалить сущность из реестра |

### TUI

`docker compose exec memory cms` без аргументов — интерактивный навигатор по базе:
список заметок, разворот, переходы по `[[id]]` и якорям, поиск.

## Разработка

```sh
npm install
npm run build
npm test
```

Стек и устройство компонентов —
[`specs/08-technical-design.md`](specs/08-technical-design.md).
