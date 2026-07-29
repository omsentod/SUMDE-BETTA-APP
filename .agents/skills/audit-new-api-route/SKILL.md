---
name: audit-new-api-route
description: Security + correctness checklist for API routes in src/app/api/**. Invoke before creating a new route, after editing an existing one, or when user says "audit endpoint", "cek route", "apakah aman?". Catches the exact class of bugs the security review found in this codebase.
---

# API Route Audit

Run per HTTP handler in the file. Note N/A inline (comment) if a rule doesn't apply.

## 1. Auth guard
- [ ] `requireUser(request)` for logged-in-only? `requireAdmin(request)` for admin-only?
- [ ] Public endpoint deliberate + no PII in response?
- [ ] Webhook: signature verified via `crypto.timingSafeEqual` BEFORE any DB write?
- [ ] Auth guard errors (thrown Error with `.status`) propagate through catch to correct HTTP code?

**Red flag**: `getSession()` result used without null-check on a mutating endpoint.

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
- [ ] Public write / cost API (e.g. `/api/shipping/rates` — burns Komerce quota): rate-limited
- [ ] Returns 429 + `Retry-After` header

## 7. Idempotency
- [ ] Webhook: `if (order.status !== 'PENDING') return 200` — replay-safe
- [ ] Payment: repeated `POST /api/orders` shouldn't double-charge
- [ ] Order creation: safe on double-click? (currently: yes, DB creates new row with UUID; stock decrement only on webhook)

## 8. Error handling
- [ ] Every handler wrapped in `try / catch`?
- [ ] Catch: `return NextResponse.json({ error: error.message }, { status: error.status || 500 });`
- [ ] `console.error` internal errors — NEVER log signatures, tokens, hashes, DOKU signatures, Komerce keys

## 9. Method semantics
- [ ] GET is read-only (no writes / no side effects / no analytics event that mutates)
- [ ] POST/PUT/DELETE for mutations only
- [ ] CSRF covered by `sameSite: 'lax'` cookie + JSON body (browsers won't send `Content-Type: application/json` from a form). If accepting form-encoded, need CSRF token.

## Historic bugs — never reintroduce
| Bug | Where | Fix |
|-----|-------|-----|
| Payment fraud | POST /api/orders | Recompute total from Product.price × qty |
| Shipping fee tampering | POST /api/orders | `findAndValidateRate()` re-quote from Komerce |
| Privilege escalation | PUT /api/users | Session-derived role, not client `requesterId` |
| PII leak guest order | GET /api/orders/[id] | Split minimal `/status` endpoint |
| DOKU webhook amount mismatch | POST /api/payment/doku/webhook | Compare `payload.order.amount === Math.round(order.total)` |
| Missing rate limit | login/register | `consume()` per-IP fixed-window |
| Timing-unsafe legacy password | verifyPassword | `crypto.timingSafeEqual` on Buffers |
| Upload magic-byte spoof | POST /api/upload | Read first 12 bytes, match PNG/JPEG/GIF/WebP signatures |

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
