# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/miniapp/package.json ./apps/miniapp/package.json
RUN pnpm install --frozen-lockfile --filter @beauty/miniapp...

FROM deps AS build
ARG VITE_API_BASE_URL=https://beauty.loomixx.ru/api/v1
ARG VITE_CENTRIFUGO_URL=wss://beauty.loomixx.ru/connection/websocket
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_CENTRIFUGO_URL=$VITE_CENTRIFUGO_URL
COPY apps/miniapp ./apps/miniapp
RUN pnpm --filter @beauty/miniapp... build

FROM nginx:1.27-alpine AS runner
COPY infra/docker/nginx/miniapp.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/miniapp/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
