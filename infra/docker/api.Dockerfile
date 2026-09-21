# syntax=docker/dockerfile:1.7
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
# pnpm deploy omits gitignored paths (dist/), so copy the build output explicitly.
RUN pnpm --filter @beauty/api... build \
  && pnpm deploy --filter=@beauty/api --prod /out \
  && cp -a apps/api/dist /out/dist \
  && test -f /out/dist/main.js

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S beauty && adduser -S beauty -G beauty
COPY --from=build --chown=beauty:beauty /out ./
USER beauty
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/main.js"]
