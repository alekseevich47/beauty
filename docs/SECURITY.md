# Beauty+ — Security

## Threat model (MVP)

| Threat                            | Mitigation                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forged Telegram/MAX `initData`    | HMAC validation, constant-time compare, freshness window, Redis replay keys, distinct secret prefix per messenger so a token cannot be reused across platforms |
| JWT theft / refresh reuse         | Short-lived EdDSA access tokens; refresh family rotation; reuse revokes the family; role and block state re-read from the DB on every request                  |
| Staff credential stuffing         | Argon2id, mandatory TOTP, per-account lockout after `STAFF_TOTP_MAX_ATTEMPTS`, TOTP code burned for its time step, session timeout                             |
| Staff privilege escalation        | Permission guards on every internal route, permissions re-resolved per request and never trusted from the JWT; UI hiding is UX only                            |
| Payment amount tampering          | The client never sends a price; the server reads the tariff from the DB and re-checks the settled amount against the provider API                              |
| Forged `payment.succeeded`        | Signature required and verification **fails closed**: an unset webhook secret rejects everything, the noop provider rejects everything, status is re-fetched   |
| Unpaid entitlements               | Subscriptions are created only on confirmed payment; `FeatureGuard` requires an unexpired period, so a checkout intent alone grants nothing                    |
| Webhook replay                    | Unique `(provider, event_id)` in `payment_webhook_events`                                                                                                      |
| IDOR on appointments/reviews      | Ownership checks in services; UUID identifiers; no sequential leaks                                                                                            |
| Double booking race               | DB exclusion constraint on `tstzrange` for active statuses; CI asserts the constraint exists                                                                   |
| Admin panel exposure              | Traefik IP allowlist rendered from `ADMIN_ALLOWLIST_SOURCE_RANGE`; separate host; no mini-app cookies                                                          |
| Rate-limit bypass via headers     | Express `trust proxy` plus `req.ip`; Traefik keys on `ipStrategy`, never on a client-supplied `X-Forwarded-For`                                                |
| Widget key abuse on foreign sites | Per-master Origin allowlist (`masters.widget_allowed_origins`), refuses to serve when unset, limits bucketed per publishable key                               |
| SQL / XSS injection               | Drizzle parameterized queries; Zod validation; CSP; sanitization                                                                                               |
| Cache vs queue Redis bleed        | Separate instances; the queue instance runs `noeviction`                                                                                                       |
| Secrets in git                    | `.env` gitignored; GitHub Environments; deploys **fail** when the real env file is absent instead of falling back to the example                               |
| TOTP / PII disclosure from DB     | AES-256-GCM with dedicated `TOTP_ENCRYPTION_KEY` and `PII_ENCRYPTION_KEY`, separate from session signing keys                                                  |
| Destructive schema change         | Versioned migrations only (no `drizzle-kit push`), pre-migration backup, CI drift check                                                                        |
| Metrics scrape abuse              | `/metrics` requires `METRICS_TOKEN` compared in constant time; not routed publicly                                                                             |
| Ops misuse                        | `@RequirePermission`, confirm in UI, dry-run, `audit_logs`, real orchestrator hook with job status rather than a fake success                                  |
| Fabricated data in the admin UI   | Demo data is served only when `VITE_DEMO_MODE` is on; API failures surface as errors instead of silently rendering mocks                                       |

## Auth isolation rules

1. Never validate staff via messenger `initData`.
2. Never issue a mini-app JWT with an `admin` or `support` role.
3. Staff users live only in `staff_*` tables.
4. CORS allowlists are per contour and per public origin.
5. `API_CONTOUR` decides which module boots: `internal` on the admin VM, `miniapp` on the app VM. A missing value must never silently expose the mini-app API on the staff host.

## Key management

| Key                       | Purpose                             | Rotation notes                                                        |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `JWT_ACCESS_PRIVATE_KEY`  | Ed25519 signing for mini-app access | Rotating invalidates access tokens only; refresh flow re-issues       |
| `STAFF_JWT_SECRET`        | Staff session JWT                   | Rotating logs out all staff                                           |
| `TOTP_ENCRYPTION_KEY`     | Wraps TOTP secrets at rest          | Rotating requires re-enrolling every staff member's authenticator     |
| `PII_ENCRYPTION_KEY`      | Wraps phone numbers at rest         | Rotating requires re-encrypting stored values; plan a migration first |
| `YOOKASSA_WEBHOOK_SECRET` | Webhook authenticity                | Without it every webhook is rejected by design                        |
| `METRICS_TOKEN`           | `/metrics` scrape auth              | Update Prometheus scrape config at the same time                      |

Generate the symmetric keys with `openssl rand -base64 32` and the JWT keypair with
`openssl genpkey -algorithm ed25519`.

## Widget

Public publishable key, per-master Origin allowlist, hard per-key rate limits, Shadow DOM isolation, dedicated CSP middleware. Guest bookings create a pseudonymous `platform='web'` user; the phone number is stored encrypted and never returned by the public API.

## Compliance notes (152-FZ)

Host VMs and Object Storage in RF regions. Phone numbers are encrypted at rest via `PiiCryptoService`. The staff account list returns a masked placeholder instead of the number, so support sees only that a contact exists. Retain audit logs for all staff access to accounts.

## Reporting

Internal: open a Sev-1 ops job and rotate the affected secrets (JWT keys, staff session secret, TOTP and PII keys, bot tokens, YooKassa credentials) if compromise is suspected.
