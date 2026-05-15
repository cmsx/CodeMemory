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

# MCP-клиент поднимает сервер по stdio.
ENTRYPOINT ["node", "dist/mcp/server.js"]
