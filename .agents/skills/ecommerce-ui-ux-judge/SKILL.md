---
name: ecommerce-ui-ux-judge
description: Evaluate an e-commerce page (product listing, detail, checkout, cart, auth, admin) against conversion-oriented UI/UX standards. Use whenever the user asks to review, critique, or judge a page's design; before shipping a UI refactor; or when they say tampilannya kurang / rusak / kaku.
---

# E-commerce UI/UX Judge

Purpose: give an honest, prioritized critique of a page as if you were a senior e-commerce designer reviewing before launch. Not a rewrite — a scored review with concrete fixes.

## When to invoke

Invoke this skill **before** touching any UI file when the user asks:
- "review tampilan halaman X"
- "apakah UI-nya bagus / konversi tinggi?"
- "cek UX checkout / login / produk"
- "tampilan kaku / rusak / kurang menarik"
- Immediately after finishing a UI refactor, before reporting done.

Do NOT invoke for:
- Backend / API route reviews (use `audit-new-api-route`)
- Pure bug fixes without design implication

## How to run the review

1. **Read the page file end-to-end** — plus any imported CSS module and any leaf component it renders (`ProductCard`, `SearchableSelect`, etc.). Skimming causes wrong verdicts.
2. **Note the page's role** (home, listing, detail, cart, checkout, payment, dashboard, auth). Different rubrics apply per role.
3. **Score each dimension** using the rubric below (1-5 scale: 1 broken / 5 excellent).
4. **Rank issues by conversion impact** — cosmetic issues last, funnel blockers first.
5. **Give a fix for each finding** — specific file:line + one-sentence change, not a whole rewrite.

## Rubric (universal — apply to any page)

### A. Visual hierarchy (weight: high on landing/detail; medium on checkout)
- Does the primary action stand out clearly (color, size, whitespace)?
- Is there one dominant element per fold, or is it a wall of noise?
- Consistent typography scale (H1 > H2 > body — no random `2rem` inline)?

### B. Primary CTA clarity (weight: HIGHEST on all funnel pages)
- Is the buy/checkout/submit button visible without scroll on load?
- Does the CTA copy tell the user what happens next ("Lanjut ke Pembayaran" > "Submit")?
- Sticky on mobile for long forms (checkout, product detail)?
- Loading state during action (spinner + disabled)?

### C. Form UX (weight: HIGHEST on checkout, auth, address book)
- Field labels visible (not just placeholder-only)?
- Client-side validation runs on blur, not just submit?
- Error messages appear next to the wrong field, in red, in Indonesian?
- Sensible autocomplete/inputmode (`autocomplete="email"`, `inputmode="numeric"` for phone)?
- Password: min length hint visible, show/hide toggle?
- Cascading selects (province → city): loading skeleton, disabled reason shown?

### D. States (weight: high on all data-fetching pages)
- **Loading**: skeleton or spinner, NOT flash of empty content?
- **Empty**: illustrated + CTA to unblock (empty cart → "Jelajahi Galeri" button)?
- **Error**: user-friendly Indonesian, not `error.message` raw?
- **Success**: clear confirmation after submit (not a silent redirect)?

### E. Trust signals (weight: high on checkout/payment/product)
- Secure payment badge or copy ("Pembayaran aman via DOKU")?
- Return policy / warranty / kontak WA visible near CTA?
- Product images: multiple angles, zoomable, watermark if premium?
- Reviews or "X orang membeli" if available?

### F. Mobile responsiveness (weight: HIGHEST — most Indonesian buyers are mobile)
- Does it work at 375px width without horizontal scroll?
- Tap targets ≥ 44×44px?
- Modal/drawer for filters instead of sidebar on mobile?
- Sticky bottom CTA on product detail?
- Font size ≥ 14px body?

### G. Performance perceptions (weight: medium)
- Above-the-fold image priority (`<Image priority />`)?
- Skeleton before content, not spinner-only?
- Avoid layout shift (fixed image dimensions, avoid `min-h` jumps)?

### H. Accessibility basics (weight: medium — but non-negotiable for auth/checkout)
- Every input has `<label>` linked via `htmlFor`/`id`?
- Focus visible on tab (not `outline: none` without replacement)?
- Semantic HTML (`<button>` not `<div onClick>`)?
- Color contrast: text on `--primary` (#FF6B35) passes AA?
- Form errors announced (`role="alert"` or `aria-invalid`)?

### I. Copy & tone (weight: high)
- Consistent brand voice ("Spesimen Elit", "Akuisisi" — luxury vibe)?
- Bahasa Indonesia sepanjang funnel (jangan campur EN kecuali branding)?
- Currency: `Rp1.500.000` dengan format `id-ID`, minimumFractionDigits: 0?
- Numbers with thousand separators?

### J. Consistency (weight: high across pages)
- Same button style everywhere (`.btn-primary`)?
- Same CSS variables — no hardcoded `#FF6B35` or `#000`?
- Same spacing scale (4/8/12/16/24/32/48/64)?
- Same border-radius family (avoid mixing `4px` and `12px` randomly)?

## Output format

Return findings in this shape:

```
## UI/UX Review — <page path>

**Overall: X/5** — <one-sentence verdict>

### 🔴 Funnel blockers (fix before launch)
1. **[dimension]** — <observation>. Fix: <file:line> — <one-sentence action>
2. ...

### 🟠 Conversion cost (fix before scaling ads)
1. ...

### 🟡 Polish (nice-to-have)
1. ...

### ✅ What's working
- <keep-this observations, so the fix doesn't accidentally regress them>
```

## Anti-patterns to always call out

- Inline `style={{...}}` in JSX → violates AGENTS.md rule 4, and makes theming impossible
- Raw emojis in UI (`💾 Simpan`, `⚠️`, `✓`) → violates AGENTS.md rule 4; use lucide-react or inline SVG
- Fixed pixel widths on containers (`width: 400px`) → breaks on mobile
- Client-side `if (isLoading) return <div>Loading...</div>` without skeleton
- `<button className="hidden">` triggered from sibling via `document.getElementById` — use `form=""` attribute instead
- `alert()` for error UX → use inline banner or toast
- Missing `aria-invalid` when a field fails validation
- `search-input` class doing double duty as both search bar and form input — semantic drift

## Context you can assume for SUMDE-BETTA-APP

- Brand: "Sumde Betta" — premium ikan cupang boutique. Vibe: luxury, exclusive.
- Palette: `--primary` #FF6B35 (coral), `--secondary` #00B4D8 (cyan), dark mode default via `[data-theme="dark"]`
- Font: Inter for both `--font-main` and `--font-serif`
- Currency: IDR only, no cents
- Language: Bahasa Indonesia for all user-facing copy
- Target buyer: Indonesian betta enthusiasts, mostly mobile (WhatsApp-centric)
- Payment: DOKU checkout — customer redirects out, then polls status endpoint

## Example invocation

User: "cek tampilan checkout aku, kurang menarik kayaknya"

You:
1. Read `src/app/checkout/page.js` + `checkout.module.css` + `SearchableSelect.js`
2. Apply rubric — score each dimension
3. Report using the output format above
4. Do NOT edit until user approves specific fixes
