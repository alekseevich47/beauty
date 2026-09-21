# Beauty+ — Ops Runbook

## Services cheat sheet

| Service            | Where   | Health                                 |
| ------------------ | ------- | -------------------------------------- |
| api-miniapp        | app-vm  | `https://beauty.loomixx.ru/healthz`    |
| worker             | app-vm  | container health + BullMQ gauges       |
| centrifugo         | app-vm  | `/health` via Traefik `/rt`            |
| postgres           | data-vm | `pg_isready` on `10.8.0.2`             |
| redis-cache        | data-vm | `PING` `:6379`                         |
| redis-queue        | data-vm | `PING` `:6380`                         |
| api-internal       | adm-vm  | `https://beautyadm.loomixx.ru/healthz` |
| prometheus/grafana | adm-vm  | private; via admin Monitoring page     |

## Common procedures

### Trigger backup (admin)

Ops → Backup → confirm → optional dry-run → poll job until `succeeded`. Verify object appears in S3.

### Restore drill (quarterly)

1. Snapshot data-vm disk.
2. Restore latest backup to a disposable Postgres on staging.
3. Run `pnpm db:migrate` no-op check.
4. Record RTO/RPO in the ticket.

### Restart API / worker

Prefer rolling `docker compose up -d` with new tag. Emergency:

```bash
docker compose -f infra/compose/docker-compose.app.yml restart api-miniapp worker
```

Audit every restart via admin Ops (`ops.restart`).

### Refresh materialized views

Worker queue `mv-refresh` runs on schedule. Manual:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_master_revenue_day;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_master_of_week;
```

### Rotate Telegram bot token

1. Issue new token in BotFather.
2. Update `.env.app` / GH Environment.
3. Redeploy api-miniapp + worker.
4. Invalidate Redis `initdata:replay:*` is unnecessary (new signatures).

### Staff lockout

If TOTP device lost: admin with `staff.manage` disables user, resets TOTP secret enrollment, forces password reset. All actions written to `audit_logs`.

## Alerts to page on

- 5xx rate > 2% for 5m
- Postgres connections > 80% of max
- Backup age > 26h
- WireGuard peer handshake age > 3m
- Disk > 80%
- Certificate expiry < 14d
- BullMQ failed jobs spike

## On-call first 15 minutes

1. Check Grafana overview + Loki for the failing service.
2. Confirm WireGuard and data-vm health.
3. If payment webhooks failing — pause provider retries only after verifying idempotency table is healthy.
4. Communicate status; avoid schema changes during an incident.
