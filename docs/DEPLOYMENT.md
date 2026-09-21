# Beauty+ — Production Deployment

Deploy Beauty+ across **three Ubuntu 24.04 VMs** linked by WireGuard, with images from GHCR and Traefik TLS on `beauty.loomixx.ru` / `beautyadm.loomixx.ru`.

## Topology

| VM        | WireGuard  | Public                       | Runs                                                                       |
| --------- | ---------- | ---------------------------- | -------------------------------------------------------------------------- |
| `app-vm`  | `10.8.0.1` | yes — `beauty.loomixx.ru`    | Traefik, miniapp, widget, api-miniapp, worker, Centrifugo                  |
| `data-vm` | `10.8.0.2` | **no public IP**             | PostgreSQL 17 + PostGIS + pgvector, Redis cache, Redis queues, backup job  |
| `adm-vm`  | `10.8.0.3` | yes — `beautyadm.loomixx.ru` | Traefik + IP allowlist, admin-web, api-internal, Prometheus, Grafana, Loki |

Media and backup archives live in S3-compatible Object Storage (Yandex / VK Cloud / MinIO).

```
Internet → beauty.loomixx.ru (app-vm Traefik)
         → beautyadm.loomixx.ru (adm-vm Traefik + IP allowlist)
app-vm / adm-vm ──WireGuard──→ data-vm:5432 / :6379 / :6380
```

## VM sizing

### Test / staging

| VM      | vCPU             | RAM  | Disk       |
| ------- | ---------------- | ---- | ---------- |
| app-vm  | 2 (burstable OK) | 4 GB | 40 GB SSD  |
| data-vm | 2                | 4 GB | 50 GB NVMe |
| adm-vm  | 2                | 4 GB | 40 GB SSD  |

### Production start

| VM      | vCPU                          | RAM   | Disk        |
| ------- | ----------------------------- | ----- | ----------- |
| app-vm  | 4 (guaranteed, not burstable) | 8 GB  | 80 GB SSD   |
| data-vm | 4                             | 16 GB | 200 GB NVMe |
| adm-vm  | 2–4                           | 8 GB  | 150 GB SSD  |

Add 2 GB swap on every host. Prefer RF regions for 152-FZ.

## DNS

| Record                 | Type | Value              |
| ---------------------- | ---- | ------------------ |
| `beauty.loomixx.ru`    | A    | app-vm public IPv4 |
| `beautyadm.loomixx.ru` | A    | adm-vm public IPv4 |

No public DNS for data-vm. Optional AAAA if you enable IPv6.

## Home lab (Proxmox, single public IP)

How the setup differs when all three VMs run on a home hypervisor behind one public address.

| VM     | LAN             | WireGuard  | Role    |
| ------ | --------------- | ---------- | ------- |
| `bapp` | `192.168.0.166` | `10.8.0.1` | app-vm  |
| `bdb`  | `192.168.0.167` | `10.8.0.2` | data-vm |
| `badm` | `192.168.0.168` | `10.8.0.3` | adm-vm  |

The router keeps forwarding 80/443 to the pre-existing front end at `192.168.0.51`,
which splits traffic by hostname — so Traefik on both VMs still issues its own
Let's Encrypt certificates.

HTTPS goes through `stream` + SNI (`/etc/nginx/stream.d/sni-beauty.conf`); the older
`listen 443 ssl` servers on `.51` move to `127.0.0.1:8443`:

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

Port 80 is a plain `Host`-based `proxy_pass` to `192.168.0.166:80` / `192.168.0.168:80`
so ACME HTTP-01 still reaches Traefik.

Other home-lab specifics:

- Traefik runs on the **file provider** only (`infra/traefik/routers-app.yml`,
  `routers-admin.yml`), without `docker.sock`: Docker Engine 29 no longer serves API
  1.24 and the docker provider fails on the version check. A router file with no
  `http` section also fails startup — delete such files instead of leaving stubs.
- Redis on data-vm binds the WireGuard address, so its config needs `protected-mode no`;
  otherwise clients get `DENIED Redis is running in protected mode`.
- `.env.data` exists only on data-vm, `.env.app` on app-vm, `.env.admin` on adm-vm.
  Running `docker compose --env-file .env.data` from another VM fails with
  `couldn't find env file`.
- Never forward `5432`, `6379`, `6380`, Proxmox or Grafana to the internet.

## Prerequisites (all VMs)

