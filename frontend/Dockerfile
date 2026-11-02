# Продакшен-образ: сборка frontend и раздача статики через nginx (без root, порт 8080).
#   docker build -t av-tracer ./frontend
#   docker run --rm -p 8080:8080 av-tracer      → http://localhost:8080
# Для разработки используется Dockerfile.dev (docker compose up).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
