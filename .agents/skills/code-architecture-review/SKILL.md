---
name: code-architecture-review
description: Guard clean architecture — file size, decomposition, folder structure, DRY, naming, API consistency, configuration. Invoke before creating new files, splitting existing ones, extracting shared code, or when the user says "kualitas kode", "arsitektur", "kok panjang banget", "susah dikembangkan".
---

# Code Architecture Review

Purpose: catch architectural drift BEFORE it becomes 1689 lines of admin dashboard. Encodes the smells we've hit + the guardrails to prevent recurrence.

## When to invoke
- Before creating a new file / route / component
- When adding a feature to an existing file that's already big
- When user says: "kualitas kode", "arsitektur", "susah maintain", "kok panjang", "refactor"
- Before merging a PR that adds >200 lines to a single file

## 1. File & function size — hard limits

| Level | Line count | Action |
|---|---|---|
| ✅ Good | < 200 | keep as-is |
| ⚠️ Warning | 200-500 | plan extraction points; not urgent |
| 🟠 Split soon | 500-1000 | list sub-concerns, propose split before adding more |
| 🔴 Split now | > 1000 | MUST split before merging any new feature into this file |

Function level:
- < 30 lines: fine
- 30-50: consider extract if it does >1 thing
- \> 50 lines: extract unless it's a linear script (setup, teardown)

**Reference: current codebase debt**:
- `src/app/admin/dashboard/page.js` — **1689 lines** (🔴 SPLIT NOW). 4 tabs + custom dropdown + all CRUD handlers in one file.
- `src/app/checkout/page.js` — **~600 lines** (🟠 split soon). Form + saved-address picker + cascading regions + shipping picker.
- `src/app/globals.css` — **>3000 lines** (🔴 needs split). Should be per-feature module OR at least split into `tokens.css` + `layout.css` + `components.css`.

## 2. Component decomposition triggers

Split a file when ANY of these apply:
- Renders 3+ distinct visual sections (header, list, form → separate components)
- Has >5 useState + useEffect combined
- Contains sub-components that are >30 lines each (extract them)
- Same JSX pattern appears 3+ times in the same render (rule of 3 — extract)
- Multiple "features" bundled (admin dashboard has products + users + orders + events — one route per tab is natural)

**Don't split** when:
- File is small (< 200 lines)
- Extracted piece would be used exactly once with no reuse potential
- Split would require prop-drilling >3 levels
- Just to satisfy line count — real cohesion beats artificial split

## 3. Folder structure — this project's rules

```
src/
├── app/                              # Routes ONLY, minimal logic
│   ├── page.js, layout.js
│   ├── api/<resource>/route.js      # Thin HTTP layer, delegates to lib
│   └── <route>/                     # Route + colocated page-specific components
│       ├── page.js
│       ├── someHelper.js            # Only if used by this route alone
│       └── style.module.css
├── components/                       # Reused across ≥2 routes
├── context/                          # React Context providers
├── lib/                              # Pure functions, NO React, NO DB
│   ├── prisma.js                    # DB singleton (only exception)
│   ├── auth.js, shipping.js, doku.js
│   └── ...
└── data/                             # Static seed data (products.js seed)
```

