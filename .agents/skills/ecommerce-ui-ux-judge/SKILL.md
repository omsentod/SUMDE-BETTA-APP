---
name: ecommerce-ui-ux-judge
description: Review any customer-facing page against SUMDE-BETTA's e-commerce UX rules. Invoke before writing UI, after refactoring a page, or when the user says "cek tampilan", "review UI", "kok kurang responsif", "kaku", or reports a specific screen bug. Encodes the concrete bugs we've hit — not a generic checklist.
---

# E-commerce UI/UX Judge

Give a specific, prioritized critique. NOT a rewrite. Read file end-to-end + imported CSS module before scoring.

## Rubric (score 1-5 per dimension, funnel-blockers first)

### A. Dark/Light Mode Parity — MANDATORY
Every surface with a background MUST use theme CSS variables (`--modal-bg`, `--bg-card`, `--dropdown-bg`, `--input-bg`, etc.) — NEVER hardcoded hex like `#121216`, `#111`, `#18181f`, `#fff`.
- Past bugs: admin `modalContainer` and `confirmModal` had `background: #18181f` → dark modal in light mode.
- Verify by toggling `[data-theme="dark"]` on `<html>`. If needed variable doesn't exist, add both values in `globals.css` first.

### B. Empty States Must Vary With Context
Any page with tabs/filters (orders, products, users, admin lists) needs empty-state copy per tab.
- Past bug: `/customer/orders` showed identical "Belum ada pesanan" on all 5 status tabs.
- Layout: always `display:flex; flex-direction:column; align-items:center; gap:<n>` so icon/heading/desc/CTA never overlap (past bug: Link stacked next to <p> because no flex).
- CTA only where relevant (`Jelajahi Produk` on tab ALL — pointless on `SHIPPED` because they already have orders).

### C. Size Gating on Cart/Buy
Product with `sizes[]` non-empty MUST NOT be purchasable without a `selectedSize`.
- Card-level buy/cart must either open size picker modal (Shopee-style — see `shopee-style-modal` skill) or route to detail. Never silently drop size.
- Server-side `/api/orders` ALSO rejects orders on archived / missing products — but the UI must catch it first so users understand why.

### D. Form Reactivity (Critical for checkout)
If a form field drives another view (shipping cost, delivery ETA), the dependent view MUST refresh when the source changes.
- Past bug: user changed saved address → shipping cost stayed same because useEffect had unstable `cart` reference (OOM'd from infinite loop, secondary symptom was "Aceh vs Surabaya same rate").
- Give the user an explicit "Cek Ongkir" / "Refresh" escape hatch AND auto-refresh on real change.
- See `react-hooks-safety` skill for the dependency-stability pattern.

### E. Primary CTA Clarity
- Above-the-fold visibility, one dominant per screen
- Loading state (spinner + disabled) during action
- Sticky on mobile for long forms
- Copy: "Lanjut ke Pembayaran" not "Submit"

### F. Field UX (Checkout/Auth)
- Labels visible (not placeholder-only)
- Client validation on blur, not just submit
- Inline error next to wrong field, Indonesian, red
- Cascading selects: loading skeleton, disabled reason ("Pilih provinsi dulu")
- `autocomplete="email"` / `inputmode="numeric"` where applicable

### G. States (all data-fetching pages)
Loading = skeleton (not just spinner). Empty = illustrated + CTA. Error = user-friendly Indonesian (never `error.message` raw). Success = clear confirmation.

### H. Trust Signals (checkout/payment/product)
- "Pembayaran aman via DOKU" copy near CTA
- WA contact link near help
- Product: multiple angles, size + quantity display
- Return policy / garansi (T&C link) visible pre-checkout

### I. Mobile (highest weight — most Indonesian buyers)
- Works at 375px, no horizontal scroll
- Tap targets ≥ 44×44
- Modal → bottom sheet on mobile, centered on desktop
- Font ≥ 14px body

### J. Copy & Tone
- Bahasa Indonesia end-to-end (jangan campur EN kecuali brand)
- Luxury / boutique voice ("Akuisisi", "Spesimen Elit" — sudah ada di file)
- IDR: `Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0})`

### K. Consistency
- Same button class everywhere (`.btn-primary`)
- CSS variables, no hardcoded colors
- Spacing scale 4/8/12/16/24/32/48/64
- No mixed border-radius (avoid 4px + 12px randomly)

## Output format

```
## UI/UX Review — <path>

**Overall: X/5** — <one-sentence verdict>

### 🔴 Funnel blockers (fix before launch)
1. **[dim]** <observation>. Fix: <file:line> — <one-sentence action>

### 🟠 Conversion cost
1. ...

### 🟡 Polish
1. ...

### ✅ What's working (don't regress)
- ...
```

## Anti-patterns to always call out
- Inline `style={{...}}` in JSX
- Raw emoji (📍 🐟 💾) — use inline SVG (past bug: customer/dashboard shortcuts + orders empty state)
- `#hex` background on modal/dropdown/panel — use theme var
- `alert()` for UX feedback — inline banner or toast
- `document.getElementById(...).click()` — use `<button type="submit" form="id">`
- `localStorage` for identity/role — server session only
- Missing `aria-invalid` on failed field
- Fixed pixel widths (`width: 400px`) — breaks mobile
