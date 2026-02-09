# Billflow

[简体中文](README.zh-CN.md)

A modern subscription management system rebuilt for **Cloudflare Workers**. It provides a full React dashboard with D1 persistence, Telegram notifications, and automated exchange rate updates.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Yuri-NagaSaki/billflow)

## Features

- Subscription lifecycle management with automatic/manual renewals
- Expense analytics dashboard and reports
- Multi-currency support with ExchangeRate-API updates
- Telegram notifications (no email)
- i18n (zh-CN, en)
- Cloudflare Workers + D1 deployment

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite + Tailwind CSS + shadcn/ui
- Zustand + React Router
- Recharts + Radix UI
- React i18next

### Backend (Workers)
- Cloudflare Workers (Hono)
- D1 (SQLite)
- Session-based auth (D1 session table)
- Telegram Bot API
- Cron triggers for scheduled tasks

## Quick Deploy (Cloudflare Workers)

Template deploy notes:
- You must create a D1 database, set the `database_id` in `wrangler.toml`, and apply migrations. Without migrations, login will fail.
- If you did not set `ADMIN_PASSWORD`, the default login is `admin` / `admin` (change it in Settings after login).
- Automatic exchange rate updates require `EXCHANGE_RATE_API_KEY` (ExchangeRate-API). Without it, rates will not auto-update.

1. Create a D1 database:
   ```bash
   wrangler d1 create billflow
   ```

2. Update `wrangler.toml` with the generated `database_id`.

3. Apply migrations:
   ```bash
   wrangler d1 migrations apply billflow --local
   wrangler d1 migrations apply billflow
   ```

4. Configure secrets:
   ```bash
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put EXCHANGE_RATE_API_KEY
   ```

5. Build and deploy:
   ```bash
   pnpm install
   pnpm run build
   wrangler deploy
   ```

## Local Development

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run D1 migrations locally:
   ```bash
   wrangler d1 migrations apply billflow --local
   ```

3. Start Workers dev server:
   ```bash
   pnpm run dev:worker
   ```

4. Start Vite dev server (separate terminal):
   ```bash
   pnpm run dev
   ```

Frontend: http://localhost:5173
Worker API: http://127.0.0.1:8787/api

## Environment Variables

- `ADMIN_USERNAME` (optional, default `admin`)
- `ADMIN_PASSWORD` (required for initial login)
- `ADMIN_PASSWORD_HASH` (optional, overrides `ADMIN_PASSWORD`)
- `SESSION_COOKIE_SECURE` (optional, `true`/`false`/`auto`)
- `SESSION_COOKIE_SAMESITE` (optional, `lax`/`strict`/`none`)
- `BASE_CURRENCY` (optional, default `CNY`)
- `TELEGRAM_BOT_TOKEN` (optional, for notifications)
- `EXCHANGE_RATE_API_KEY` (optional, for FX updates)

## Tests

Run Worker tests:
```bash
pnpm run test
```

## License

MIT
