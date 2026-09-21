# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
RUN pnpm install --frozen-lockfile --filter @beauty/worker...

FROM deps AS build
COPY apps/worker ./apps/worker
RUN pnpm --filter @beauty/worker... build && pnpm deploy --filter=@beauty/worker --prod /out

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S beauty && adduser -S beauty -G beauty
COPY --from=build --chown=beauty:beauty /out ./
USER beauty
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "process.exit(0)"
CMD ["node", "dist/main.js"]
