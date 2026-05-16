# Развёртывание memory-service

memory-service — постоянный сервис, который живёт в `docker-compose.yml`
целевого проекта рядом с его контейнерами. Один контейнер на проект: свой
`.memory/` и свой `index.db`. MCP-транспорт — HTTP; Claude Code из своего
контейнера обращается к сервису по compose-сети по имени:
`http://memory:8765`.

## 1. Сборка образа

`Dockerfile` лежит в репозитории memory-service. Образ собирается локально из
SSH-клона приватного репозитория либо берётся из приватного Docker-реестра.

При локальной сборке поле `build` reference-блока (ниже) указывает на путь
к клону репозитория сервиса.

## 2. Добавить блок `service` в `docker-compose.yml` целевого проекта

Вставить в `services:` целевого проекта следующий блок. Он коммитится в
проект — память «приезжает» вместе с репозиторием.

```yaml
  memory:
    build: ../code-memory-service   # путь к клону репозитория сервиса
    # или: image: registry.example.com/code-memory-service:latest
    environment:
      CMS_PROJECT_ROOT: /project
      CMS_PORT: 8765
    volumes:
      # репозиторий целиком — read-only
      - .:/project:ro
      # .memory/ — read-write (заметки, index.db, lock-файл)
      - ./.memory:/project/.memory:rw
    ports:
      - "8765:8765"   # только для отладки с хоста; доступ контейнер→контейнер
                      # по имени `memory` публикации порта не требует
    restart: unless-stopped
```

Монтирование: репозиторий целиком — `ro`, поверх — более специфичный
`rw`-mount на `.memory/`. Docker применяет более глубокий bind-mount к своему
подкаталогу, поэтому `.memory/` пишется, а остальной код защищён от записи.

`.memory/*.md` и `entities.md` — в git целевого проекта; `index.db` и lock-файл
— в его `.gitignore` (`index.db` полностью пересобираем).

## 3. Запуск

```sh
docker compose up -d memory
```

Сервис при старте сверяет content hash файлов с индексом и переиндексирует
расхождения (реконсиляция на старте, `specs/08` § Индексация).

## 4. CLI

CLI вызывается внутри работающего контейнера:

```sh
docker compose exec memory cms <команда>
```

Например: `docker compose exec memory cms reindex --all`,
`docker compose exec memory cms stats`.