**Placement rules**:
- Component used by >1 route → `src/components/`
- Component used by 1 route only → colocate inside that route folder
- Business logic → `src/lib/` (testable in isolation)
- DB access → NEVER in components; via `src/app/api/**/route.js` OR server components
- HTTP → NEVER in `src/lib/*` — pure functions only (exception: `src/lib/shipping.js` because it wraps external API, but doesn't touch our DB)

**Anti-patterns**:
- API route file that does 100 lines of business logic → extract to `src/lib/<feature>.js`, route becomes thin dispatch
- Component that imports Prisma → move data fetching to server component OR API route + fetch from client
- `src/lib/` file that imports React → belongs in components/hooks, not lib

## 4. DRY — extract when repetition is REAL

**Rule of 3**: extract after the third occurrence, not the second.

Real debts in this codebase:
- **API route boilerplate** — every route has:
  ```js
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
  ```
  Appears ~15×. Extract to `src/lib/apiResponse.js`:
  ```js
  export function apiError(error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
  // Or a wrapper: withApiErrorHandling(handler)
  ```
- **Address field lists** — `{name, phone, streetAddress, rtRw, province, city, district, village, postalCode}` in 4+ files. Extract to a schema constant or Zod schema.
- **IDR formatter** — `new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0})` in 5+ files. Extract to `src/lib/format.js`.

**DON'T over-abstract**:
- Two similar things ≠ shared abstraction. Wait for the third.
- Premature `<GenericTable>` component is worse than three specific tables — you'll fight it every time requirements diverge.

## 5. Naming conventions

| Kind | Convention | Example |
|---|---|---|
| Route folder / URL segment | kebab-case | `customer/orders`, `payment/doku` |
| Component file | PascalCase | `ProductCard.js`, `SizePickerModal.js` |
| Non-component JS module | camelCase | `auth.js`, `shipping.js`, `rateLimit.js` |
| CSS module | camelCase + `.module.css` | `checkout.module.css`, `productDetail.module.css` |
| Function | camelCase, verb-noun | `fetchOrders`, `verifyPassword` (not `orderFetch`) |
| React component | PascalCase | `ProductCard`, `SizeOption` |
| Constant module-level | SCREAMING_SNAKE | `SESSION_TTL_SECONDS`, `MAX_TIMESTAMP_SKEW_MS` |
| Boolean | `is*` / `has*` / `can*` | `isSold`, `hasSizes`, `canBuy` |
| Handler | `handle*` or `on*` | `handleSubmit`, `onClose` |

Don't mix. Existing codebase has some drift (`api-wilayah-indonesia` uses kebab in URL — fine, external).

## 6. Import ordering (top of file)

```js
// 1. React / Next
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// 2. External libs
import { SignJWT } from 'jose';

// 3. Internal — @/ alias, deepest to shallowest by convention
import prisma from '@/lib/prisma';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';

// 4. Relative (same folder or sibling)
import styles from './checkout.module.css';
```

Blank line between groups, not within. Enforceable via `eslint-plugin-import` order rule if we add ESLint config later.

## 7. Configuration & constants

- **Magic numbers**: extract to named constant at top of file
  ```js
  // ❌ if (order.total > 500000) { ... }
  // ✅ const FREE_SHIPPING_THRESHOLD_IDR = 500000;
  ```
- **Repeated across files**: env var (if secret/deploy-dependent) OR shared constant in `src/lib/constants.js`
- **URLs**: never hardcode `http://localhost:3000` — use `window.location.origin` or config var
- **Timeouts / limits**: named constants — `SESSION_TTL_SECONDS`, `MAX_TIMESTAMP_SKEW_MS`, `RATE_LIMIT_WINDOW_MS`

## 8. API response shape — consistency rules

This codebase currently mixes shapes (past + present):
- `GET /api/products` → returns `Product[]` (raw array)
- `POST /api/orders` → returns `Order` (raw object)
- `POST /api/shipping/rates` → returns `{ rates: [] }`
- `GET /api/orders/[id]/status` → returns `{ status: '...' }`
- Errors: `{ error: string }` (consistent — good)

**Pick one convention for success**:
- **Option A** (simpler): raw for singletons, raw array for lists. Wrap only when metadata needed (`{rates, meta}`).
- **Option B** (envelope): `{data, meta?}` always. More consistent, easier to add pagination later.

Currently leaning A. Document it in AGENTS.md and stick.

**Status codes**:
- 200 OK — successful GET
- 201 Created — successful POST that creates a resource
- 400 Bad Request — client input validation failed
- 401 Unauthorized — missing / invalid auth
- 403 Forbidden — authed but not allowed
- 404 Not Found — resource doesn't exist
- 409 Conflict — race / duplicate
- 429 Too Many Requests — rate limit
- 500 Internal Server Error — server bug, log it

## 9. Comments

Follow the project rule: **only when WHY is non-obvious**. Don't:
- Restate what code does (`// increment counter` on `counter++`)
- Reference commits or PRs (they rot)
- Leave TODO without a linked ticket

Do:
- Explain business constraints (`// stock decrement is deferred to webhook — never here`)
- Warn about non-obvious behavior (`// idempotency: skip if already PROCESSING`)
- Document security assumptions (`// signature already verified in prev step`)

## 10. Common architecture smells — flag them

| Smell | Where seen | Fix |
|---|---|---|
| God component | `admin/dashboard/page.js` (1689 lines) | Split per tab into `admin/products/page.js` etc. |
| Duplicate try/catch | ~15 API routes | Extract `withApiErrorHandling` wrapper |
| Prop drilling >3 levels | Not currently, watch admin refactor | Context OR component composition |
| Context for non-global | ThemeContext OK, AuthContext OK, CartContext OK | Anything else needs justification |
| Business logic in UI component | `ProductDetailClient` had inline `alert()` for validation (now fixed) | Extract to hook / lib |
| Duplicated field list | 9-field address object in 4+ files | Zod schema + typed extraction |
| Hardcoded copy in JSX (i18n later?) | Everywhere — Indonesian only, OK for now | Only extract if going multilingual |

## 11. When to abstract — decision framework

Before extracting shared code, ask:
1. **Is this duplication real or superficial?** (Same shape ≠ same purpose. If they might diverge, don't share.)
2. **What's the cost of duplication?** (3 lines × 3 files = 9 lines. Abstraction = 15 lines helper + 3 imports. Sometimes worse.)
3. **What's the cost of coupling?** (Shared abstraction means changing one caller can require adjusting others.)
4. **Is the API stable?** (If the shape is still shifting, wait — extracting will thrash.)

**Rule of thumb**: 3 occurrences + stable shape + high cost of drift → extract. Otherwise wait.

## Output when reviewing existing code

```
## Architecture Review — <file / area>

### 🔴 Blockers
- **[dimension]** <observation>. Fix: <concrete action>

### 🟠 Debt to address soon
- ...

### 🟡 Nice-to-improve
- ...

### ✅ What's healthy
- ...
```

When silently auditing your OWN just-written code, fix or note in commit message.
