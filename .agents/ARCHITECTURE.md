# Architecture — SUMDE-BETTA-APP

Stable reference: **target** module map, folder rules, and cross-cutting decisions.
Read this BEFORE proposing a refactor or creating a new module — do not re-derive from the codebase.

For current debt inventory + refactor plan, see [TECH-DEBT.md](./TECH-DEBT.md).
For behavior rules (React, DOKU, Prisma, UI, Cart), see [AGENTS.md](./AGENTS.md).

---

## 1. Stack

- **Framework**: Next.js (App Router, JS not TS)
- **DB**: Prisma → (whatever provider prisma/schema.prisma declares)
- **Auth**: custom, via `src/lib/auth.js` (`requireUser`, `requireAdmin`, session-based)
- **Payment**: DOKU Checkout (redirect flow) + HMAC-verified webhook
- **Shipping**: Komerce Ongkir (RajaOngkir v1) via `src/lib/shipping.js`
- **Styling**: CSS Modules per-page + `globals.css` for tokens/layout/shared components
- **Deploy**: Hostinger Node.js hosting (see skill `deploy-hostinger`)

## 2. Target folder map

```
src/
├── app/                              # Routes ONLY, thin logic
│   ├── (public)                      # /, /produk, /event, /tentang
│   ├── (auth)                        # /login, /register
│   ├── customer/                     # customer-only routes (guarded)
│   │   ├── dashboard, orders, addresses
│   ├── admin/                        # admin-only routes (guarded)
│   │   └── (products|users|orders|events)/page.js   ← TARGET (see TECH-DEBT)
│   ├── checkout, payment
│   └── api/<resource>/route.js       # Thin HTTP dispatch → delegates to src/lib
│
├── components/                       # Reused across ≥ 2 routes
├── context/                          # React Context providers (Auth, Cart, Product, Theme)
├── lib/                              # Pure functions — NO React, NO direct DB import
│   ├── prisma.js                    # DB singleton (ONLY DB import exception)
│   ├── auth.js, doku.js, shipping.js, address.js, rateLimit.js, constants.js
│   └── (proposed) apiResponse.js, format.js, schemas.js
└── data/                             # Static seed data (products.js)
```

### Placement rules

| If the module is… | Put it in… |
|---|---|
| Used by ≥ 2 routes | `src/components/` |
| Used by exactly 1 route + no reuse potential | Colocate in that route folder |
| Business logic (validators, calculators, transformers) | `src/lib/<feature>.js` |
| DB access | `src/app/api/**/route.js` (server) — **never** in components |
| External HTTP wrapper (shipping, DOKU) | `src/lib/` (wraps external only, does NOT touch our DB) |
| Static config / secret | `.env` + `src/lib/constants.js` |

### Anti-patterns (auto-flag)

- API route with > 100 lines of business logic → extract to `src/lib/<feature>.js`, route becomes dispatch
- Component importing `@/lib/prisma` → move fetch to server component or API route
- `src/lib/*` importing React → belongs in `components/` or `context/`
- Hardcoded `#hex` background in modal/popup → use theme CSS variable (see AGENTS.md §4)

## 3. Module inventory (current)

### `src/lib/` (7 modules)

| Module | Purpose | Notes |
|---|---|---|
| `prisma.js` | Prisma client singleton | Only file allowed to instantiate |
| `auth.js` | `requireUser`, `requireAdmin`, session helpers | Throws with `.status` for API routes |
| `doku.js` | Signature build + verify, invoice helpers | Uses `crypto.timingSafeEqual` |
| `shipping.js` | Komerce Ongkir wrapper (cities, rates) | 176 lines — largest lib module |
| `address.js` | Address shape helpers | Wraps 9-field address (candidate for Zod schema) |
| `rateLimit.js` | In-memory rate limit | Per-IP, per-endpoint |
| `constants.js` | Business constants (CONTACT, WA link) | Add: `FREE_SHIPPING_THRESHOLD_IDR`, `SESSION_TTL_SECONDS`, etc. |

**Missing (proposed extractions — see TECH-DEBT §DRY)**:
- `format.js` — IDR formatter (currently duplicated in 8 files)
- `apiResponse.js` — `apiError()` / `withApiErrorHandling()` wrapper (duplicated in ~19 routes)
- `schemas.js` — Zod schemas for Order, Address, Product, User (address fields duplicated in 4+ files)

### `src/components/` (7 shared)

| Component | Consumed by | Notes |
|---|---|---|
| `Header.js` | Root layout | 223 lines — includes profile dropdown, theme toggle, mobile hamburger |
| `Footer.js` | Root layout | Uses CONTACT from constants |
| `ProductCard.js` + `.module.css` | `/produk`, `/`, `/event` | 166 lines — enforces "Pilih Ukuran" gating |
| `SizePickerModal.js` | `ProductCard`, product detail | 128 lines — Shopee-style bottom sheet (see skill `shopee-style-modal`) |
| `CartSidebar.js` | Root layout | Slide-in drawer |
| `SearchableSelect.js` | Checkout region picker | Cascading province/city/district/village |
| `WhatsAppFloatingButton.js` | Root layout | Fixed CTA, uses `waLink()` from constants |

