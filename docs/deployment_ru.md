# Beauty+ — продакшен-деплой

Развёртывание Beauty+ на **трёх ВМ Ubuntu 24.04**, связанных WireGuard, с образами из GHCR и Traefik TLS на `beauty.loomixx.ru` / `beautyadm.loomixx.ru`.

## Топология

| ВМ        | WireGuard  | Публичный доступ            | Что крутится                                                               |
| --------- | ---------- | --------------------------- | -------------------------------------------------------------------------- |
| `app-vm`  | `10.8.0.1` | да — `beauty.loomixx.ru`    | Traefik, miniapp, widget, api-miniapp, worker, Centrifugo                  |
| `data-vm` | `10.8.0.2` | **без публичного IP**       | PostgreSQL 17 + PostGIS + pgvector, Redis cache, Redis queues, backup-job  |
| `adm-vm`  | `10.8.0.3` | да — `beautyadm.loomixx.ru` | Traefik + IP allowlist, admin-web, api-internal, Prometheus, Grafana, Loki |

Медиа и архивы бэкапов хранятся в S3-совместимом Object Storage (Yandex / VK Cloud / MinIO).

```
Internet → beauty.loomixx.ru (app-vm Traefik)
         → beautyadm.loomixx.ru (adm-vm Traefik + IP allowlist)
app-vm / adm-vm ──WireGuard──→ data-vm:5432 / :6379 / :6380
```

## Размеры ВМ

### Тест / staging

| ВМ      | vCPU             | RAM  | Диск       |
| ------- | ---------------- | ---- | ---------- |
| app-vm  | 2 (burstable OK) | 4 GB | 40 GB SSD  |
| data-vm | 2                | 4 GB | 50 GB NVMe |
| adm-vm  | 2                | 4 GB | 40 GB SSD  |

### Старт продакшена

| ВМ      | vCPU                              | RAM   | Диск        |
| ------- | --------------------------------- | ----- | ----------- |
| app-vm  | 4 (гарантированные, не burstable) | 8 GB  | 80 GB SSD   |
| data-vm | 4                                 | 16 GB | 200 GB NVMe |
| adm-vm  | 2–4                               | 8 GB  | 150 GB SSD  |

На каждом хосте добавьте 2 GB swap. Предпочитайте регионы РФ для 152-ФЗ.

## DNS

| Запись                 | Тип | Значение              |
| ---------------------- | --- | --------------------- |
| `beauty.loomixx.ru`    | A   | публичный IPv4 app-vm |
| `beautyadm.loomixx.ru` | A   | публичный IPv4 adm-vm |

Публичного DNS для data-vm нет. Опционально AAAA, если включаете IPv6.

## Домашний лаб (Proxmox, один публичный IP)

Отличия от облачной топологии, если все три ВМ живут на домашнем гипервизоре за одним белым IP.

| ВМ     | LAN             | WireGuard  | Роль    |
| ------ | --------------- | ---------- | ------- |
| `bapp` | `192.168.0.166` | `10.8.0.1` | app-vm  |
| `bdb`  | `192.168.0.167` | `10.8.0.2` | data-vm |
| `badm` | `192.168.0.168` | `10.8.0.3` | adm-vm  |

На роутере 80/443 остаются проброшены на уже существующий фронт `192.168.0.51`; он разводит трафик по имени домена, поэтому Traefik на обеих ВМ по-прежнему сам выпускает сертификаты Let's Encrypt.

HTTPS — `stream` + SNI (`/etc/nginx/stream.d/sni-beauty.conf`), старые `listen 443 ssl` на `.51` переводятся на `127.0.0.1:8443`:

```nginx
map $ssl_preread_server_name $https_backend {
  beauty.loomixx.ru     192.168.0.166:443;
  beautyadm.loomixx.ru  192.168.0.168:443;
  default               127.0.0.1:8443;
}

server {
  listen 443;
  listen [::]:443;
  proxy_pass $https_backend;
  ssl_preread on;
  proxy_connect_timeout 5s;
  proxy_timeout 600s;
}
```

