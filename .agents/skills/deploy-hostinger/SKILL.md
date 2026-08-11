---
name: deploy-hostinger
description: Pre-deploy checklist + step-by-step deploy for Hostinger Node.js hosting. Invoke when user says "deploy", "push production", "release", "go live", "kirim ke hostinger". Prevents lost migrations, .env desync, and shipping uncommitted security fixes.
---

# Deploy to Hostinger

## When to invoke
- User: "deploy", "push production", "release", "test production", "kirim ke hostinger"
- Before any `git push origin main` that touches API / schema / env vars
- After batching security fixes for release

## Pre-deploy checklist (BLOCK on any failure)

### 1. Working tree state
```bash
git status
git log --oneline -5
```
- [ ] `git status` clean (no uncommitted work)
- [ ] Last 5 commits sensible, no `++` / WIP
- [ ] Not on feature branch by accident

### 2. Secret hygiene
- [ ] `.env` and `.env.production` in gitignore: `git check-ignore .env .env.production`
- [ ] No new `.env.production` commit: `git log --all --oneline -- .env.production` shouldn't show recent hits
- [ ] Manual diff scan: `git show HEAD | grep -iE 'secret|password|api[_-]?key|token'`
- [ ] MySQL password rotated if creds ever leaked publicly (currently DEFERRED per project memory — check before launch)

### 3. Build sanity
```bash
npm run build
```
- [ ] No new deprecation warnings
- [ ] New routes in output list
- [ ] **CSS Modules `pure` mode traps** — Next.js webpack build rejects top-level global selectors (`body`, `html`, `*`, standalone `@page`) inside `.module.css`, even wrapped in `:global {}` blocks. `eslint` and `next dev` DO NOT catch this; only `next build` does. If you need a global rule from a page (typical for `@media print` resets, `@page` size, `body` background override), put it in an inline `<style dangerouslySetInnerHTML>` in the (server) page component — not in the module CSS. Past bug: label.module.css shipped `body { background: white; }` inside `@media print`, Hostinger build failed with `Selector "body" is not pure`, downstream webhook fix couldn't deploy.

### 4. DB migration state
- [ ] Compare local `prisma/schema.prisma` vs production DB — any column added/removed/renamed?
- [ ] Plan `npx prisma db push` step (AFTER code deploy)
- [ ] Destructive changes (drop col / rename): snapshot DB first via phpMyAdmin export

### 5. Environment variable diff

| Variable | Local (.env) | Production (server .env.production) |
|---|---|---|
| DATABASE_URL | localhost MySQL | Hostinger MySQL |
| AUTH_SECRET | any 48+ byte | must match existing (rotating logs out all users) |
| DOKU_CLIENT_ID | sandbox | production (when ready) |
| DOKU_SECRET_KEY | sandbox | production |
| DOKU_BASE_URL | `https://api-sandbox.doku.com` | `https://api.doku.com` |
| RAJAONGKIR_API_KEY | Komerce Shipping Cost key | same (or separate prod key) |
| SHIPPING_ORIGIN_CITY_ID | your city id | same |
| RAJAONGKIR_BASE | Komerce v1 URL | same |

- [ ] Every `process.env.*` in `src/` covered in server's `.env.production`
- [ ] `AUTH_SECRET` NOT rotating (unless intentional — invalidates all sessions)
- [ ] DOKU switch sandbox → production is DELIBERATE separate step
- [ ] Test transaction Rp10rb after DOKU switch (see `test-doku-webhook` skill for staging test)

### 6. DOKU dashboard (if payment changed)
- [ ] Webhook notification URL in DOKU dashboard = `https://<domain>/api/payment/doku/webhook`
- [ ] HTTPS working on production domain

### 7. Komerce dashboard (if shipping changed)
- [ ] `SHIPPING_ORIGIN_CITY_ID` in production `.env` = correct merchant city id
- [ ] Free tier quota check (100 req/day) — dashboard "Total API HIT / Day"

## Deploy procedure (Hostinger Node.js hosting)

### Step 1 — push
```bash
git push origin main
```

### Step 2 — pull on server
- **Git integration**: Hostinger panel → "Pull latest"
- **SSH**: `ssh <user>@<host> && cd <path> && git pull`
- **NOT FTP** — misses `.git` diff, can't rollback cleanly

### Step 3 — install
```bash
npm ci --production=false
# --production=false because build needs devDependencies (Tailwind, etc.)
```
Fallback if `npm ci` fails: `npm install` + investigate lockfile drift after.

### Step 4 — build
```bash
npm run build
```
If OOM: `NODE_OPTIONS=--max-old-space-size=1024 npm run build`

### Step 5 — migration
```bash
npx prisma db push
```
Only if step 4 of pre-deploy flagged schema change. Idempotent, safe to always run.

### Step 6 — restart
- Hostinger panel → Node.js app → Restart
- OR SSH: `pm2 restart <app>` (if using PM2)

### Step 7 — smoke tests (LIVE URL, not localhost)
```bash
curl -sf https://<domain>/api/health | jq
```
Expected: `{"status":"ok","message":"SUMDE-BETTA API Server is healthy"}`

Browser check:
- [ ] Homepage loads, products + categories render
- [ ] `/produk` gallery with filters
- [ ] Login as admin succeeds
- [ ] `/admin/dashboard` proxy: non-admin → redirect `/login`
- [ ] Add to cart → checkout → shipping picker fetches rate → DOKU sandbox → cancel (don't complete real payment on prod unless final test)
- [ ] Order appears in customer/orders after cancel

### Step 8 — monitor 15 min
- Hostinger error log
- Refresh homepage — no 500s
- Business hours: watch WhatsApp for customer complaints

## Rollback

**Code**:
```bash
git reset --hard <previous-good-commit>
git push --force-with-lease origin main
```
Only force-push if you're the only committer on main. Repeat steps 3-6.

**DB**: restore from phpMyAdmin snapshot (step 4). Prisma `db push` has no down-migrate.

**DOKU switch mistake**: change `.env.production` back to sandbox → restart. In-flight real payments keep going — contact DOKU support to void if needed.

## Post-deploy
- Log deploy: commit SHA, timestamp, migration ran (y/n), incidents (`DEPLOY.md` at repo root)
- If webhook URL changed (domain change), update in DOKU merchant dashboard
- Tag: `git tag -a v0.X.Y -m "notes" && git push --tags`

## NEVER
- Deploy with uncommitted work in local — commit or stash first
- Deploy Friday afternoon without on-call
- Deploy while someone else is deploying — coordinate
- Skip DB snapshot before destructive migration
- Trust "works locally" — always smoke-test against live URL