```bash
# as root
apt update && apt upgrade -y
apt install -y curl ca-certificates gnupg ufw fail2ban unattended-upgrades wireguard

# Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy   # your deploy user

# Hardening
ufw default deny incoming
ufw default allow outgoing
# app-vm / adm-vm only:
ufw allow 80/tcp
ufw allow 443/tcp
# SSH only from bastion / private net — adjust:
ufw allow from 10.8.0.0/24 to any port 22
ufw enable

systemctl enable --now fail2ban
dpkg-reconfigure -plow unattended-upgrades
```

Disable password SSH (`PasswordAuthentication no`). Use deploy keys only.

## WireGuard mesh

Generate keys on each host (`wg genkey | tee privatekey | wg pubkey > publickey`).

Templates: `infra/wireguard/wg0.conf.example`, `wg0.data.conf.example`, `wg0.adm.conf.example`.

Expected:

```
[Interface]
Address = 10.8.0.X/24
PrivateKey = <this-host>
ListenPort = 51820

[Peer]  # each of the other two
PublicKey = <peer>
AllowedIPs = 10.8.0.Y/32
Endpoint = <peer-public-or-private-ip>:51820
PersistentKeepalive = 25
```

On data-vm, do **not** publish 51820 to the open internet if peers can reach it via cloud private network; otherwise restrict source IPs with ufw.

Verify: `ping 10.8.0.1` / `.2` / `.3` from each node. Alert on handshake age > 3 minutes (Prometheus).

## Secrets

Never commit `.env` files. Copy examples and fill:

```bash
# on each VM under /opt/beauty/
cp infra/compose/.env.app.example  .env.app     # app-vm
cp infra/compose/.env.data.example .env.data    # data-vm
cp infra/compose/.env.admin.example .env.admin  # adm-vm
chmod 600 .env.*
```

Minimum secrets:

- `POSTGRES_PASSWORD`, plus passwords set on `beauty_api_miniapp`, `beauty_api_internal`, `beauty_worker` (see below)
- `JWT_ACCESS_PRIVATE_KEY` / `JWT_ACCESS_PUBLIC_KEY` (Ed25519 PEM)
- `STAFF_JWT_SECRET` (at least 32 chars)
- `TOTP_ENCRYPTION_KEY`, `PII_ENCRYPTION_KEY` (32 bytes base64 each)
- `TELEGRAM_BOT_TOKEN` (and `MAX_BOT_TOKEN` when enabling MAX)
- `YOOKASSA_*` when payments are enabled, including `YOOKASSA_WEBHOOK_SECRET` — without it every webhook is rejected
- `S3_*` for media and backups
- `CENTRIFUGO_API_KEY` / `CENTRIFUGO_TOKEN_SECRET` (and the mirrored `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY` for the Centrifugo container)
- `METRICS_TOKEN`, `BACKUP_TRIGGER_TOKEN`, `RESTART_TRIGGER_TOKEN`
- `ACME_EMAIL`, `ADMIN_ALLOWLIST_SOURCE_RANGE` (comma-separated CIDRs for beautyadm)

Generate keys:

```bash
# Ed25519 keypair for mini-app access tokens
openssl genpkey -algorithm ed25519 -out jwt.pem
openssl pkey -in jwt.pem -pubout -out jwt.pub

# Symmetric keys (32 bytes, base64)
openssl rand -base64 32   # STAFF_JWT_SECRET
openssl rand -base64 32   # TOTP_ENCRYPTION_KEY
openssl rand -base64 32   # PII_ENCRYPTION_KEY
```

Variable names must match `packages/config/src/index.ts`. The API validates the whole
environment with Zod at boot and exits with a list of problems if anything is missing,
so a typo shows up immediately as a crash loop rather than a subtle runtime bug.

The deploy workflows **refuse to run** when `.env.app`, `.env.data` or `.env.admin` is
absent on the target host. They never copy the `.example` file into place, because
booting production with placeholder secrets is worse than a failed deploy.

GitHub Environments (`production-data`, `production-app`, `production-admin`) hold SSH keys and `GHCR_TOKEN`. Prefer SOPS/age for encrypting env files at rest on the server.

### Database role passwords

Migration `0002_least_privilege_roles.sql` creates the runtime roles without
passwords. Set them once on data-vm, then point each service's `DATABASE_URL` at its
own role:

```bash
docker compose -f infra/compose/docker-compose.data.yml --env-file infra/compose/.env.data \
  exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "ALTER ROLE beauty_api_miniapp  WITH PASSWORD '...';
   ALTER ROLE beauty_api_internal WITH PASSWORD '...';
   ALTER ROLE beauty_worker       WITH PASSWORD '...';"
```

