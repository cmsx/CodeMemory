FROM node:24

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Корень индексируемого проекта монтируется снаружи (docker-compose):
#   rw на .memory/, ro на остальное.
ENV CMS_PROJECT_ROOT=/project

# Порт MCP-HTTP-сервера. Сервер (шаг 12) читает CMS_PORT с этим дефолтом.
ENV CMS_PORT=8765
EXPOSE 8765

# Долгоживущий сервис: постоянный MCP-HTTP-сервер.
# CLI вызывается отдельно через `docker compose exec memory cms <команда>`.
CMD ["node", "dist/mcp/server.js"]
