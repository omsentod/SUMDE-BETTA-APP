---
name: deploy-hostinger
description: Pre-deployment safety checklist and step-by-step deploy guide for Hostinger. Invoke when the user says "deploy", "push production", "release", "hostinger", or before any release-touching action. Prevents forgetting migrations, environment variable sync, or leaving secrets in a public repo.
---

# Deploy to Hostinger

Purpose: never miss a migration, never overwrite `.env.production`, never deploy with uncommitted security fixes stuck in a local working tree.

## When to invoke

- User says: "deploy", "push production", "release", "go live", "kirim ke hostinger", "test production"
- Before any `git push` that changes `main`
- After committing a batch of fixes and considering a release

## Pre-deploy safety checklist

Run this BEFORE `git push`. If any item fails, stop and fix before continuing.

### 1. Working tree state

```bash
git status
git log --oneline -5
```
- [ ] `git status` clean (no uncommitted changes)?
- [ ] Last 5 commits look sensible — none are experimental / WIP?
- [ ] Not sitting on a feature branch by accident?

### 2. Secret hygiene

- [ ] `.env` and `.env.production` are BOTH gitignored (`git check-ignore .env .env.production` should print both)?
- [ ] `git log --all --oneline -- .env.production` shows only pre-`b5872412` commits (the security fix commit)? If NEW commits mention `.env.production`, secrets are leaking again — STOP.
- [ ] Manual scan of latest commit diff for hardcoded secrets: `git show HEAD | grep -iE 'secret|password|api[_-]?key|token'`
- [ ] MySQL password rotated if credentials ever appeared in a public commit? (Currently deferred per project memory — check status before real launch.)

### 3. Build sanity

```bash
npm run build
```
- [ ] Build finishes without errors?
- [ ] No new deprecation warnings that weren't there last release?
- [ ] Any new page routes list correctly? Check output for the new route path.

### 4. DB migration state

- [ ] Compare `prisma/schema.prisma` to what's on the production DB. Any column added / removed / renamed?
- [ ] If yes: plan `npx prisma db push` step for AFTER code deploy but BEFORE traffic (or before, if column is nullable).
- [ ] For destructive changes (drop column / rename), snapshot the DB first via Hostinger's phpMyAdmin export.

### 5. Environment variable diff

Compare local `.env` vs server `.env.production`:

| Variable | Local (.env) | Prod (.env.production on server) |
|---|---|---|
| `DATABASE_URL` | localhost MySQL | Hostinger MySQL |
| `AUTH_SECRET` | any 48+ byte value | must match what live sessions were signed with — rotating this logs everyone out |
| `DOKU_CLIENT_ID` | sandbox | production (when ready) |
| `DOKU_SECRET_KEY` | sandbox | production |
| `DOKU_BASE_URL` | `https://api-sandbox.doku.com` | `https://api.doku.com` |

- [ ] Every var used by code (`grep -r "process.env" src`) is present in `.env.production` on the server?
- [ ] `AUTH_SECRET` is NOT being rotated (unless intentional — all users get logged out)?
- [ ] DOKU switching sandbox → production is a DELIBERATE separate step, not accidental?

### 6. DOKU dashboard sync (if payment changed)

- [ ] Webhook notification URL in DOKU dashboard matches production URL: `https://<yourdomain>/api/payment/doku/webhook`
- [ ] TLS on production works (`curl -I https://<yourdomain>` shows 200/301)?

## Deploy procedure (Hostinger, Node.js app hosting)

### Step 1 — push code
```bash
git push origin main
```

### Step 2 — SSH / File Manager pull
Depending on how Hostinger is configured:
- **Git integration**: hit "Pull latest" in the Hostinger panel → auto-pulls from `origin/main`
- **Manual SSH**: `ssh <user>@<host>` then `cd <path> && git pull`
- **FTP**: NOT recommended — you'll miss the `.git` diff and can't roll back cleanly

### Step 3 — install dependencies
```bash
npm ci --production=false
# (--production=false because build needs devDependencies like Tailwind)
```

If `npm ci` fails, fall back to `npm install`, but investigate the lockfile mismatch after.

### Step 4 — build
```bash
npm run build
```

Watch for OOM — if Hostinger's memory is tight, temporary swap or `NODE_OPTIONS=--max-old-space-size=1024`.

### Step 5 — DB migration
```bash
npx prisma db push
```

**Only if step 4 in pre-deploy flagged a schema change.** Idempotent — safe to run every deploy.

For destructive changes: snapshot first.

### Step 6 — restart Node process
Hostinger panel → Node.js app → Restart. Or from SSH:
```bash
pm2 restart <app-name>  # if using PM2
# or whatever process manager Hostinger provisions
```

### Step 7 — smoke tests
Run these against the LIVE URL, not localhost:

```bash
curl -sf https://<yourdomain>/api/health | jq
```
Expected: `{"status":"ok","message":"SUMDE-BETTA API Server is healthy"}`

Then in a browser:
- [ ] Homepage loads, products render, categories tab works
- [ ] `/produk` gallery loads with filters
- [ ] Login as existing user succeeds
- [ ] `/admin/dashboard` — proxy redirects non-admin to `/login`, admin lands
- [ ] Add product to cart → checkout → DOKU sandbox → cancel (don't complete real payment on prod)
- [ ] Order appears in customer/orders after cancel

### Step 8 — monitor for 15 minutes
- Watch Hostinger error log for stack traces
- Refresh homepage a few times — no 500s?
- If deployed during business hours, watch for any customer WA complaint

## Rollback plan

If something is broken:

1. **Fast rollback (code only)**:
   ```bash
   git reset --hard <previous-good-commit>
   git push --force-with-lease origin main
   ```
   Then repeat steps 3-6 above. Only force-push if you're the only committer on `main`.

2. **DB rollback**:
   If a migration broke things, restore from the snapshot you took in step 5. Prisma has no automatic down-migrate for `db push`.

3. **DOKU rollback**:
   If you switched to production credentials by mistake, change `.env.production` back to sandbox + restart. Any in-flight real payments will keep going — contact DOKU support to void if needed.

## Post-deploy

- Log the deploy: commit SHA, timestamp, migration ran (y/n), any incidents observed. A `DEPLOY.md` at repo root is fine.
- If DOKU webhook URL changed (rare — only when domain changes), update in DOKU merchant dashboard.
- Consider tagging the deploy: `git tag -a v0.X.Y -m "release notes" && git push --tags`

## Do NOT

- Deploy with **uncommitted work** in local — either commit or `git stash`
- Deploy on Friday afternoon if you have no on-call
- Deploy while another person is deploying — coordinate
- Skip DB snapshot before destructive migrations
- Trust "it works locally" — always run smoke tests against the live URL
- Delete old `.env.production` on the server without knowing what's in it