### `src/context/` (4 providers)

| Context | Owns | Notes |
|---|---|---|
| `AuthContext.js` | Session user, role | Fetches from `/api/auth/me` |
| `CartContext.js` | Cart items + persistence | 227 lines — key = `productId + selectedSize` |
| `ProductContext.js` | Product catalog cache | |
| `ThemeContext.js` | Light/dark toggle | Writes `[data-theme]` attr on `<html>` |

**Rule**: no new Context without justification. Anything else = prop pass or component composition.

### `src/app/api/` (11 resource groups)

```
api/
├── addresses/         GET, POST, [id]: GET, PUT, DELETE
├── auth/              login, logout, me, register
├── events/            GET, POST
├── health/            GET
├── orders/            POST, [id]: GET, [id]/status: GET
├── payment/doku/      POST (create), webhook: POST (verify + apply)
├── products/          GET, POST, [id]: GET, PUT, DELETE
├── shipping/          cities, rates
├── upload/            POST (multipart)
└── users/             GET (admin), PATCH (role change)
```

## 4. Cross-cutting decisions

### 4.1 API response shape — **Option A: raw**

- `GET /api/products` → `Product[]`
- `POST /api/orders` → `Order`
- `POST /api/shipping/rates` → `{ rates: [] }` (wrap only when metadata needed)
- Errors: `{ error: string }` always, appropriate status code

Envelope (`{ data, meta }`) is **not** used. Do not add per-route.

### 4.2 Status code table

| Code | When |
|---|---|
| 200 | Successful GET |
| 201 | Successful POST that creates a resource |
| 400 | Client input validation failed |
| 401 | Missing / invalid auth |
| 403 | Authed but not allowed |
| 404 | Resource doesn't exist |
| 409 | Race / duplicate (e.g., DOKU invoice replay) |
| 429 | Rate limit exceeded |
| 500 | Server bug — log with request-id |

### 4.3 Error handling pattern

All API routes MUST follow:
```js
try {
  const user = await requireUser(request);   // throws { status: 401 } if unauth
  // ... business logic
  return NextResponse.json(result);
} catch (error) {
  return NextResponse.json(
    { error: error.message },
    { status: error.status || 500 }
  );
}
```

Target: extract to `withApiErrorHandling(handler)` in `src/lib/apiResponse.js`. See TECH-DEBT.

### 4.4 Money & currency

- Storage: **integer IDR** (rupiah, no decimals) in DB
- Display: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })`
- Server-side authority: never trust `total`/`price`/`amount` from request body — recompute from DB
- Threshold constants live in `src/lib/constants.js` (e.g., `FREE_SHIPPING_THRESHOLD_IDR`)

### 4.5 Stock lifecycle (see AGENTS.md §3)

```
PENDING (order created) ──[DOKU webhook SUCCESS]──▶ PROCESSING (stock decremented atomically)
     │                                                         │
     └──▶ CANCELED / EXPIRED (no stock change)                 └──▶ SHIPPED → COMPLETED
```

Stock is **never** touched at order creation. Only at verified webhook, inside `prisma.$transaction`, idempotent on `status === 'PENDING'`.

### 4.6 CSS strategy

- Tokens & shared component styles → `globals.css` (currently 3605 lines — see TECH-DEBT)
- Page-specific styles → `<page>.module.css` colocated with route
- Theme: light/dark via `[data-theme]` attribute — every background MUST use `var(--...)` (see AGENTS.md §4)

## 5. Naming (enforced)

| Kind | Convention | Example |
|---|---|---|
| Route folder | kebab-case | `customer/orders`, `payment/doku` |
| Component file | PascalCase | `ProductCard.js`, `SizePickerModal.js` |
| Non-component module | camelCase | `auth.js`, `shipping.js`, `rateLimit.js` |
| CSS module | camelCase + `.module.css` | `checkout.module.css` |
| Function | camelCase, verb-noun | `fetchOrders`, `verifyPassword` |
| Constant module-level | SCREAMING_SNAKE | `SESSION_TTL_SECONDS`, `FREE_SHIPPING_THRESHOLD_IDR` |
| Boolean | `is*` / `has*` / `can*` | `isSold`, `hasSizes`, `canBuy` |
| Handler | `handle*` / `on*` | `handleSubmit`, `onClose` |

## 6. Import order (top of file)

```js
// 1. React / Next
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libs
import { SignJWT } from 'jose';

// 3. Internal — @/ alias
import prisma from '@/lib/prisma';
import { useCart } from '@/context/CartContext';

// 4. Relative
import styles from './checkout.module.css';
```

Blank line between groups, not within.
