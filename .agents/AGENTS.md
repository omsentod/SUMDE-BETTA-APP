# Project Rules for SUMDE-BETTA-APP

**Companion docs** (read when relevant, do NOT re-derive from codebase):
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target folder map, module inventory, API shape decision, naming, import order
- [TECH-DEBT.md](./TECH-DEBT.md) — current debt inventory, refactor targets, why-not-yet, priority order

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

## 5. Auth (Email Verification, Password Reset, Change Password)

- **Block Login for Unverified Email**: If `user.emailVerified === null` (belum verifikasi OTP), login endpoint MUST return `403` dengan body `{ error, code: 'EMAIL_NOT_VERIFIED', email }`. UI login redirect otomatis ke `/verify-email?email=<email>`. Admin di-whitelist (bypass) supaya seeded admin tetap bisa manage. Rule: JANGAN issue session cookie untuk user unverified.
- **OTP Format & Storage**: OTP 6-digit numerik (via `crypto.randomInt(0, 1_000_000)`). Simpan HASHED di DB (`scrypt`, mirror pola `src/lib/auth.js`). TTL 10 menit, max 5 attempts per OTP. Setelah verify sukses, DELETE row `EmailVerification` — jangan sekadar mark used, biar resend/register ulang start fresh.
- **Resend OTP Rate Limit — Dua Lapis**: (1) per IP untuk cegah abuse global, (2) per email untuk cegah harass user tertentu (spam OTP ke inbox mereka). Limit per email: 3/jam. Lihat `src/app/api/auth/resend-otp/route.js`.
- **Password Reset Token — Hashed**: Token `crypto.randomBytes(32).toString('hex')`, kirim RAW via email, simpan HASH (SHA-256) di DB. Kalau DB bocor, attacker tidak bisa langsung pakai token. TTL 30 menit, single-use (mark `usedAt`). Sebelum insert token baru, invalidate token lama untuk user tsb yang belum dipakai.
- **Anti-Enumeration on Forgot Password**: Endpoint `POST /api/auth/forgot-password` HARUS balas 200 dengan pesan generic ("kalau email terdaftar, link dikirim") apakah email exists atau tidak. Kalau exists → kirim email (best-effort, log kalau gagal, jangan bocor error ke response). Kalau tidak exists → tidak kirim email tapi response TETAP identik.
- **Change Password (Logged-in) — Rate Limit per User**: Kunci session cookie yang dicuri bisa dipakai brute-force `currentPassword`. Rate limit `change-pw:<userId>` (bukan per IP), 5 attempts / 15 menit.
- **Anti-Enumeration on Resend OTP**: Kalau user tidak exists ATAU sudah verified, balas 200 sukses palsu (tanpa kirim email). Hanya user real yang belum verified yang benar-benar terima OTP baru.
- **Password Baru != Password Lama**: Endpoint change-password + reset-password wajib tolak kalau new === current (setelah verify current). Rule ini di UI DAN server — client-side untuk UX, server-side untuk security.
- **Auto-login after OTP verify**: Endpoint `POST /api/auth/verify-otp` set session cookie DALAM response verify (bukan minta login lagi). UI panggil `setCurrentUser(data)` dari `AuthContext` supaya `/customer/dashboard` tidak race dengan `/api/auth/me`.

## 5b. Google OAuth (`src/lib/googleAuth.js`)

- **State CSRF Wajib**: Endpoint `/api/auth/google` generate random state, simpan di httpOnly cookie (`sumde-oauth-state`), sertakan di query `state`. Callback verifikasi cookie state === URL state — TOLAK kalau tidak match (kemungkinan CSRF).
- **Auto-Link on Email Match**: Kalau Google email sama dengan email user existing di DB, LINK googleId ke user itu (bukan bikin user baru). Sekaligus set `emailVerified = now()` kalau belum verified (Google sudah verify email — trusted).
- **Auto-Verify for Google-first User**: User baru yang daftar via Google langsung `emailVerified = now()` tanpa OTP. Google sudah verify email di sisi mereka.
- **Password Nullable**: User via Google tidak punya password (`user.password === null`). Endpoint `POST /api/auth/change-password` cek: kalau `user.password === null`, tolak 400 dengan pesan "akun kamu login lewat Google". `/api/auth/me` expose `hasPassword: boolean` supaya UI bisa sembunyikan tombol Ubah Password.
- **`prompt=select_account`**: Google authorize URL selalu tampilkan account picker (biar user tidak stuck di akun Google salah yang lagi login di browser).
- **Whitelist `next` Path**: Query `?next=...` cuma boleh internal path (`/xxx`). Tolak URL external — cegah open redirect ke phishing site. Regex `/^\/[a-zA-Z0-9/\-_?=&]*$/`.
- **Never Trust `email_verified: false`**: Kalau Google response `email_verified: false` (jarang, tapi bisa terjadi kalau Google Workspace admin belum verify domain user), TOLAK login — tidak sama kepercayaan dengan email_verified: true.

## 6. Email (SMTP via `src/lib/email.js`)

- **Never Fail Register on Email Send Error**: Kalau SMTP down saat register, tetap create user, log error, dan tetap kembalikan 201 dengan pesan sukses. User bisa retry via `/api/auth/resend-otp` nanti. JANGAN rollback create — bikin user stuck tanpa akun.
- **Templates Inline CSS Only**: Email client (Gmail, Outlook, Apple Mail) strip `<style>` tag dan tidak dukung CSS variables. Semua styling di template `src/lib/email.js` HARUS inline (`style="..."` di element). Design system SUMDE BETTA (`--primary`, `--bg-card`) TIDAK berlaku di dalam mailbox.
- **Sender Verified Domain**: `SMTP_FROM` harus dari domain kita sendiri (`noreply@sumdebetta.com`), BUKAN `gmail.com`. Butuh DKIM/SPF/DMARC records untuk deliverability. Hostinger free email plan sudah include ini.
- **No Inline PII in Subject**: Subject email JANGAN memasukkan OTP, token, atau data sensitif. Subject di-index ISP untuk anti-spam; OTP di subject = OTP di logs pihak ketiga.

## 7. Cart & Purchase Flow
- **Size Selection Gating**: A product with a non-empty `sizes` JSON array MUST NOT be purchasable without a `selectedSize`. On `ProductCard`, if `sizes.length > 0`, disable "Beli Sekarang" and the cart icon and swap the CTA to "Pilih Ukuran" that navigates to `/produk/[id]`. On product detail (`ProductDetailClient`), block `addToCart` / `buyNow` when `selectedSize` is empty and surface an inline error. The server-side order API is NOT the place to enforce this — do it in the UI so users understand what's missing.
- **Cart Item Identity**: The unique key of a cart line is `productId + selectedSize`, not `productId` alone. Two units of the same product in different sizes are two lines.
- **Buy-Now Semantics**: "Beli Sekarang" bypasses the cart and jumps to `/checkout` with ONLY that item. It must NOT append to the shared cart. Confirm the checkout summary shows exactly one item.

