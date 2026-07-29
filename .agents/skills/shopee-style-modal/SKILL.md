---
name: shopee-style-modal
description: Build a product-action modal (size picker, variant picker, cart preview) matching Shopee's mobile-first bottom-sheet pattern. Invoke when the task involves a lightweight decision surface triggered by a product card action.
---

# Shopee-style Modal

Reference: `src/components/SizePickerModal.js` (existing implementation).

## When to use
- Size / variant picker gated by product card action (buy / add-to-cart)
- Quick action confirmation ("Beli sekarang tanpa masuk keranjang?")
- Lightweight preview / disambiguation before commit

**NOT for**: multi-step wizards (use full page or drawer), long forms (use dedicated page), confirmations of destructive actions (use confirm dialog with different aesthetic).

## Structural requirements

### 1. Layout: bottom sheet on mobile → centered dialog on desktop
```css
.backdrop {
    display: flex;
    align-items: flex-end;      /* mobile: pinned to bottom */
    justify-content: center;
}
@media (min-width: 640px) {
    .backdrop { align-items: center; padding: 2rem; }
}
.sheet {
    border-radius: 20px 20px 0 0;    /* rounded top only, flush bottom */
    max-height: 85vh;
    overflow-y: auto;
}
@media (min-width: 640px) {
    .sheet { border-radius: 16px; }  /* all corners on desktop */
}
```

### 2. Theme awareness — MANDATORY
Backgrounds MUST use theme CSS variables:
```css
.sheet     { background: var(--modal-bg);  color: var(--text-main); }
.option    { background: var(--bg-card); border-color: var(--border-color); }
```
NEVER `#121216` / `#fff` (locks to one theme). Verify by toggling `[data-theme="dark"]`.

### 3. Header structure
```
[Product thumb 80×80] [Price + Name]    [X close]
```
- Thumb: `next/image` with `fill` + `sizes="96px"`
- Price: brand color, larger, top of stack
- Name: `text-overflow: ellipsis` + `-webkit-line-clamp: 2`
- Close: SVG `<path d="M6 18L18 6M6 6l12 12" />` — no emoji ×

### 4. Options grid
- Flex wrap, gap 0.6rem
- Each option: label + secondary info (stock, price diff)
- Out-of-stock: `opacity: 0.4`, `line-through`, `cursor: not-allowed`, `disabled` attribute
- Selected/active state visible

### 5. Interaction
- Click backdrop → close (check `e.target === e.currentTarget`)
- Escape key → close (`useEffect` + `document.addEventListener('keydown', ...)`)
- Body scroll lock while open: `document.body.style.overflow = 'hidden'` in `useEffect`, restore in cleanup
- Focus trap: for MVP, skip. For a11y-critical modals, use `focus-trap-react`.

### 6. Animation
```css
.backdrop { animation: fadeIn 0.15s ease-out; }
.sheet    { animation: slideUp 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
```
Skip animation-out — modal unmounts fast enough. Adding one requires state machine ("closing" state) that's rarely worth it.

## Props contract

```js
<Modal
  product={fullProductObject}   // needs at least: id, name, price, image, sizes[]
  action={'cart' | 'buy'}       // affects footer copy
  onClose={() => setOpen(null)} // parent controls visibility
  onCommit={(selectedSize) => { ... }} // fires after user picks + confirms
/>
```

Parent state stays in `ProductCard`:
```js
const [modalAction, setModalAction] = useState(null);
// ...
{modalAction && <SizePickerModal action={modalAction} onCommit={...} onClose={() => setModalAction(null)} />}
```

## Anti-patterns

- **Two footer buttons ("Batal" + "Simpan")**: for a 1-decision picker like size, click-to-commit is enough. Extra buttons add friction.
- **Placeholder empty state as illustration**: keep text simple ("Produk ini tidak punya varian ukuran."). Avoid stock imagery.
- **Sizes as radio buttons + separate commit button**: too many taps. Click size → commit directly (like Shopee).
- **Emoji in modal** (⚠️ / ✕ / 🐟): use inline SVG (violates AGENTS.md rule 4)
- **Modal inside a scrollable card**: `position: fixed` on the backdrop escapes the card. Ensure the wrapper isn't `position: relative` with `overflow: hidden` swallowing it.
- **Reusing `z-index` values from other overlays**: use `z-index: 2000` for content modals so they sit above admin sidebar (1000) and header (100).

## a11y minimums
- `role="dialog"` `aria-modal="true"` on sheet
- Close button `aria-label="Tutup"`
- Options are `<button>` (native focus + Enter/Space)
- Escape closes (see interaction §5)
- Full focus trap: nice-to-have, not required for buyer surfaces (unlike login / payment modals which should trap)

## Reference: SizePickerModal.js structure

- Reads sizes from `product.sizes` (JSON array of `{ size, quantity }`)
- Renders `<SizeOption>` per entry with stock badge
- Handles sold-out state visually + logically
- Fires `onCommit(selectedSize)` — parent decides whether to `addToCart` or `router.push('/checkout')`
- Auto-closes after commit (parent sets `modalAction = null`)
