---
description: Beauty+ mini-app architecture, stack, security and optimization (Telegram/MAX + CRM)
alwaysApply: true
---

# Beauty+ — Stack App (Mini Apps + CRM)

## Product

Beauty+ — mini-app в Telegram и MAX + CRM для beauty-индустрии.
Роли в mini-app: **только** `client` и `master`. Ролей `admin` / `support` здесь нет — они живут в отдельной веб-платформе (`stack_admin.md`).

Оплата услуг мастеров внутри приложения на старте отсутствует. Оплачивается только подписка мастера (Standard / Premium / Ultra).
Тарифные фичи включаются «тумблерами» через админку (entitlements).

## Architecture

- **Модульный монолит** на старте → выделение сервисов по мере роста.
- **Монорепо:** `pnpm` workspaces + Turborepo (общие типы/Zod-схемы между apps).
- **Домены:** masters, booking, billing (subscriptions), notifications, analytics, reviews, feed, referrals, features.
- **API:** REST + Zod-контракты (`packages/contracts`); OpenAPI для виджета/внешних интеграций.
- **Real-time:** Centrifugo на `beauty.loomixx.ru/rt/*` (поддержка сейчас; чат мастер↔клиент — позже).

### Routing (path-based, без отдельных API-поддоменов)

| Host                   | Paths                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `beauty.loomixx.ru`    | `/` miniapp SPA, `/api/v1/*` mini-app API, `/rt/*` Centrifugo, `/widget/v1/*` widget |
| `beautyadm.loomixx.ru` | staff only — см. `stack_admin.md`                                                    |

Изоляция контуров: отдельные Traefik-роутеры, Nest-модули, guards, JWT/cookie-ключи и таблицы — **не** отдельные публичные API-хосты.

### Apps в монорепо (мини-апп контур)

- `apps/miniapp` — клиент + мастер (одна кодовая база, ролевой рендер UI).
- `apps/widget` — Web Component + Shadow DOM для сторонних сайтов.
- `apps/api` — NestJS; контуры `miniapp` \| `internal` \| `worker` (см. `API_CONTOUR`).
- `packages/*` — config, contracts, db (Drizzle), entitlements, platform, ui.

## Stack

### Frontend (Mini Apps)

| Area         | Choice                                    |
| ------------ | ----------------------------------------- |
| Framework    | React 19 + TypeScript                     |
| Bundler      | Vite (code-splitting, малый бандл)        |
| Telegram     | `@telegram-apps/sdk-react`                |
| MAX          | официальный MAX Mini Apps SDK + адаптер   |
| Styles       | Tailwind CSS + собственная дизайн-система |
| Server state | TanStack Query                            |
| Client state | Zustand                                   |
| Forms        | React Hook Form + Zod                     |
| Charts       | uPlot (выручка; малый бандл)              |
| Carousels    | Embla Carousel                            |
| Motion       | Framer Motion                             |
| i18n         | i18next                                   |

**Обязательно:** абстракция `PlatformProvider` (`AuthProvider`, `NotificationProvider`, `PaymentProvider`) — одна бизнес-логика для Telegram и MAX.

### Backend

| Area       | Choice                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| Runtime    | Node.js + TypeScript                                                                 |
| Framework  | NestJS (модули, DI, guards)                                                          |
| ORM        | Drizzle                                                                              |
| Validation | Zod (сквозная с фронтом)                                                             |
| Jobs       | BullMQ + Redis (напоминания, рассылки, отложенные уведомления)                       |
| Scheduler  | BullMQ repeatable / cron («Мастер недели», авто-бэкапы триггерятся из admin-контура) |

### Data

- **PostgreSQL** — основная БД (CRM-модель), имя базы `beauty`. Суперпользователь миграций — `beauty_admin` (`POSTGRES_USER` в `.env.data`); сервисы ходят под DML-ролями `beauty_api_miniapp`, `beauty_api_internal`, `beauty_worker`.
- **PostGIS** — гео («мастера рядом», город).
- **Redis** — кэш, rate limit, очереди, счётчики.
- **S3-compatible** (Yandex Object Storage / VK Cloud / MinIO) — фото, аватары, баннеры.
- **Поиск:** Postgres FTS на старте → Meilisearch/Typesense при росте (цена, рейтинг, категория).
- **Аналитика выручки:** материализованные представления; при росте — TimescaleDB.
- **AI/векторы:** pgvector.

### Auth (только mini-app)

