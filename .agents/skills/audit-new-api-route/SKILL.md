---
name: audit-new-api-route
description: Systematic security & correctness checklist for any API route in src/app/api/**. Invoke before creating a new route, after editing an existing one, or when the user asks to audit an endpoint. Catches missing auth guards, client-trusted values, PII leaks, and validation gaps that the previous security review flagged.
---

# API Route Audit

Purpose: catch the exact class of bugs the security review found in this codebase (client-trusted `total` in orders, PII leak in guest orders, missing rate limit on auth, etc.) before they ship again.

## When to invoke

- Immediately after creating a new file under `src/app/api/**/route.js`
- Immediately after editing an existing route's HTTP handler (`GET/POST/PUT/PATCH/DELETE`)
- When user says: "cek endpoint ini", "audit route X", "apakah aman?"
- Before opening a PR that touches API routes

## The checklist (run for EVERY handler in the file)

For each handler, verify all applicable items. If an item is deliberately N/A, note WHY inline in the code (comment).

### 1. Authentication guard

- [ ] Is the endpoint's audience clear? Public / logged-in / admin / webhook?
- [ ] If logged-in required: does it call `await requireUser(request)` from `@/lib/auth`?
- [ ] If admin required: does it call `await requireAdmin(request)`?
- [ ] If public: is that deliberate, and does the response contain no PII?
- [ ] If webhook: is signature verified with `crypto.timingSafeEqual` before ANY DB write?

**Red flag**: `session?.id` used as trust boundary without `requireUser` — a caller can be null and slip past.

### 2. Client-trusted values

Never trust these from the body/query:
- [ ] `userId` — always read from `session.id`, never from request
- [ ] `role` — non-admin can never set `role: 'admin'`
- [ ] `total` / `price` / `amount` — always recomputed server-side from DB
- [ ] `status` — never set `PROCESSING` or `PAID` from a non-webhook client
- [ ] `id` in body for privilege-sensitive updates — should come from route params, not body

**Red flag pattern**: `const { userId } = await request.json()` — this is the fraud pattern from the payment fix.

### 3. Input validation

- [ ] Every string field is checked non-empty AND normalized (`.trim()`, `.toLowerCase()` for emails)?
- [ ] Numbers pass `Number.isFinite()` and range check (quantity > 0, price ≥ 0)?
- [ ] Enums validated against allowlist (order status ∈ `VALID_STATUSES`)?
- [ ] Foreign keys verified to exist before creating dependent rows?
- [ ] Long text has a max length to avoid runaway payloads?

For complex payloads, prefer a Zod schema (once we adopt Zod project-wide).

### 4. Response — what leaks

- [ ] `password` field stripped from every user response?
- [ ] Guest orders don't return PII (name/email/phone/address) via UUID-only auth?
- [ ] Error messages don't leak internal state (`error.message` OK for expected errors, but generic 500 for internal)?
- [ ] Server does NOT include tokens/secrets in JSON response bodies?

**Pattern**: `const { password: _, ...userData } = user; return NextResponse.json(userData);`

### 5. Prisma safety

- [ ] Scoped queries filter by `userId`? (Non-admin should never see rows owned by others)
- [ ] Multi-write ops wrapped in `prisma.$transaction`?
- [ ] `onDelete` cascade behavior understood? (e.g. deleting a Product should NOT nuke past OrderItems — soft-delete instead)
- [ ] No `SELECT *` for tables with PII — use `select: { ... }` to narrow?

### 6. Rate limiting (public endpoints only)

- [ ] Login / register / forgot-password: `consume()` from `@/lib/rateLimit`?
- [ ] Public write endpoints (contact form, review submission): rate-limited?
- [ ] Returns `429` with `Retry-After` header when limit hit?

Endpoints already using `@/lib/auth` guards do NOT need rate limit — session forgery is the harder attack, brute force is what rate limit blocks.

### 7. Idempotency (for state transitions)

- [ ] Webhook processes each event exactly once? (`if (order.status !== 'PENDING') return 200`)
- [ ] Payment flows can be retried without double-charging?
- [ ] Order creation is safe if the client double-clicks the button?

### 8. Error handling

- [ ] Every handler has a `try / catch`?
- [ ] Catch returns `NextResponse.json({ error: error.message }, { status: error.status || 500 })`?
- [ ] Auth guard errors (`.status = 401/403`) propagate through the same catch?
- [ ] `console.error` for internal errors — never `console.log` sensitive values (never log signatures, tokens, hashes)?

### 9. Method safety

- [ ] `GET` is truly read-only — no side effects, no writes, no logging user-tied events?
- [ ] `POST/PUT/PATCH/DELETE` — mutations only, no data return that a `GET` should have served?
- [ ] CSRF is naturally covered by `sameSite: 'lax'` cookies + `Content-Type: application/json` bodies. If you accept form-encoded bodies from browsers, you need a token.

## Reporting the audit

If the user asked for an audit, respond in this shape:

```
## Audit — <file path>

### 🔴 Must fix
- **[category]** <line> — <problem>. Fix: <concrete action>

### 🟠 Should fix
- ...

### 🟡 Consider
- ...

### ✅ Passes
- (list checkboxes that already pass, so the fix doesn't accidentally regress them)
```

If you're auditing your OWN just-written code (not asked): silently run the checklist, fix issues, then briefly say "audited: <summary of fixes>".

## Reference: examples from THIS codebase's history

- **Payment fraud (#1 in security review)**: client-supplied `total` was trusted. Fix: recompute from `Product.price × quantity` server-side.
- **Privilege escalation (#hotfix f60703fc)**: client-asserted `requesterId` = anyone can become admin. Fix: read `session.role` from JWT, not body.
- **PII leak in guest orders (#9)**: unauthenticated UUID lookup returned full address+phone+email. Fix: minimal `/status` endpoint for polling.
- **DOKU webhook (#6)**: didn't compare `amount`. Fix: `if (payload.order.amount !== Math.round(order.total)) return 400`.
- **Missing rate limit (#3)**: login/register had none. Fix: `consume()` per-IP fixed-window.

Any new API route MUST NOT reintroduce these patterns.
