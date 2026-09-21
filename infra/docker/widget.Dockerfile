# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/widget/package.json ./apps/widget/package.json
RUN pnpm install --frozen-lockfile --filter @beauty/widget...

FROM deps AS build
ARG VITE_API_BASE_URL=https://beauty.loomixx.ru/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY apps/widget ./apps/widget
RUN pnpm --filter @beauty/widget... build

FROM nginx:1.27-alpine AS runner
COPY infra/docker/nginx/widget.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/widget/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