1. Валидация `initData` (HMAC, constant-time) Telegram / MAX на бэке + freshness + Redis replay protection.
2. JWT: EdDSA access (короткий TTL) + rotating refresh с family/reuse detection (`refresh_tokens`).
3. Роли: `client` | `master` — никогда `admin`/`support`.
4. Тарифы — **entitlements**, не роли: Standard / Premium / Ultra + оверрайды для Ultra-кастом-фич.
5. MAX — за `PlatformAdapter`; включается флагом `MAX_PLATFORM_ENABLED` при наличии токена.

### Payments

- Подписки мастеров: YooKassa / CloudPayments (рекуррент).
- Учитывать ограничения мессенджеров (Telegram Stars для digital goods; MAX payment API).
- Абстракция `PaymentProvider`.

### Feature flags / tariffs

- Source of truth: таблица entitlements по тарифу + per-master overrides (Ultra).
- Проверка: `@RequireFeature('waiting_list')` (guard/decorator).
- Недействительная подписка Ultra → кастомные фичи отключаются автоматически.
- Операционные тумблеры (раскатка/A/B): Unleash self-hosted или свой флаг-сервис (управление — только из admin-web).

### AI

- Мотивационная строка, AI-анализ клиентов (Premium), будущий AI на главной.
- Провайдеры с приоритетом РФ: YandexGPT / GigaChat; обёртка `AiProvider`.
- Кэш ответов в Redis; лимиты по тарифу.

## Security (app)

- HTTPS + HSTS; Helmet; строгий CORS; CSP (особенно для виджета).
- Валидация `initData` обоих мессенджеров; JWT с ротацией refresh.
- Весь ввод через Zod; ORM против SQL-injection; XSS-санитизация.
- Rate limiting (Redis) на auth, платежи, публичный API виджета.
- Секреты вне репо (Doppler / Vault / SOPS).
- PII: шифрование чувствительных полей; 152-ФЗ — хостинг данных в РФ.
- Виджет: изоляция стилей, публичный ключ, жёсткий rate limit, CSP.
- **Не смешивать** staff-auth и mini-app auth. Staff-таблицы/токены — отдельный контур (`stack_admin.md`).

## Optimization

### Client

- Route/component code-splitting; lazy tabs нижней навигации.
- TanStack Query: stale-while-revalidate, prefetch для каталога/записей.
- Оптимизация изображений (WebP/AVIF, размеры под viewport, CDN/S3).
- Виртуализация длинных списков услуг/записей.
- Учитывать ограничения WebView мессенджеров (память, жесты, safe-area).

### Server

- Индексы под фильтры каталога (город, категория, цена, рейтинг).
- Кэш горячих чтений (категории, «Мастер недели», публичный профиль) в Redis.
- Фоновые задачи (напоминания/рассылки) только через очередь, не в request path.
- Пагинация/курсоры для лент и истории записей.
- Материализованные агрегаты для блока выручки (день/неделя/месяц).

## Infra (shared with admin) — 3 VM

- **app-vm** `10.8.0.1` — Traefik, miniapp, widget, api-miniapp, worker, Centrifugo.
- **data-vm** `10.8.0.2` (без публичного IP) — PostgreSQL + PostGIS + pgvector; Redis cache (`allkeys-lru`) и Redis queues (`noeviction`+AOF) **раздельно**; pgBackRest.
- **adm-vm** `10.8.0.3` — admin-web + internal API + Prometheus/Grafana/Loki.
- WireGuard mesh `10.8.0.0/24`; Postgres/Redis только на туннеле.
- Docker Compose per VM; GHCR images; GitHub Actions (порядок: data → migrate → app → admin).
- Хостинг: Yandex Cloud / VK Cloud / Selectel (РФ).
- Observability: Prometheus + Grafana, Loki, Sentry, OpenTelemetry.
- Документация: `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`.

## UI navigation (contract)

### Client bottom nav

1. Записи | **B+** (центр) | Избранное

### Client header

- Beauty+ | колокольчик | аватар → Профиль (записи, избранное, отзывы, настройки, помощь)

### Master bottom nav

1. Лента | Расписание | **B+** (центр, long-press → AI input) | Аватар (профиль) | Ещё

### Master header

- Beauty+ | колокольчик

## Do / Don't

- ✅ Абстрагировать Telegram vs MAX за `PlatformProvider`.
- ✅ Проверять фичи через entitlements/guards, не `if (tariff === 'premium')` по всему коду.
- ✅ Держать OpenAPI актуальным для виджета и внешних интеграций.
- ❌ Не добавлять роли admin/support в mini-app.
- ❌ Не вызывать опасные операционные эндпоинты (restart/backup/flags) из mini-app API.
- ❌ Не класть оплату услуг мастеров в MVP без явного решения продукта.