Only the `POSTGRES_USER` superuser — `beauty_admin`, while the database itself stays
`beauty` — runs migrations; the runtime roles hold DML rights only, so a compromised
API container cannot alter the schema.

Ad-hoc queries from data-vm use the same superuser:

```bash
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data \
  exec -T postgres psql -U beauty_admin -d beauty -tAc 'select 1'
```

## First bootstrap order

**Always:** data → migrate → app → admin.

### 1. data-vm

```bash
cd /opt/beauty
git clone git@github.com:<org>/beauty.git .
# or sync compose + infra only
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data up -d
# wait for healthy postgres
docker compose -f infra/compose/docker-compose.data.yml ps
```

Confirm Postgres listens on `10.8.0.2:5432` only (not `0.0.0.0`). Same for Redis `6379` (cache) and `6380` (queues).

### 2. Migrate + seed

Run `migrate.yml`, which takes a backup first, applies the versioned migrations from
`packages/db/drizzle`, then asserts the double-booking constraint exists. Manual
equivalent from a host on the WireGuard mesh:

```bash
export DATABASE_URL='postgresql://beauty_admin:...@10.8.0.2:5432/beauty'
pnpm install --frozen-lockfile
pnpm db:migrate   # drizzle migrator, journal order
pnpm db:seed      # permissions, roles, tariffs, categories, demo city
```

Migrations are plain reviewed SQL files. `drizzle-kit push` is never used against a
deployed database, because it diffs live schema and can drop columns without review.
On the very first bootstrap pass `skip_backup: true`, since there is nothing to back
up yet; every later run must produce a backup first.

### 3. app-vm

```bash
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app pull
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app up -d
curl -fsS https://beauty.loomixx.ru/healthz
```

Traefik obtains Let's Encrypt certs via HTTP-01. Ensure ports 80/443 are open before first start.

### 4. adm-vm

```bash
# Render the Traefik IP allowlist from ADMIN_ALLOWLIST_SOURCE_RANGE first —
# Traefik's file provider does not expand environment variables.
infra/traefik/render-allowlist.sh infra/compose/.env.admin

docker compose -f infra/compose/docker-compose.admin.yml --env-file .env.admin pull
docker compose -f infra/compose/docker-compose.admin.yml --env-file .env.admin up -d
# from an allowlisted IP:
curl -fsS https://beautyadm.loomixx.ru/healthz
```

The admin API runs with `API_CONTOUR=internal`, which boots `InternalModule` and
applies `StaffAuthGuard` plus `PermissionsGuard` globally. If that variable is ever
lost, the container would serve the mini-app API on the staff host — the compose file
sets it explicitly for that reason.

Create the first staff admin after seeding: insert a `staff_users` row with an
Argon2id hash and attach the `admin` role via `staff_user_roles`.

That account's TOTP has to be provisioned by hand. `POST /api/v1/staff/users/:id/totp-reset`
requires the `staff.manage` permission — hence an existing staff session — while
`loginStep1` rejects the login with `TOTP_REQUIRED_SETUP` as long as
`staff_users.totp_enabled = false`, so the first secret is written outside the API:

```bash
# 1. adm-vm: generate a secret and encrypt it with the API's TOTP_ENCRYPTION_KEY
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

The envelope format (`v1.<iv>.<tag>.<ciphertext>`, base64url, AES-256-GCM) comes from
`apps/api/src/common/guards/staff-auth.guard.ts`; a secret stored any other way will
not decrypt.

```bash
# 2. data-vm: store the secret and enable TOTP
docker compose -f infra/compose/docker-compose.data.yml --env-file .env.data exec -T postgres \
  psql -U beauty_admin -d beauty -v enc="'<enc>'" -v email="'staff@example.com'" <<'SQL'
INSERT INTO staff_totp_secrets (staff_user_id, secret_encrypted, verified_at)
SELECT id, :enc, now() FROM staff_users WHERE email = :email
ON CONFLICT (staff_user_id) DO UPDATE
  SET secret_encrypted = EXCLUDED.secret_encrypted, verified_at = now();

UPDATE staff_users SET totp_enabled = true, updated_at = now() WHERE email = :email;
SQL
```

Add the `otpauth://` URI to an authenticator app and log in normally. From then on
staff TOTP resets go through `totp-reset` in the admin UI.

## Routing map

### beauty.loomixx.ru

