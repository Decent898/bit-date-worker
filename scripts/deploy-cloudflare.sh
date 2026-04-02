#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to run this script."
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is not set."
  exit 1
fi

WRANGLER_CONFIG="$ROOT_DIR/wrangler.jsonc"
DB_NAME="bit_date"

if grep -q 'REPLACE_WITH_YOUR_D1_DATABASE_ID' "$WRANGLER_CONFIG"; then
  echo "Creating D1 database $DB_NAME..."
  DB_OUTPUT="$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)"
  DB_ID="$(printf '%s' "$DB_OUTPUT" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n 1)"
  if [[ -z "$DB_ID" || "$DB_ID" == "null" ]]; then
    echo "$DB_OUTPUT"
    echo "Failed to read D1 database id from Wrangler output."
    exit 1
  fi
  perl -0pi -e "s/REPLACE_WITH_YOUR_D1_DATABASE_ID/$DB_ID/g" "$WRANGLER_CONFIG"
fi

if grep -q 'REPLACE_WITH_A_LONG_RANDOM_SECRET' "$WRANGLER_CONFIG"; then
  TOKEN_SECRET="$(openssl rand -hex 32)"
  perl -0pi -e "s/REPLACE_WITH_A_LONG_RANDOM_SECRET/$TOKEN_SECRET/g" "$WRANGLER_CONFIG"
fi

if grep -q 'REPLACE_WITH_CRON_SECRET' "$WRANGLER_CONFIG"; then
  CRON_SECRET="$(openssl rand -hex 24)"
  perl -0pi -e "s/REPLACE_WITH_CRON_SECRET/$CRON_SECRET/g" "$WRANGLER_CONFIG"
fi

if grep -q 'CHANGE_ME_ADMIN_SECRET' "$WRANGLER_CONFIG"; then
  ADMIN_SECRET="$(openssl rand -hex 24)"
  perl -0pi -e "s/CHANGE_ME_ADMIN_SECRET/$ADMIN_SECRET/g" "$WRANGLER_CONFIG"
fi

echo "Generating Cloudflare runtime types..."
npm run cf:types

echo "Applying D1 migrations..."
npm run db:migrate:remote

echo "Building frontend..."
npm run build

echo "Deploying worker..."
npm run cf:deploy

echo "Deployment finished."