HTTP (80) — обычный `proxy_pass` по `Host` на `192.168.0.166:80` / `192.168.0.168:80`, чтобы проходил ACME HTTP-01.

Прочие отличия домашнего стенда:

- Traefik работает только с **file-провайдером** (`infra/traefik/routers-app.yml`, `routers-admin.yml`), без `docker.sock`: Docker Engine 29 больше не отдаёт API 1.24, и docker-провайдер падает с ошибкой версии. Пустой файл-роутер без секции `http` тоже валит Traefik — такие файлы удаляйте, а не оставляйте заготовкой.
- Redis на data-vm слушает адрес WireGuard, поэтому в конфиге нужен `protected-mode no` — иначе клиенты получают `DENIED Redis is running in protected mode`.
- `.env.data` лежит только на data-vm, `.env.app` — на app-vm, `.env.admin` — на adm-vm. Команды `docker compose --env-file .env.data` с других ВМ падают с `couldn't find env file`.
- Порты `5432`, `6379`, `6380`, Proxmox и Grafana наружу не пробрасываются никогда.

## Предварительные требования (все ВМ)

```bash
# от root
apt update && apt upgrade -y
apt install -y curl ca-certificates gnupg ufw fail2ban unattended-upgrades wireguard

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy   # ваш deploy-пользователь

# Ужесточение
ufw default deny incoming
ufw default allow outgoing
# только app-vm / adm-vm:
ufw allow 80/tcp
ufw allow 443/tcp
# SSH только с bastion / частной сети — подстройте:
ufw allow from 10.8.0.0/24 to any port 22
ufw enable

systemctl enable --now fail2ban
dpkg-reconfigure -plow unattended-upgrades
```

Отключите SSH по паролю (`PasswordAuthentication no`). Используйте только deploy-ключи.

## Mesh WireGuard

Сгенерируйте ключи на каждом хосте (`wg genkey | tee privatekey | wg pubkey > publickey`).

Шаблоны: `infra/wireguard/wg0.conf.example`, `wg0.data.conf.example`, `wg0.adm.conf.example`.

Ожидаемый вид:

```
[Interface]
Address = 10.8.0.X/24
PrivateKey = <этот-хост>
ListenPort = 51820

[Peer]  # каждый из двух остальных
PublicKey = <пир>
AllowedIPs = 10.8.0.Y/32
Endpoint = <публичный-или-приватный-ip-пира>:51820
PersistentKeepalive = 25
```

На data-vm **не** открывайте 51820 в интернет, если пиры достучатся через частную сеть облака; иначе ограничьте исходные IP через ufw.

Проверка: `ping 10.8.0.1` / `.2` / `.3` с каждой ноды. Алерт, если возраст handshake > 3 минут (Prometheus).

## Секреты

Никогда не коммитьте файлы `.env`. Скопируйте примеры и заполните:

```bash
# на каждой ВМ в /opt/beauty/
cp infra/compose/.env.app.example  .env.app     # app-vm
cp infra/compose/.env.data.example .env.data    # data-vm
cp infra/compose/.env.admin.example .env.admin  # adm-vm
chmod 600 .env.*
```

Минимальный набор секретов:

- `POSTGRES_PASSWORD`, плюс пароли, выставленные ролям `beauty_api_miniapp`, `beauty_api_internal`, `beauty_worker`
- `JWT_ACCESS_PRIVATE_KEY` / `JWT_ACCESS_PUBLIC_KEY` (Ed25519 PEM)
- `STAFF_JWT_SECRET` (≥32 символа)
- `TOTP_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY` (по 32 байта в base64)
- `TELEGRAM_BOT_TOKEN` (и `MAX_BOT_TOKEN` при включении MAX)
- `YOOKASSA_*` при включённых платежах, включая `YOOKASSA_WEBHOOK_SECRET` — без него все вебхуки отклоняются
- `S3_*` для медиа и бэкапов
- `CENTRIFUGO_API_KEY` / `CENTRIFUGO_TOKEN_SECRET` (и зеркальный `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` для контейнера Centrifugo)
- `METRICS_TOKEN`, `BACKUP_TRIGGER_TOKEN`, `RESTART_TRIGGER_TOKEN`
- `ACME_EMAIL`, `ADMIN_ALLOWLIST_SOURCE_RANGE` (CIDR через запятую для beautyadm)

