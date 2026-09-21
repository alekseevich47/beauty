# Beauty+

Mini-app (Telegram/MAX) + CRM for beauty businesses, with a separate admin/support web.

## Domains

| Host                   | Role                                        |
| ---------------------- | ------------------------------------------- |
| `beauty.loomixx.ru`    | Mini-app SPA, `/api/v1`, widget, Centrifugo |
| `beautyadm.loomixx.ru` | Admin/support SPA + staff API               |

## Quick start (local)

```bash
pnpm install
cp infra/compose/.env.dev.example infra/compose/.env.dev
docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env.dev up -d
pnpm db:migrate && pnpm db:seed
pnpm dev
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the three-VM production topology.
