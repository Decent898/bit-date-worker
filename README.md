# BIT Date on Cloudflare Workers

This project has been upgraded to a Cloudflare-native stack inspired by the publicly visible architecture pattern of `thudate.com`:

- Frontend: `Vite + React + TypeScript`
- Backend API: `Hono` running in Cloudflare Workers
- Database: `Cloudflare D1`
- Weekly matching: Worker cron trigger (`0 13 * * 5`, i.e. Friday 21:00 Asia/Shanghai)
- Static hosting: Worker Assets binding

## 1) Install

```bash
npm install
```

## 2) Create D1 database

```bash
npx wrangler d1 create bit_date
```

Copy the returned `database_id` into [wrangler.jsonc](/Users/xuhaochen/Documents/My_Project/date/wrangler.jsonc).

## 3) Set secrets and vars

Update the D1 `database_id` in [wrangler.jsonc](/Users/xuhaochen/Documents/My_Project/date/wrangler.jsonc), then configure these Worker secrets in Cloudflare:

- `TOKEN_SECRET`
- `CRON_SECRET`
- `ADMIN_SECRET`

Example:

```bash
npx wrangler secret put TOKEN_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put ADMIN_SECRET
```

## 4) Apply migrations

```bash
npm run db:migrate:remote
```

## 5) Build and deploy

```bash
npm run build
npm run cf:deploy
```

Or run the one-shot helper after exporting `CLOUDFLARE_API_TOKEN`:

```bash
./scripts/deploy-cloudflare.sh
```

## 6) Useful commands

```bash
npm run dev            # local frontend
npm run cf:dev         # worker local runtime
npm run db:migrate:local
npm run cf:types
```

## Notes

- Legacy Python backend files are kept under `backend/` for reference only.
- Current `/api/auth/send-code` returns `dev_code` in response for development convenience.
