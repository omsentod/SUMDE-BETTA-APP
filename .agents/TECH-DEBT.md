# Tech Debt Inventory — SUMDE-BETTA-APP

Living document. Each entry: **what's wrong**, **target**, **why not yet**, **blockers**.

**Baseline captured**: 2026-07-30 (update the date when refreshing counts).
**How to refresh**: run `wc -l` on flagged files + `grep -c` on duplicated patterns. See §Refresh commands.

For target architecture and folder rules, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For guardrails when working IN debt, see skill `code-architecture-review`.

---

## Priority legend

- 🔴 **P0** — blocks new work in that area OR active security/correctness risk
- 🟠 **P1** — will bite soon; plan next quarter
- 🟡 **P2** — nice-to-improve; extract when you happen to touch the file

---

## 🔴 P0 — File size / god-component

### `src/app/admin/dashboard/page.js` — 1689 lines

- **Debt**: single file bundles 4 tabs (products, users, transactions, events) + `ManageableSelect` sub-component (lines 10–149) + all CRUD handlers. 37 `useState`/`useEffect` calls.
- **Target**: split per tab into separate routes:
  ```
  src/app/admin/
  ├── products/page.js
  ├── users/page.js
  ├── orders/page.js       (was "transactions")
  └── events/page.js
  ```
  Move `ManageableSelect` → `src/components/ManageableSelect.js` (reused across tabs).
- **Why still 1689**: admin UX was fastest as one page; splitting requires shared filter state design + nav shell.
- **Blocker before split**:
  1. Extract `ManageableSelect` to `src/components/`
  2. Design admin sidebar/nav shell (currently top tabs — needs to work as route switcher)
  3. Decide: shared admin layout (`src/app/admin/layout.js`) for auth guard + nav
- **Rule while debt exists**: DO NOT add new features to this file. Any new admin feature = new route file.

### `src/app/globals.css` — 3605 lines

- **Debt**: consolidated from at least 2 previous modules (`produk.module.css`, `page.module.css` — marked in comments). Contains tokens + layout + shared component + page-specific styles.
- **Target**: split into
  ```
  src/app/
  ├── globals.css                # only CSS custom properties (tokens) + resets + theme flips
  └── styles/
      ├── layout.css             # container, grid, responsive utilities (lines ~1589-1691)
      ├── header.css             # header, actions, mobile nav (lines ~140-277, 2244-2328)
      ├── footer.css             # (lines ~377-471, 1930-1942)
      ├── product-card.css       # gallery + card (lines ~313-376) — OR keep as .module.css
      ├── cart-sidebar.css       # (lines ~540-633)
      └── modals.css             # size picker + generic modals (lines ~1943-2130)
  ```
  Page-specific chunks (produk, home) → move back to `<page>.module.css` colocated with route.
- **Why still 3605**: prior consolidation was tactical; a proper split needs CSS variable audit first (which var is truly global vs page-scoped).
- **Blocker before split**: none technical — just time. Do it in one pass, not incrementally.
- **Rule**: new page/feature styles = new `.module.css`. Do NOT append to `globals.css`.

---

## 🟠 P1 — File size / needs decomposition

### `src/app/checkout/page.js` — 649 lines

- **Debt**: form + saved-address picker + cascading region select + shipping courier picker + summary, all in one client component. 27 hook calls.
- **Target**: extract to colocated components inside `src/app/checkout/`:
  ```
  checkout/
  ├── page.js                    # orchestration only (~200 lines target)
  ├── SavedAddressPicker.js
  ├── AddressForm.js             # includes cascading region select (uses SearchableSelect)
  ├── ShippingPicker.js
  ├── CheckoutSummary.js
  └── checkout.module.css
  ```
- **Why still 649**: works. But adding any new field (e.g., coupon code) will push past 800.
- **Extract now if**: touching checkout for a new feature.

### `src/app/customer/addresses/page.js` — 372 lines

- **Debt**: list + create form + edit modal + delete confirm in one file.
- **Target**: extract `AddressForm`, `AddressListItem`, `AddressDeleteConfirm`. Reuse `AddressForm` in checkout too (see P1 above — shared extraction opportunity).
- **Why still 372**: below 500, tolerable. Escalates if shared with checkout.

### `src/app/tentang/page.js` — 319 lines

- **Debt**: static content page but 319 lines suggests inline sections repeated.
- **Action**: skim; if 3+ similar sections → extract `AboutSection` component.