Генерация ключей:

```bash
openssl genpkey -algorithm ed25519 -out jwt.pem
openssl pkey -in jwt.pem -pubout -out jwt.pub
openssl rand -base64 32   # STAFF_JWT_SECRET
openssl rand -base64 32   # TOTP_ENCRYPTION_KEY
openssl rand -base64 32   # PII_ENCRYPTION_KEY
```

Имена переменных должны совпадать с `packages/config/src/index.ts`: API валидирует окружение через Zod на старте и падает со списком проблем, если чего-то не хватает.

Деплой-воркфлоу **отказываются работать**, если на хосте нет `.env.app`, `.env.data` или `.env.admin`. Они никогда не копируют `.example` на место реального файла — поднять продакшен с плейсхолдерами хуже, чем упавший деплой.

GitHub Environments (`production-data`, `production-app`, `production-admin`) хранят SSH-ключи и `GHCR_TOKEN`. Для шифрования env на диске сервера предпочтителен SOPS/age.

### Пароли ролей БД

Миграция `0002_least_privilege_roles.sql` создаёт роли без паролей. Выставьте их один раз на data-vm и укажите каждому сервису свою роль в `DATABASE_URL`:

```bash
docker compose -f infra/compose/docker-compose.data.yml --env-file infra/compose/.env.data \
  exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "ALTER ROLE beauty_api_miniapp  WITH PASSWORD '...';
   ALTER ROLE beauty_api_internal WITH PASSWORD '...';
   ALTER ROLE beauty_worker       WITH PASSWORD '...';"
```

Миграции выполняет только суперпользователь `POSTGRES_USER` — это `beauty_admin` (имя БД остаётся `beauty`). Рантайм-роли имеют лишь права DML, поэтому скомпрометированный контейнер API не может менять схему.

Ручные запросы к БД с data-vm идут от того же суперпользователя:

```bash
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data \
  exec -T postgres psql -U beauty_admin -d beauty -tAc 'select 1'
```

## Порядок первого бутстрапа

**Всегда:** data → migrate → app → admin.

### 1. data-vm

```bash
cd /opt/beauty
git clone git@github.com:<org>/beauty.git .
# или синхронизируйте только compose + infra
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data up -d
# дождитесь healthy у postgres
docker compose -f infra/compose/docker-compose.data.yml ps
```

Убедитесь, что Postgres слушает только `10.8.0.2:5432` (не `0.0.0.0`). То же для Redis `6379` (cache) и `6380` (queues).

### 2. Migrate + seed

Запустите `migrate.yml`: он сначала делает бэкап, затем применяет версионированные миграции из `packages/db/drizzle` и проверяет, что констрейнт против двойного бронирования на месте. Ручной эквивалент с хоста в сети WireGuard:

```bash
export DATABASE_URL='postgresql://beauty_admin:...@10.8.0.2:5432/beauty'
pnpm install --frozen-lockfile
pnpm db:migrate   # drizzle-мигратор, порядок из журнала
pnpm db:seed      # permissions, roles, тарифы, категории, демо-город
```

Миграции — это обычные отревьюенные SQL-файлы. `drizzle-kit push` против развёрнутой БД не используется никогда: он диффит живую схему и может удалить колонки без ревью. На самом первом бутстрапе передайте `skip_backup: true`, дальше бэкап обязателен.

### 3. app-vm

```bash
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app pull
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app up -d
curl -fsS https://beauty.loomixx.ru/healthz
```

Traefik получает сертификаты Let's Encrypt через HTTP-01. Перед первым стартом порты 80/443 должны быть открыты.

### 4. adm-vm

