---
name: audit-new-api-route
description: Security + correctness checklist for API routes AND server-rendered pages that touch prisma directly (src/app/api/**, plus any Server Component in src/app/admin/** or src/app/customer/** that imports @/lib/prisma). Invoke before creating a new route/page, after editing an existing one, or when user says "audit endpoint", "cek route", "apakah aman?". Catches the exact class of bugs the security review found in this codebase.
---

# API Route Audit

Run per HTTP handler in the file. Note N/A inline (comment) if a rule doesn't apply.

**Also applies to Server Components** — any `page.js` / `layout.js` under `src/app/admin/**` or `src/app/customer/**` that imports `@/lib/prisma` is an authenticated data surface, not a public marketing page. The same auth guards apply.

## 1. Auth guard
- [ ] `requireUser(request)` for logged-in-only? `requireAdmin(request)` for admin-only?
- [ ] **Server Component** touching `prisma` under `/admin/**` — has `await requireAdmin(...)` at the top? Under `/customer/**` — has `await requireUser(...)` AND ownership scope on the query? (Past bug: `/admin/orders/[id]/label` shipped without any guard → any UUID guesser could read PII)
- [ ] Root layout / `LayoutWrapper` conditionals that HIDE chrome (header/footer) don't count as auth — they're view logic, not access control
- [ ] Public endpoint deliberate + no PII in response?
- [ ] Webhook: signature verified via `crypto.timingSafeEqual` BEFORE any DB write? Applies to **every** third-party webhook (DOKU, Biteship, future) — not only DOKU
- [ ] Auth guard errors (thrown Error with `.status`) propagate through catch to correct HTTP code?

**Red flag**: `getSession()` result used without null-check on a mutating endpoint.
**Red flag**: `import crypto from 'crypto'` present but never called — signature-verify skeleton was drafted then abandoned. Either implement or delete the import (past occurrence: `shipping/webhook/route.js` shipped with unused `crypto` import + apologetic comment).

## 2. Client-trusted values (never trust from body/query)
- [ ] `userId` / `role` from `session.id` / `session.role`, never body
- [ ] `total` / `price` / `amount` recomputed server-side from DB (past bug #1 — payment fraud: client set `total: 1000` for 1M item)
- [ ] `shippingFee` re-quoted at order creation via `findAndValidateRate()` — never trust the client's fee (see `src/lib/shipping.js`)
- [ ] `status` (PROCESSING/PAID) only set from webhook, never client — even admin
- [ ] `id` for mutations from route params, not body

## 3. Input validation
- [ ] Strings non-empty + normalized (`.trim()`, email `.toLowerCase()`)
- [ ] Numbers `Number.isFinite()` + range (quantity > 0, price ≥ 0)
- [ ] Enums against allowlist (order status, roles)
- [ ] Foreign keys verified to exist (past pattern: reject unknown `productId` with 400)
- [ ] Long text has max length (avoid runaway payloads)

## 4. Response — what leaks
- [ ] `password` stripped from any user response: `const { password: _, ...userData } = user;`
- [ ] Guest orders don't leak PII via UUID-only auth (see `orders/[id]/route.js` — full detail requires session, `/status` sub-endpoint returns only status)
- [ ] Error messages don't leak internal state (500 with generic Indonesian, not `Prisma error P2025`)
- [ ] No tokens/secrets/signatures in response bodies

## 5. Prisma safety
- [ ] Ownership-scoped queries (`where: { userId: session.id }` unless admin)
- [ ] Multi-write ops in `prisma.$transaction`
- [ ] `onDelete` behavior understood (past bug #2 — deleting Product used to nuke OrderItem history; now soft-delete via `isArchived`)
- [ ] Narrow `select: {...}` for tables with PII

## 6. Rate limiting (public endpoints)
- [ ] Auth (login/register/forgot): `consume(key, {limit, windowMs})` from `@/lib/rateLimit`?
- [ ] Public endpoint that burns third-party quota — rate-limited? Currently applies to:
  - `/api/shipping/rates` (Biteship rate quotes)
  - `/api/shipping/track` (Biteship tracking passthrough — currently NOT rate-limited, gap)
- [ ] Admin action that triggers external booking (`/api/admin/orders/[id]/shipment` — books a Biteship shipment) — guarded so double-click doesn't burn quota / create duplicate shipments? Check `if (order.biteshipShipmentId) return existing`
- [ ] Returns 429 + `Retry-After` header

## 7. Idempotency & state transitions
- [ ] **Payment webhook** (DOKU): `if (order.status !== 'PENDING') return 200` — replay-safe
- [ ] **Shipping webhook** (Biteship): ranked state check — never move backward. `PENDING < PROCESSING < SHIPPED < COMPLETED`. If incoming maps to a status ≤ current, ignore. (Past risk: duplicate old `picked` event after `delivered` would flip `COMPLETED` → `SHIPPED`)
- [ ] **Cancel path**: if webhook moves to `CANCELLED` from a state where stock was already decremented (`PROCESSING`+), restock inside `prisma.$transaction` — not just flip status. (Past gap: shipping webhook `cancelled/rejected/returned` leaked inventory)
- [ ] **Returned ≠ Cancelled**: `returned` means item was delivered then sent back — needs its own status, not lumped into `CANCELLED`
- [ ] **State-mutating admin endpoint** (e.g. `/shipment`): guarded on order status? (e.g. only allow booking pickup when `status === 'PROCESSING'` — otherwise `PENDING` orders can burn Biteship API + generate real shipments)
- [ ] **Overwrite guards**: if a value can arrive out-of-order (`trackingNumber` from webhook AND from admin re-click), only write when the new value is definitely better. (Past bug: admin re-click reused stale `shipmentData` without `courier.waybill_id` → wrote `TEST-<id>` over a real waybill.)
- [ ] Payment: repeated `POST /api/orders` shouldn't double-charge
- [ ] Order creation: safe on double-click? (currently: yes, DB creates new row with UUID; stock decrement only on webhook)

## 8. Error handling
- [ ] Every handler wrapped in `try / catch`?
- [ ] Catch: `return NextResponse.json({ error: error.message }, { status: error.status || 500 });`
- [ ] `console.error` internal errors — NEVER log signatures, tokens, hashes, DOKU signatures, Biteship API keys, webhook secrets

## 9. Method semantics
- [ ] GET is read-only (no writes / no side effects / no analytics event that mutates)
- [ ] POST/PUT/DELETE for mutations only
- [ ] CSRF covered by `sameSite: 'lax'` cookie + JSON body (browsers won't send `Content-Type: application/json` from a form). If accepting form-encoded, need CSRF token.

## Historic bugs — never reintroduce
| Bug | Where | Fix |
|-----|-------|-----|
| Payment fraud | POST /api/orders | Recompute total from Product.price × qty |
| Shipping fee tampering | POST /api/orders | `findAndValidateRate()` re-quote from Biteship |
| Privilege escalation | PUT /api/users | Session-derived role, not client `requesterId` |
| PII leak guest order | GET /api/orders/[id] | Split minimal `/status` endpoint |
| DOKU webhook amount mismatch | POST /api/payment/doku/webhook | Compare `payload.order.amount === Math.round(order.total)` |
| Missing rate limit | login/register | `consume()` per-IP fixed-window |
| Timing-unsafe legacy password | verifyPassword | `crypto.timingSafeEqual` on Buffers |
| Upload magic-byte spoof | POST /api/upload | Read first 12 bytes, match PNG/JPEG/GIF/WebP signatures |
| Admin server-page PII leak | GET /admin/orders/[id]/label (Server Component) | `await requireAdmin()` at top of Server Component, or `src/app/admin/layout.js` shared guard |
| Shipping webhook unverified | POST /api/shipping/webhook | HMAC-SHA256 `timingSafeEqual` on `biteship-signature` (see `biteship-integration-debug` skill) BEFORE any DB write |
| State machine backward | POST /api/shipping/webhook | Rank statuses; ignore incoming ≤ current |
| Stock leak on shipping cancel | POST /api/shipping/webhook | Restock in `prisma.$transaction` when transitioning to `CANCELLED` from ≥ `PROCESSING` |
| Waybill overwrite race | POST /api/admin/orders/[id]/shipment | Only write `trackingNumber` when it came from a fresh `courier.waybill_id`, never from a fallback like `TEST-<id>` |
| Admin action on wrong status | POST /api/admin/orders/[id]/shipment | Guard `order.status === 'PROCESSING'` before booking Biteship pickup |
| Unauth public tracking passthrough | GET /api/shipping/track | Add per-IP rate limit; consider requiring session + ownership check on waybill |

## Output when auditing existing route

```
## Audit — <file path>

### 🔴 Must fix
- **[category]** <line> — <problem>. Fix: <concrete action>

### 🟠 Should fix
- ...

### 🟡 Consider
- ...

### ✅ Passes
- (list what already passes)
```

When silently auditing your OWN just-written code, fix and briefly say "audited: <summary of fixes>".
