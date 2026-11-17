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

## Deploy procedure (Hostinger Deployments + Next.js)

Hostinger menggunakan **Git Deployments** (`hbuilds/` architecture) yang auto-build saat ada commit baru ke `main`.

### Step 0 — Push kode
```bash
git push origin main
```
Tunggu ~2-3 menit sampai build Hostinger selesai di **hPanel → Websites → Deployments**.

---

### Step 1 — Prisma push di empty DB (Sync Schema)
Balik ke SSH terminal (atau login ulang):
```bash
ssh -p 65002 u707667165@147.93.80.69
set -a && source ~/domains/sumdebetta.com/hbuilds/config/.env && set +a
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH

npx prisma@6.19.3 db generate --schema=$HOME/domains/sumdebetta.com/hbuilds/last-source/prisma/schema.prisma
npx prisma@6.19.3 db push --schema=$HOME/domains/sumdebetta.com/hbuilds/last-source/prisma/schema.prisma
```
Jauh lebih cepat di empty DB (10-20 detik). Output yang diharapkan:
```
🚀  Your database is now in sync with your Prisma schema.
```
> *Catatan*: Kalau tetap stuck di stage yang sama seperti sebelumnya → SSH ke terminal bermasalah/terputus, bukan Prisma.

---

### Step 2 — Seed data (admin + produk demo)
Sesuai kebutuhan (jika inisialisasi awal DB atau reset):
```bash
cd ~/domains/sumdebetta.com/hbuilds/last-source
node prisma/(seed-file).js

# Atau jika copy seed ke nodejs run directory:
# cp $HOME/domains/sumdebetta.com/hbuilds/last-source/prisma/seed.js ./seed-run.js
# node ./seed-run.js
# rm ./seed-run.js
```

---

### Step 2b — Optimasi Seluruh Foto Lama di Folder Uploads (In-Place)
Jika ingin merampingkan seluruh foto produk lama yang ada di folder persisten `uploads/` agar website semakin kencang:
```bash
cd ~/domains/sumdebetta.com/hbuilds/last-source
node scratch/optimize_existing_images.js
```
Script ini otomatis mendeteksi folder persisten `~/domains/sumdebetta.com/uploads/` dan mengompres foto-foto lama secara aman tanpa mengubah nama file (link database tetap utuh).

---

### Step 3 — Restart app (Passenger)
Cari UUID deployment terbaru (`ls ~/domains/sumdebetta.com/hbuilds/versions/`), lalu:
```bash
cd ~/domains/sumdebetta.com/hbuilds/versions/<UUID_TERBARU>/nodejs/
mkdir -p tmp && touch tmp/restart.txt
```

---

### Step 4 — Cek smoke test & log
Cek runtime log di server:
```bash
tail -30 console.log
```
Cari baris seperti `▲ Next.js ... Ready in ...ms` — artinya app restart sukses.

Dari komputer lokal:
```bash
curl -s https://sumdebetta.com/api/health
```
Expected:
```json
{"status":"ok","message":"SUMDE-BETTA API Server is healthy"}
```

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
