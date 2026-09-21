---
description: Beauty+ admin/support web architecture, RBAC, security and optimization
alwaysApply: true
---

# Beauty+ — Stack Admin (Admin + Support Web)

## Product

Отдельный **веб-сайт** (свой домен) для сотрудников компании. **Не** Telegram/MAX mini-app.
Внутри сайта роли определяют UI и API-доступ:

| Capability                                        | `support` | `admin` |
| ------------------------------------------------- | :-------: | :-----: |
| Real-time чат поддержки с мастерами               |    ✅     |   ✅    |
| Просмотр аккаунтов (клиенты и мастера)            |    ✅     |   ✅    |
| Ручное создание/редактирование аккаунтов          |    ✅     |   ✅    |
| Связанные данные аккаунта (записи, отзывы и т.п.) |    ✅     |   ✅    |
| Мониторинг сервера (нагрузка, метрики)            |    ❌     |   ✅    |
| Переключатели фич / управление тарифами           |    ❌     |   ✅    |
| Перезапуск билда / БД                             |    ❌     |   ✅    |
| Авто- и ручной бэкап БД                           |    ❌     |   ✅    |
| Управление staff-пользователями                   |    ❌     |   ✅    |
| Аудит-логи                                        |    ❌     |   ✅    |

Роли `admin` / `support` **запрещены** в mini-app (`stack_app.md`).

## Architecture

- Отдельное приложение в монорепо: `apps/admin-web`.
- Отдельный API-контур: NestJS `InternalModule` (`API_CONTOUR=internal`) со своим `StaffAuthGuard` + `PermissionsGuard`.
- Path-based routing на том же staff-хосте (без отдельного `internal-api.*`):
  - `beauty.loomixx.ru/api/v1` — mini-app (см. `stack_app.md`)
  - `beautyadm.loomixx.ru/api/v1` — staff (admin/support)
- Общая PostgreSQL на **data-vm** (`10.8.0.2`), доступ только по WireGuard; **отдельные таблицы** staff и mini-app users. Admin API подключается ролью `beauty_api_internal`, миграции — суперпользователем `beauty_admin`.
- Real-time чат поддержки: **Centrifugo** на app-vm (`/rt`); каналы staff ↔ master.
- Три VM: app / data / adm — см. `docs/DEPLOYMENT.md`.

### Auth (только staff)

- Email + пароль + **обязательный 2FA (TOTP)**.
- Собственные JWT/сессии (httpOnly cookie), пул токенов **независим** от mini-app JWT.
- Нет входа через Telegram/MAX для сотрудников.
- `staff_users.totp_enabled = false` блокирует вход ещё на шаге пароля (`TOTP_REQUIRED_SETUP`), а `totp-reset` требует permission `staff.manage`. Поэтому первому админу секрет заводят вручную — процедура в `docs/DEPLOYMENT.md`.
- Секреты TOTP лежат в `staff_totp_secrets` в конверте `v1.<iv>.<tag>.<ciphertext>` (AES-256-GCM, ключ `TOTP_ENCRYPTION_KEY`); формат менять только вместе с миграцией существующих строк.

### RBAC model

Permission-based (не жёсткий хардкод ролей в коде):

- Таблицы: `staff_users`, `roles`, `permissions`, `role_permissions`, `staff_user_roles`.
- Роль = именованный набор permissions.
- Эндпоинты: `@RequirePermission('accounts.edit')`, `@RequirePermission('features.toggle')`, `@RequirePermission('ops.restart')` и т.д.
- UI скрывает недоступные разделы **для UX**; безопасность — только серверные guards.

Примеры permissions:

- `chat.read` / `chat.write`
- `accounts.read` / `accounts.write`
- `features.toggle` / `tariffs.manage`
- `ops.metrics` / `ops.restart` / `ops.backup`
- `staff.manage` / `audit.read`

## Stack

### Frontend (`apps/admin-web`)

| Area           | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Framework      | React 19 + TypeScript + Vite                             |
| Admin CRUD     | Refine или React-Admin                                   |
| Styles         | Tailwind + дизайн-система (может отличаться от mini-app) |
| Server state   | TanStack Query                                           |
| Forms          | React Hook Form + Zod                                    |
| Chat UI        | собственный клиент поверх Centrifugo                     |
| Charts/metrics | Recharts / Grafana embed (для мониторинга)               |

