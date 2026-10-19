---
name: anti-ai-slop-ui
description: Design taste guidelines and anti-AI-slop rules for SUMDE-BETTA. Invoke when building or refactoring UI components, toasts, dialogs, forms, buttons, empty states, micro-copy, or styling to ensure human-crafted, premium minimalism (Apple/Linear/Vercel/Stripe caliber) and eliminate tacky AI generation artifacts.
---

# Anti-AI-Slop UI & Design Taste Guide

This document defines the strict aesthetic standard for SUMDE-BETTA. It codifies the difference between generic, over-engineered "AI Slop" and clean, restrained, high-craft human engineering.

---

## 1. Core Principles: What is "AI Slop" vs Premium Design?

| "AI Slop" Trap (Banned) | Premium Human Design (Enforced) |
| :--- | :--- |
| **Brand Watermarking**: Slapping brand tags on internal components (e.g. `SUMDE BETTA • KONFIRMASI`, `SUMDE BETTA` tag inside every toast card). | **Restrained Identity**: Brand logo belongs in the Navbar and Favicon. Modals, toasts, tables, and forms are clean, unbranded tools. |
| **Rainbow Countdown Bars**: Animated gradient progress bars (`linear-gradient(90deg, ...)` countdown) at the bottom of toasts. | **Calm Notifications**: Auto-dismissing cards with smooth opacity/slide transition. No distracting progress meters. |
| **Forced Boilerplate Headings**: Forcing generic labels like `PERINGATAN`, `PERHATIAN`, `INFORMASI`, `BERHASIL` above a simple 1-sentence message. | **Single Clear Sentence**: The message speaks for itself (e.g., *"Pilih kurir pengiriman terlebih dahulu"*). Only use a title if there is distinct body copy. |
| **Spammy Toasts**: Firing toast popups on mundane micro-actions (e.g. clicking a disabled dropdown, tab change, focus event). | **Silent Contextual Feedback**: Disabled fields use subtle cursor styling and quiet inline text helpers. Toasts are strictly for async events (Save, Delete, Network error, Checkout). |
| **Excessive Halos & 3D Glows**: Heavy `box-shadow: 0 0 25px rgba(...)` on every card, modal, or button. | **Subtle Ambient Shadows**: Real-world physics (`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08)`). Glow is reserved exclusively for input focus rings. |
| **Pompous AI Copy**: Grandiose phrasing (*"Akuisisi Spesimen Elit"*, *"Sistem Tindakan Resmi"*). | **Crisp, Human Indonesian**: Professional e-commerce copy (*"Pilih Ukuran"*, *"Lanjutkan ke Pembayaran"*, *"Hapus dari Keranjang"*). |
| **Giant Centered Dialogs**: Giant 60px circle icon with glowing rings, centered text, and 3D gradient buttons. | **Crisp, Focused Dialogs**: Clean title, concise 1-line description, right-aligned buttons (*Batal* subtle outline + *Aksi* solid background). |
| **Text Emoticons & Emojis**: Using raw emojis (`⚠️`, `💾`, `★`, `🛒`, `❌`, `✅`) in markup. | **Monochrome Vector SVG**: Clean SVG icons with matching stroke-width and line-height. |
| **CSS camelCase Errors**: Writing `fontSize: 0.9rem;` inside `.css` or `.module.css`. | **Valid CSS Syntax**: Always kebab-case (`font-size: 0.9rem;`). |

---

## 2. Component Design Specs

### A. Toast Notifications (`ToastContainer`)
- **Position**: `bottom-right` (viewport `bottom: 1.5rem; right: 1.5rem;`), stacked `column-reverse`.
- **Mobile**: Float above the mobile navigation bar (`bottom: calc(76px + env(safe-area-inset-bottom, 0)); left: 1rem; right: 1rem;`).
- **Dimensions**: Compact pill/card (`max-width: 380px`, padding `0.75rem 1rem`, border-radius `0.625rem`).
- **Visuals**:
  - `background: var(--bg-card); border: 1px solid var(--border-color);`
  - Crisp 16px SVG icon (green check for success, amber triangle for warning, red circle for error, primary for info).
  - Clean font size: `0.8125rem` (13px), line-height `1.4`.
  - Minimal close button (`opacity: 0.6; hover: 1.0;`).
