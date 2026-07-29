---
name: betta-code-style
description: Concrete code patterns for SUMDE-BETTA-APP — API route skeleton, Prisma queries, auth guard usage, rate-limit boilerplate, error message tone, CSS module conventions. Invoke before writing or editing any .js/.jsx file so new code matches the codebase's conventions instead of drifting.
---

# SUMDE-BETTA Code Style

Complement to `.agents/AGENTS.md` — that file holds design principles, this file holds copy-paste-ready patterns.

## When to invoke

- Before writing a new API route, React component, or context provider
- Before non-trivial edits to existing files — check the file already follows these; if not, follow the file's local style unless the change is a rewrite
- When creating a new page under `src/app/**/page.js`

## API route patterns

### Skeleton — public GET endpoint

```js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // ...read query, run query
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Skeleton — user-authenticated endpoint

```js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await requireUser(request);
    const rows = await prisma.someModel.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
```

Note the `error.status || 500` — auth guards throw `Error` with `.status` set (401 / 403), and this pattern propagates them through the same catch.

### Skeleton — admin-only endpoint

```js
import { requireAdmin } from '@/lib/auth';

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    // ...destructive op
    return NextResponse.json({ message: 'X berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
```

### Skeleton — rate-limited public write (login/register/contact)

```js
import { consume, clientIp } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    const ip = clientIp(request);
    const rl = consume(`register:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    // ...rest
  } catch (error) { /* ... */ }
}
```

Bucket key format: `<action>:<ip>`. Keep the `windowMs` and `limit` inline with the login/register constants for consistency (see `src/app/api/auth/*/route.js`).

### Response conventions

- Success `GET`: `NextResponse.json(data)` — status defaults to 200
- Success `POST` (created): `NextResponse.json(data, { status: 201 })`
- Success mutation with no meaningful body: `NextResponse.json({ message: '...' })`
- Error: `NextResponse.json({ error: '...' }, { status: <code> })`
- Always Indonesian for user-facing `error` values, English OK for `console.error` internal messages

## Password / user response hygiene

Never return the `password` field:

```js
const { password: _, ...userData } = user;
return NextResponse.json(userData);
```

Applied everywhere `user` is included in a response.

## Prisma patterns

### Singleton import

Always: `import prisma from '@/lib/prisma';` — never `new PrismaClient()` in a route (spawns connections that never close).

### Ownership-scoped queries

For any user-owned resource (orders, addresses, etc.):

```js
const where = session.role === 'admin' ? {} : { userId: session.id };
const rows = await prisma.order.findMany({ where, ... });
```

### Multi-write transactions

```js
const order = await prisma.$transaction(async (tx) => {
  const newOrder = await tx.order.create({ data: { ... } });
  for (const item of items) {
    await tx.orderItem.create({ data: { orderId: newOrder.id, ... } });
  }
  return newOrder;
});
```

Never do multi-step writes without `$transaction` — partial-fail state is worse than a rejection.

### Soft-delete pattern (Product)

If a Product has been ordered, don't hard-delete:

```js
const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
if (orderItemCount > 0) {
  await prisma.product.update({ where: { id }, data: { isArchived: true } });
  return NextResponse.json({ message: 'Produk diarsipkan (memiliki riwayat pesanan).' });
}
await prisma.product.delete({ where: { id } });
```

Public listings filter `!p.isArchived`; the order API also rejects orders containing archived products.

## Client component patterns

### Interactivity marker

Every file that uses hooks or event handlers:
```js
'use client';
```
Server components (default) never have `useState`, `useEffect`, or event handlers.

### Auth context usage

```js
import { useAuth } from '@/context/AuthContext';

export default function SomePage() {
  const { currentUser, isLoading } = useAuth();
  if (isLoading) return <LoadingState />;
  if (!currentUser) { /* redirect or render "please log in" */ }
  // ...
}
```

Never read `localStorage` for identity — the httpOnly cookie is the source of truth. `useAuth()` fetches from `/api/auth/me`.

### API calls from client

```js
const res = await fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || 'Gagal memuat data.');
```

Cookies are sent automatically for same-origin — no `credentials: 'include'` needed.

## CSS conventions (from AGENTS.md — reinforcement)

- **CSS modules per page/feature**: `checkout.module.css`, `payment.module.css`, `adminDashboard.module.css`
- **No inline `style={{...}}`** in JSX — put it in the module
- **No page-specific styles in `globals.css`** — that file is for global tokens + shared layout only
- **Use CSS variables** for colors: `color: var(--text-main)` not `color: #1C1C1E`
- **No raw emoji** in the UI — use inline SVG or an icon component

Class naming: kebab-case (`.checkout-item-row`, `.summary-total`), or shadcn-style camelCase if using CSS modules (`styles.sectionTitle`).

## Currency formatting

Always:
```js
new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
}).format(amount)
```

Result: `Rp1.500.000` — never show cents for IDR.

## Error message tone

User-facing errors: Indonesian, short, no jargon.

- ✅ "Data tidak lengkap."
- ✅ "Email atau password salah."
- ✅ "Autentikasi diperlukan."
- ❌ "Error: undefined is not a function"
- ❌ "Prisma error P2025: Record not found"
- ❌ "AUTHENTICATION_REQUIRED_401"

For internal `console.error`, English + context is fine.

## Common imports (top of a client page)

```js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/context/ProductContext';
```

## Avoid

- `alert('...')` for anything except confirm-before-destructive. For UX feedback, use inline banners or the CSS-module `.auth-alert-error` pattern.
- `document.getElementById(...).click()` to trigger form submit — use `<button type="submit" form="form-id">` instead.
- `localStorage` for identity or roles — server session only.
- Duplicated CSS variables that shadow `globals.css` root defs — theme drift.
- Hard-coded region strings in cascading selects — always resolve via `emsifa` API IDs.
- `console.log` of secrets, tokens, or webhook payloads containing signatures.

## Comments

Follow the general project rule: **no comments unless the WHY is non-obvious**.
- ✅ "// Idempotency: only act while PENDING — later webhooks for finalized orders are acked but skipped"
- ❌ "// Loop through items and create OrderItem for each"

Comments referencing "which PR added this" or "TODO: fix later" rot fast — prefer git blame and issue tracker.
