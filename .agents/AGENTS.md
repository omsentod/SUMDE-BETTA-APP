# Project Rules for SUMDE-BETTA-APP

## 1. React & State Management (Next.js App Router)
- **Avoid Synchronous setState in Effects**: Do not call `setState()` directly inside `useEffect()` without proper condition checks or render-phase handling to prevent cascading re-renders.
- **Client Components**: Mark interactive client-side files explicitly with `'use client';` at the top.
- **Currency Formatting**: Always format IDR currency using `new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)`.

## 2. DOKU Payment Gateway Integration
- **Unique Invoice Numbers**: Always append a timestamp suffix (e.g. `${order.id}_${Date.now()}`) to the `invoiceNumber` sent to DOKU Checkout to avoid `INVOICE ALREADY USED` errors during payment retries.
- **Webhook ID Parsing**: In the DOKU webhook route (`/api/payment/doku/webhook`), always strip the timestamp suffix (`invoiceNumber.split('_')[0]`) to retrieve the underlying Prisma `order.id`.
- **Webhook Signature Verification**: Security headers (`client-id`, `request-id`, `request-timestamp`, `signature`) must be validated using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Idempotency**: Webhook handling must check if the order status is currently `PENDING` before making state mutations or stock updates.

## 3. Database & Stock Integrity (Prisma ORM)
- **Atomic Stock Operations**: Stock updates (decrementing product quantity and variant sizes) must execute inside `prisma.$transaction`.
- **Deferred Stock Reduction**: Stock is **never** decremented when an order is created (`PENDING`). Stock is only decremented upon receiving a verified `SUCCESS` status from the DOKU webhook.

## 4. UI Aesthetics & Theme System
- **No Inline Styles in JSX**: Do NOT write inline styles (`style={{ ... }}`) inside JSX components. All styling MUST be placed in dedicated CSS files (`.css` or `.module.css`) using clean BEM/semantic CSS class names.
- **Dedicated CSS Files Per Feature/Page**: Do NOT dump page-specific styles into `globals.css`. Create dedicated CSS files or CSS Modules (e.g. `checkout.module.css`, `payment.module.css`, `dashboard.module.css`) for each page/feature.
- **Luxury Betta Design System**: Maintain the aesthetic, vibrant accents, sleek typography, and smooth CSS transitions defined in CSS files.
- **Responsive Layout**: Ensure interactive elements, tables, forms, and product grids adapt cleanly to mobile screen sizes.
- **No Emojis/Emoticons in UI**: Do NOT use raw emoji characters or text emoticons in the UI. Always use clean vector SVG icons or standard HTML icon elements for visual iconography.
- **Light + Dark Mode Parity — MANDATORY**: Any UI surface with a background color (modals, popups, dropdowns, toasts, side panels, cards) MUST use the theme CSS variables (`--bg-card`, `--modal-bg`, `--dropdown-bg`, `--header-bg`, etc.) that already flip between light and dark mode. NEVER hardcode a hex color like `#121216`, `#050505`, `#111`, `#fff` for a background — that locks the surface into one theme. After building any modal/popup/panel, verify it looks correct in BOTH modes by toggling `[data-theme="dark"]`. If a needed variable doesn't exist yet, add both light and dark values to `:root` and `[data-theme="dark"]` in `globals.css` before using it.
- **Empty States Must Vary With Context**: On any page filtered by tabs/status/category (orders, products, users), the empty state message MUST reflect the active filter — never render "Belum ada X" for every tab. Example: on `/customer/orders`, tab `PENDING` → "Tidak ada tagihan menunggu bayar" not "Belum ada pesanan". Every empty state must be `display: flex; flex-direction: column; align-items: center; gap: <spacing>` so icon/heading/description/CTA stack cleanly, never overlap.

## 5. Cart & Purchase Flow
- **Size Selection Gating**: A product with a non-empty `sizes` JSON array MUST NOT be purchasable without a `selectedSize`. On `ProductCard`, if `sizes.length > 0`, disable "Beli Sekarang" and the cart icon and swap the CTA to "Pilih Ukuran" that navigates to `/produk/[id]`. On product detail (`ProductDetailClient`), block `addToCart` / `buyNow` when `selectedSize` is empty and surface an inline error. The server-side order API is NOT the place to enforce this — do it in the UI so users understand what's missing.
- **Cart Item Identity**: The unique key of a cart line is `productId + selectedSize`, not `productId` alone. Two units of the same product in different sizes are two lines.
- **Buy-Now Semantics**: "Beli Sekarang" bypasses the cart and jumps to `/checkout` with ONLY that item. It must NOT append to the shared cart. Confirm the checkout summary shows exactly one item.