- **Rule**: NEVER add brand tags, countdown stripes, or multi-story badges to toast cards.

### B. Confirmation Modals (`ConfirmModal`)
- **Backdrop**: Subtle blur (`background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);`).
- **Card**: Clean surface (`background: var(--modal-bg, var(--bg-card)); border-radius: 0.75rem; max-width: 400px; padding: 1.5rem;`).
- **Header**:
  - Title: `1.125rem`, `font-weight: 600`, `line-height: 1.35`.
  - Message: `0.875rem`, `color: var(--text-muted)`.
- **Buttons**:
  - Right-aligned (`justify-content: flex-end; gap: 0.625rem;`).
  - *Cancel*: Ghost/border (`background: transparent; border: 1px solid var(--border-color);`).
  - *Confirm*: Solid background (`var(--primary)` or `#EF4444` for danger). No 3D gradients.
- **Rule**: NEVER center giant warning emojis or badge titles like `"SUMDE BETTA • KONFIRMASI"`.

### C. Dropdown Selects (`select`, `SearchableSelect`)
- **Appearance**: Always `appearance: none; -webkit-appearance: none;`.
- **Chevron**: Inline SVG data-URI with brand accent (`#FF6B35`), positioned `right 0.875rem center`.
- **SearchableSelect Popover**:
  - Max height `260px` with custom slim scrollbar.
  - Search input pinned at top with auto-focus.
  - Arrow icon: Vector SVG `<polyline points="6 9 12 15 18 9" />` that rotates 180deg when open (NEVER raw `▼`).

### D. Empty States
- **Layout**: Always `display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.25rem;`.
- **Hierarchy**:
  1. Subtle monochrome SVG icon (`opacity: 0.5; width: 48-64px`).
  2. Serif or clean heading (`1.8rem - 2.2rem`).
  3. Context-specific explanation (`font-size: 0.95rem; color: var(--text-muted); max-width: 420px`).
  4. Single primary CTA button (only if actionable, e.g. "Jelajahi Galeri").
- **Rule**: NEVER render identical empty states across different filter tabs.

---

## 3. Micro-Copy Standards (Indonesian)

| Purpose | AI Slop Copy (Avoid) | Professional Human Copy (Use) |
| :--- | :--- | :--- |
| **Missing courier** | "Peringatan Sistem: Kurir Pengiriman Wajib Dipilih Sebelum Melakukan Akuisisi." | "Pilih kurir pengiriman terlebih dahulu." |
| **Incomplete address** | "Data Belum Lengkap: Mohon Lengkapi Seluruh Parameter Pengiriman Resmi." | "Lengkapi seluruh detail alamat pengiriman." |
| **Cancel transaction** | "Konfirmasi Pembatalan: Apakah Anda Yakin Ingin Mengakhiri Transaksi Akuisisi Ini?" | "Batalkan transaksi pembayaran ini?" |
| **Delete cart item** | "Peringatan Hapus: Konfirmasi Penghapusan Spesimen Pilihan Dari Keranjang." | "Hapus item ini dari pesanan?" |
| **Saved address** | "Sukses: Data Alamat Berhasil Didaftarkan Ke Dalam Basis Data Alamat." | "Alamat berhasil disimpan ke buku alamat." |
| **Export report** | "Sukses: File Laporan Penjualan Excel Telah Berhasil Digenerate." | "Laporan berhasil diekspor." |

---

## 4. Pre-Commit Taste Checklist
Before concluding any UI work, check:
1. [ ] Did you put any brand name or watermark on internal components? (If yes, **DELETE IT**).
2. [ ] Are there animated progress bars or rainbow gradients on notifications? (If yes, **DELETE THEM**).
3. [ ] Did you use any raw emojis (`⚠️`, `★`, `💾`, etc.) instead of clean SVG vectors? (If yes, **REPLACE WITH SVG**).
4. [ ] Did you write camelCase inside CSS files (e.g. `fontSize:`)? (If yes, **FIX TO KEBAB-CASE**).
5. [ ] Is the notification positioned unobtrusively (bottom-right on desktop, above bottom nav on mobile)?
6. [ ] Did you test both Light Mode and Dark Mode (`[data-theme="dark"]`) using CSS variables?