Навигация по роли:

- **Support:** Чат | Аккаунты (пользователи/мастера) | связанные CRUD-разделы.
- **Admin:** всё Support + Мониторинг | Фичи/тарифы | Бэкапы/операции | Staff | Аудит.

### Backend (admin-api)

| Area       | Choice                                                      |
| ---------- | ----------------------------------------------------------- |
| Framework  | NestJS module / gateway (изолированный от MiniAppAuthGuard) |
| ORM        | тот же Drizzle/Prisma, отдельные сущности staff             |
| Validation | Zod                                                         |
| Real-time  | Centrifugo (server API для выдачи токенов каналов)          |
| Ops        | защищённые эндпоинты перезапуска/бэкапа с audit + confirm   |

### Data (staff-specific)

- `staff_users` — отдельно от `users` / `masters` мини-аппа.
- `audit_logs` — кто / что / когда / над каким объектом (обязательно для правок аккаунтов и всех ops).
- Entitlements/тарифы — пишет только admin; читает и mini-app API (runtime feature checks).

## Security (admin)

- **Жёсткая изоляция** от mini-app auth: другие guards, другие cookie/JWT, другие таблицы.
- Обязательный **2FA (TOTP)** для всех staff.
- **IP-allowlist / VPN** для `internal-api` и admin-web (панель не должна быть открыта всему интернету без ограничений).
- Более строгий session timeout и rate limiting, чем у mini-app.
- Опасные ops (restart build/DB, restore backup):
  - отдельный permission;
  - подтверждение в UI;
  - запись в `audit_logs`;
  - по возможности dry-run / статус-джоба, не «fire-and-forget» без ответа.
- CORS только на домен admin-web.
- Секреты ops (deploy tokens, DB credentials) — только на сервере, не в браузере.
- Support не должен получать даже «скрытые» admin-эндпоинты: любой запрос без permission → 403.
- Соответствие 152-ФЗ при доступе staff к PII аккаунтов; минимизация полей в UI саппорта.

## Optimization

### Client

- Ленивая загрузка тяжёлых admin-разделов (метрики, аудит).
- Чат: инкрементальная подгрузка истории, подписки только на активный диалог.
- Аккаунты: серверная пагинация/поиск, без выгрузки всей таблицы в браузер.

### Server

- Права резолвить один раз за запрос (кэш permissions staff-user в Redis с коротким TTL).
- Метрики мониторинга — проксирование/агрегация из Prometheus API, не прямой доступ браузера к Prometheus без auth.
- Бэкапы — асинхронные джобы; UI показывает статус, не блокирует HTTP.
- Индексы на `audit_logs` (actor, action, entity, created_at).

## Infra hooks (admin-only)

- Мониторинг: Prometheus + Grafana на **adm-vm**; scrape exporters на всех трёх VM через WireGuard; браузер ходит только в защищённый `/ops/metrics` API.
- Бэкапы: pgBackRest на **data-vm** → S3; авто по расписанию + ручной триггер из admin UI через `BACKUP_TRIGGER_URL` (без shell-доступа admin API к data-vm).
- Перезапуск билда/БД: ops jobs (`ops_jobs`) с confirm, dry-run, audit, polling статуса; permission `ops.restart` / `ops.backup`.
- Traefik на beautyadm: IP-allowlist middleware + LE TLS.
- Observability admin-web: отдельный Sentry-проект / теги `service=admin-web`.
- Документация: `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, `docs/RUNBOOK-OPS.md`.

## Do / Don't

- ✅ Permission-based RBAC; роль — только набор permissions.
- ✅ Писать audit на каждое изменение аккаунта и каждую ops-операцию.
- ✅ Держать admin-web и mini-app как разные приложения и auth-контуры.
- ❌ Не пускать staff через Telegram/MAX `initData`.
- ❌ Не полагаться на скрытие пунктов меню как на защиту.
- ❌ Не отдавать support доступ к feature toggles, метрикам сервера, restart/backup.
- ❌ Не хранить staff-пользователей в таблице mini-app `users`.