```bash
# Сначала отрендерьте IP-allowlist для Traefik из ADMIN_ALLOWLIST_SOURCE_RANGE —
# file-провайдер Traefik не подставляет переменные окружения.
infra/traefik/render-allowlist.sh infra/compose/.env.admin

docker compose -f infra/compose/docker-compose.admin.yml --env-file .env.admin pull
docker compose -f infra/compose/docker-compose.admin.yml --env-file .env.admin up -d
# с IP из allowlist:
curl -fsS https://beautyadm.loomixx.ru/healthz
```

Admin API запускается с `API_CONTOUR=internal` — это поднимает `InternalModule` и глобально навешивает `StaffAuthGuard` и `PermissionsGuard`. Если переменную потерять, контейнер отдал бы mini-app API на staff-хосте, поэтому compose задаёт её явно.

Первого staff-админа создайте после seed: вставьте строку в `staff_users` с Argon2id-хэшем и привяжите роль `admin` через `staff_user_roles`.

TOTP для него нужно завести вручную. `POST /api/v1/staff/users/:id/totp-reset` требует permission `staff.manage`, то есть уже активной staff-сессии, а `loginStep1` отбивает вход с `TOTP_REQUIRED_SETUP`, пока `staff_users.totp_enabled = false` — поэтому первый секрет создаётся в обход API:

```bash
# 1. adm-vm: сгенерировать секрет и зашифровать его тем же TOTP_ENCRYPTION_KEY, что у API
docker compose -f infra/compose/docker-compose.admin.yml --env-file .env.admin exec -T admin-api \
  node -e "
const { authenticator } = require('otplib');
const { createCipheriv, randomBytes } = require('crypto');
const email = process.argv[1];
const secret = authenticator.generateSecret();
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.TOTP_ENCRYPTION_KEY, 'base64'), iv);
const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
const enc = ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
console.log(JSON.stringify({ otpauth: authenticator.keyuri(email, 'Beauty+', secret), enc }, null, 2));
" staff@example.com
```

Формат конверта (`v1.<iv>.<tag>.<ciphertext>`, base64url, AES-256-GCM) задан в `apps/api/src/common/guards/staff-auth.guard.ts` — секрет, записанный в другом виде, API не расшифрует.

```bash
# 2. data-vm: сохранить секрет и включить TOTP
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data exec -T postgres \
  psql -U beauty_admin -d beauty -v enc="'<enc>'" -v email="'staff@example.com'" <<'SQL'
INSERT INTO staff_totp_secrets (staff_user_id, secret_encrypted, verified_at)
SELECT id, :enc, now() FROM staff_users WHERE email = :email
ON CONFLICT (staff_user_id) DO UPDATE
  SET secret_encrypted = EXCLUDED.secret_encrypted, verified_at = now();

UPDATE staff_users SET totp_enabled = true, updated_at = now() WHERE email = :email;
SQL
```

`otpauth://`-ссылку добавьте в приложение-аутентификатор и войдите обычным путём. Дальше сброс TOTP сотрудникам делается уже из UI через `totp-reset`.

## Карта маршрутизации

### beauty.loomixx.ru

| Путь           | Бэкенд              |
| -------------- | ------------------- |
| `/`            | miniapp SPA (nginx) |
| `/api/v1/*`    | api-miniapp         |
| `/rt/*`        | Centrifugo          |
| `/widget/v1/*` | widget bundle       |

### beautyadm.loomixx.ru

| Путь        | Бэкенд        |
| ----------- | ------------- |
| `/`         | admin-web SPA |
| `/api/v1/*` | api-internal  |

Auth staff и mini-app никогда не делят cookies, JWT-ключи и таблицы пользователей.

## CI/CD (GitHub Actions)

| Воркфлоу                | Назначение                                           |
| ----------------------- | ---------------------------------------------------- |
| `ci.yml`                | typecheck, lint, test, audit, gitleaks               |
| `build-push.yml`        | buildx → `ghcr.io/<owner>/beauty-*`                  |
| `deploy-data.yml`       | редко; требует подтверждения свежего бэкапа          |
| `migrate.yml`           | pre-backup, затем Drizzle migrate                    |
| `deploy-app.yml`        | pull + up на app-vm, health check, rollback при сбое |
| `deploy-admin.yml`      | то же для adm-vm                                     |
| `deploy-production.yml` | оркестрирует data → migrate → app → admin            |

