# @beauty/admin-web

Staff console for Beauty+ (admin + support). Separate from the Telegram/MAX mini-app.

## Stack

React 19 · Vite · TypeScript · Tailwind · TanStack Query · React Hook Form · Zod

## Dev

```bash
pnpm --filter @beauty/admin-web dev
```

Default: [http://localhost:5174](http://localhost:5174) with `VITE_DEMO_MODE=true`.

### Demo login

1. Email/password (pre-filled in demo)
2. TOTP: any 6-digit code → admin; `000000` → support

Auth is email + password + TOTP only. Cookie session uses `credentials: 'include'`. No Telegram auth.
