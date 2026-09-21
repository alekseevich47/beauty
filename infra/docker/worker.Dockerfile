# syntax=docker/dockerfile:1.7
# Worker shares the @beauty/api package; only the entrypoint differs (dist/worker.js).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @beauty/api...

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter @beauty/api... build && pnpm deploy --filter=@beauty/api --prod /out

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S beauty && adduser -S beauty -G beauty
COPY --from=build --chown=beauty:beauty /out ./
USER beauty
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["node", "dist/worker.js"]