Настройте GitHub Environments с обязательными ревьюерами для продакшен-деплоев и добавьте `GHCR_TOKEN` (PAT с `read:packages`), чтобы хосты могли тянуть приватные образы.

## Smoke-тесты

```bash
# Mini-app API
curl -fsS https://beauty.loomixx.ru/healthz
curl -fsS https://beauty.loomixx.ru/readyz

# Ассет виджета
curl -fsSI https://beauty.loomixx.ru/widget/v1/widget.js | head

# Admin (с IP из allowlist)
curl -fsS https://beautyadm.loomixx.ru/healthz

# БД с app-vm
psql "postgres://beauty_api_miniapp:...@10.8.0.2:5432/beauty" -c 'select 1'

# Redis
redis-cli -h 10.8.0.2 -p 6379 ping
redis-cli -h 10.8.0.2 -p 6380 ping
```

Откройте URL Telegram Mini App на `https://beauty.loomixx.ru` и пройдите login по initData. Staff: login → TOTP → Chat.

## Бэкапы и восстановление

Бэкапы — это сжатые архивы `pg_dump`, которые `infra/backup/backup.sh` выгружает в S3; скрипт запускается по cron внутри сервиса `backup` на data-vm.

```bash
# ручной бэкап
docker compose -f infra/compose/docker-compose.data.yml --env-file infra/compose/.env.data \
  run --rm backup /backup/backup.sh

# возраст свежайшего бэкапа в секундах (используется как гейт в deploy-data)
infra/backup/backup.sh --latest-age

# учение по restore (никогда против продакшена)
./infra/backup/restore.sh <имя-архива>
```

Admin UI запускает бэкапы через `BACKUP_TRIGGER_URL` с bearer-токеном, поэтому admin API никогда не получает shell на data-хосте. Перезапуски работают так же через `RESTART_TRIGGER_URL`; если хук не настроен, ops-джоба помечается как **failed**, а не рапортует об успехе, которого не было.

Также включите ежедневные cloud disk snapshots data-vm — они дополняют дампы, а не заменяют их.

## Rollback

Deploy-воркфлоу сохраняют предыдущий SHA образа. При падении `/healthz`:

```bash
export IMAGE_TAG=<previous-sha>
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app up -d
```

При плохой миграции: восстановите из pre-migrate бэкапа, затем задеплойте предыдущие теги app. Предпочитайте миграции expand/contract.

## Локальная разработка

```bash
pnpm install
cp infra/compose/.env.dev.example infra/compose/.env.dev
docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env.dev up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Однохостовый compose поднимает Postgres и оба Redis локально; от продакшена отличаются только connection strings (`packages/config`).

## Триггеры апгрейда

- API p95 > 300 ms
- Устойчивый CPU app-vm > 60%
- Postgres cache hit ratio < 0.98
- Глубина BullMQ не успевает опустошаться между пиками
- Свободный диск data-vm < 30%

Типичный первый апгрейд: RAM data-vm 16 → 32 GB. Второй: отдельная worker-ВМ.

## Troubleshooting

| Симптом                   | Проверить                                                    |
| ------------------------- | ------------------------------------------------------------ |
| Не выдаётся LE-сертификат | Доступен порт 80; задан ACME email; корректна A-запись DNS   |
| Admin 403 из браузера     | Ваш IP не в `ADMIN_IP_ALLOWLIST`                             |
| API не достучится до БД   | `wg show`; `pg_hba.conf`; пароли; флаги SSL                  |
| Пропали напоминания       | Jobs идут в Redis **6380** (`noeviction`), не в cache        |
| Двойные записи            | Применена exclusion SQL-миграция (`appointments_no_overlap`) |
| Устаревший WireGuard      | handshake в `wg show`; firewall на 51820                     |

См. также [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [RUNBOOK-OPS.md](RUNBOOK-OPS.md).
