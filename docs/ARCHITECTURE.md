# Beauty+ — Architecture

## System overview

Beauty+ is a modular monolith in a pnpm + Turborepo monorepo:

| App / package           | Role                                              |
| ----------------------- | ------------------------------------------------- |
| `apps/miniapp`          | Telegram/MAX Mini App (client + master)           |
| `apps/widget`           | Embeddable Web Component                          |
| `apps/admin-web`        | Staff admin + support console                     |
| `apps/api`              | NestJS — contours `miniapp`, `internal`, `worker` |
| `packages/contracts`    | Shared Zod schemas                                |
| `packages/db`           | Drizzle schema, migrate, seed                     |
| `packages/entitlements` | Tariff → feature matrix                           |
| `packages/platform`     | Telegram/MAX adapters + initData HMAC             |
| `packages/config`       | Zod-validated `loadEnv()`                         |
| `packages/ui`           | Shared primitives + motion presets                |

## Contours

```
beauty.loomixx.ru          beautyadm.loomixx.ru
├── SPA miniapp            ├── SPA admin-web
├── /api/v1 → miniapp API  └── /api/v1 → internal API
├── /rt → Centrifugo
└── /widget/v1 → widget.js
```

Isolation is by Traefik routers, Nest modules, guards, cookies/JWT keys, and tables — not by inventing extra API hostnames.

## Data plane (3 VMs)

- **app-vm** — request path + worker + Centrifugo
- **data-vm** — PostgreSQL (PostGIS, pgvector, exclusion constraints) + Redis cache (`allkeys-lru`) + Redis queues (`noeviction` + AOF)
- **adm-vm** — staff UI/API + Prometheus/Grafana/Loki scraping exporters over WireGuard

## Auth model

| Contour  | Mechanism                                                       | Roles                   |
| -------- | --------------------------------------------------------------- | ----------------------- |
| Mini-app | Messenger `initData` HMAC → EdDSA access JWT + rotating refresh | `client`, `master` only |
| Staff    | Email + Argon2id + TOTP → httpOnly session cookie               | permission-based RBAC   |

Tariffs are **entitlements**, not roles. Ultra custom features turn off when the subscription is inactive.

## Domain modules (API)

masters, catalog, booking, schedule, reviews, favorites, feed, analytics, notifications, referrals, broadcasts, billing, features, ai, widget; staff accounts, chat, ops, audit, tariffs.

Booking writes run in a transaction; PostgreSQL `EXCLUDE USING gist` prevents overlapping active appointments per master.

## Jobs

BullMQ on the queue Redis instance: appointment/review reminders, broadcasts, subscription dunning, master-of-the-week, materialized-view refresh.

## Observability

OpenTelemetry + Sentry per service; Prometheus metrics (token-gated); Loki logs via Promtail; Grafana dashboards as code.
