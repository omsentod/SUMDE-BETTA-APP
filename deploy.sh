#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> [1/5] Pulling latest code from main..."
git fetch origin main
git reset --hard origin/main

echo "==> [2/5] Installing dependencies..."
npm ci

echo "==> [3/5] Syncing Prisma schema to DB..."
npx prisma generate
npx prisma db push --accept-data-loss

echo "==> [4/5] Building Next.js..."
npm run build

echo "==> [5/5] Restarting app (Passenger)..."
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "Deploy finished at $(date '+%Y-%m-%d %H:%M:%S')"
