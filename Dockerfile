# syntax=docker/dockerfile:1
# Targets: "deps" (modo dev, ver docker-compose.yml: el código se monta como volumen) y, para producción
# (docker-compose.prod.yml), "api" (Express) y "web" (frontend compilado + nginx).

ARG NODE_VERSION=22

# ---------- dependencias (compartidas) ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml ./
# pnpm 11 no ejecuta scripts de instalación sin aprobarlos; esbuild (usado por vite y tsx) necesita el suyo
RUN printf "allowBuilds:\n  esbuild: true\n" > pnpm-workspace.yaml
ENV npm_config_dangerously_allow_all_builds=true
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---------- compila el frontend ----------
FROM deps AS build
COPY . .
RUN pnpm build

# ---------- API (Express + Postgres/Supabase) ----------
FROM deps AS api
ENV NODE_ENV=production PORT=3001
COPY src ./src
COPY tsconfig*.json ./
EXPOSE 3001
USER node
CMD ["pnpm", "api:start"]

# ---------- web: estáticos + proxy de /api hacia la API ----------
FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