| Path           | Backend             |
| -------------- | ------------------- |
| `/`            | miniapp SPA (nginx) |
| `/api/v1/*`    | api-miniapp         |
| `/rt/*`        | Centrifugo          |
| `/widget/v1/*` | widget bundle       |

### beautyadm.loomixx.ru

| Path        | Backend       |
| ----------- | ------------- |
| `/`         | admin-web SPA |
| `/api/v1/*` | api-internal  |

Staff and mini-app auth never share cookies, JWT keys, or user tables.

## CI/CD (GitHub Actions)

| Workflow                | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `ci.yml`                | typecheck, lint, test, audit, gitleaks                 |
| `build-push.yml`        | buildx → `ghcr.io/<owner>/beauty-*`                    |
| `deploy-data.yml`       | rare; requires fresh backup confirmation               |
| `migrate.yml`           | pre-backup then Drizzle migrate                        |
| `deploy-app.yml`        | pull + up on app-vm, health check, rollback on failure |
| `deploy-admin.yml`      | same for adm-vm                                        |
| `deploy-production.yml` | orchestrates data → migrate → app → admin              |

Configure GitHub Environments with required reviewers for production deploys.

## Smoke tests

```bash
# Mini-app API
curl -fsS https://beauty.loomixx.ru/healthz
curl -fsS https://beauty.loomixx.ru/readyz

# Widget asset
curl -fsSI https://beauty.loomixx.ru/widget/v1/widget.js | head

# Admin (from allowlisted IP)
curl -fsS https://beautyadm.loomixx.ru/healthz

# DB from app-vm
psql "postgres://beauty_api_miniapp:...@10.8.0.2:5432/beauty" -c 'select 1'

# Redis
redis-cli -h 10.8.0.2 -p 6379 ping
redis-cli -h 10.8.0.2 -p 6380 ping
```

Open Telegram Mini App URL pointing at `https://beauty.loomixx.ru` and complete initData login. Staff: login → TOTP → Chat.

## Backups & restore

Backups are compressed `pg_dump` archives uploaded to S3 by `infra/backup/backup.sh`,
which runs on a cron schedule inside the `backup` service on data-vm.

```bash
# manual backup
docker compose -f infra/compose/docker-compose.data.yml --env-file infra/compose/.env.data \
  run --rm backup /backup/backup.sh

# age of the newest backup in seconds (used as the deploy-data gate)
infra/backup/backup.sh --latest-age

# restore drill (never against production)
./infra/backup/restore.sh <archive-name>
```

The admin UI triggers backups through `BACKUP_TRIGGER_URL` with a bearer token, so the
admin API never gets a shell on the data host. Restarts work the same way through
`RESTART_TRIGGER_URL`; if that hook is unset, the ops job is recorded as **failed**
rather than reporting a success that never happened.

Also enable daily cloud disk snapshots of data-vm — they complement the dumps, they do
not replace them.

## Rollback

Deploy workflows keep the previous image SHA. On failed `/healthz`:

```bash
export IMAGE_TAG=<previous-sha>
docker compose -f infra/compose/docker-compose.app.yml --env-file .env.app up -d
```

For bad migrations: restore from pre-migrate backup, then redeploy previous app tags. Prefer expand/contract migrations.

## Local development

```bash
pnpm install
cp infra/compose/.env.dev.example infra/compose/.env.dev
docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env.dev up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Single-host compose runs Postgres + both Redis instances locally; only connection strings differ from production (`packages/config`).

## Upgrade triggers

- API p95 > 300 ms
- Sustained app-vm CPU > 60%
- Postgres cache hit ratio < 0.98
- BullMQ depth not draining between peaks
- data-vm free disk < 30%

Typical first upgrade: data-vm RAM 16 → 32 GB. Second: dedicated worker VM.

## Troubleshooting

| Symptom                | Check                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| LE cert fails          | Port 80 reachable; ACME email set; DNS A record correct            |
| Admin 403 from browser | Your IP not in `ADMIN_IP_ALLOWLIST`                                |
| API cannot reach DB    | `wg show`; `pg_hba.conf`; passwords; SSL flags                     |
| Lost reminders         | Confirm jobs use Redis **6380** (`noeviction`), not cache          |
| Double bookings        | Ensure exclusion SQL migration applied (`appointments_no_overlap`) |
| Stale WireGuard        | `wg show` handshake; firewall on 51820                             |

See also [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [RUNBOOK-OPS.md](RUNBOOK-OPS.md).
