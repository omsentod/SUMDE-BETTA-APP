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
- **Luxury Betta Design System**: Maintain the dark mode aesthetic, vibrant accents, sleek typography, and smooth CSS transitions defined in `src/app/globals.css`.
- **Responsive Layout**: Ensure interactive elements, tables, forms, and product grids adapt cleanly to mobile screen sizes.