---

## 🟠 P1 — DRY: real duplication (rule of 3+ met)

### IDR formatter — duplicated in 8 files

**Files**: `checkout/page.js`, `payment/page.js`, `admin/dashboard/page.js`, `customer/orders/page.js`, `components/ProductCard.js`, `components/CartSidebar.js`, `components/SizePickerModal.js`, `produk/[id]/ProductDetailClient.js`

- **Target**: `src/lib/format.js`
  ```js
  export const idr = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  });
  export const formatIDR = (amount) => idr.format(amount);
  ```
- **Why still duplicated**: never extracted; each page re-declared.
- **Cost of leaving**: rate change or symbol tweak = 8 edits.

### API try/catch boilerplate — ~19 route files

Every API route ends with:
```js
} catch (error) {
  return NextResponse.json({ error: error.message }, { status: error.status || 500 });
}
```
Occurrences per file: `events` (10), `webhook` (7), `users` (7), `orders` (7), `[id]` routes (4-6 each).

- **Target**: `src/lib/apiResponse.js`
  ```js
  export function apiError(error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }

  // Or a wrapper:
  export function withApiErrorHandling(handler) {
    return async (request, ctx) => {
      try { return await handler(request, ctx); }
      catch (error) { return apiError(error); }
    };
  }
  ```
- **Why still duplicated**: fine one-by-one, no forcing function yet.
- **Extract when**: touching any API route for another reason.

### Address field list — 4+ files

9-field address shape (`name, phone, streetAddress, rtRw, province, city, district, village, postalCode`) appears in:
- `src/lib/address.js` (partial)
- `src/app/checkout/page.js` (form fields)
- `src/app/customer/addresses/page.js` (form fields)
- `src/app/api/addresses/route.js` (validation)
- `src/app/api/orders/route.js` (shipping address extraction)

- **Target**: `src/lib/schemas.js` — Zod schema `AddressSchema` for validation + type. Every consumer imports the same schema.
- **Blocker**: need to add `zod` dependency.

---

## 🟡 P2 — Nice-to-improve

### `src/lib/constants.js` — expand beyond CONTACT

Currently only `CONTACT` and `waLink`. Add named constants for magic numbers found in code:
- `FREE_SHIPPING_THRESHOLD_IDR` (if used)
- `SESSION_TTL_SECONDS`
- `MAX_TIMESTAMP_SKEW_MS` (used by DOKU webhook — currently inline)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`
- `SHIPPING_ITEMS_PER_KG` (currently env var default 10 — decide: env vs constant)

### `src/context/CartContext.js` — 227 lines

Below split threshold, but includes storage, add/remove logic, and derived selectors. If it grows past 300 or you add multi-currency / discount logic, split derived selectors into `src/lib/cart.js` (pure functions).

### `src/components/Header.js` — 223 lines

Includes profile dropdown, theme toggle, cart trigger, mobile hamburger. If you add search or notifications, split into `Header.js` + `HeaderProfileMenu.js` + `HeaderMobileNav.js`.

### Inline `style={{ ... }}` in JSX

`admin/dashboard/page.js:799` has `style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', ... }}` — violates AGENTS.md §4. Move to `.module.css` class.

---

## Refresh commands

Run these to update this file's line counts / grep counts:

```bash
# File sizes for tracked debt
wc -l src/app/admin/dashboard/page.js src/app/checkout/page.js src/app/globals.css src/app/customer/addresses/page.js src/app/tentang/page.js

# Top 20 largest source files (find new hot spots)
find src -type f \( -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + | sort -rn | head -20

# IDR formatter duplicates
grep -rl "Intl\.NumberFormat('id-ID'" src/

# try/catch API boilerplate count per file
grep -cE "NextResponse\.json\(\{ error" src/app/api -r

# Hook count in heavy files
grep -c "useState\|useEffect" src/app/admin/dashboard/page.js src/app/checkout/page.js
```

Update the numbers + baseline date above whenever you run a fresh scan.

---

## Refactor priority order (recommended)

1. Extract `src/lib/format.js` (10 min, unlocks IDR consistency)
2. Extract `src/lib/apiResponse.js` + apply to routes as you touch them
3. Split `admin/dashboard/page.js` → per-tab routes (biggest win, blocks new admin features)
4. Split `checkout/page.js` when adding next checkout feature
5. Split `globals.css` (single dedicated pass, no incremental)
6. Add Zod schemas (needs dep + design pass)
