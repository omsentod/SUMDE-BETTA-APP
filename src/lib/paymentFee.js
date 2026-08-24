/**
 * Registry of DOKU payment methods active on this merchant account, with
 * per-method fee schedule sourced from the DOKU dashboard.
 *
 * Fee interpretation:
 * - flat: fixed rupiah added to (subtotal + shippingFee)
 * - percent: percentage of (subtotal + shippingFee), rounded UP to nearest rupiah
 *
 * DOKU's actual cut is taken from the amount charged to the customer at settle
 * time. We surface the same amount as `paymentFee` so customer breakdown
 * matches merchant P&L (subject to tiny rounding on percent methods).
 *
 * `dokuType` is passed to DOKU Checkout `payment.payment_method_types` filter
 * so the hosted page only shows the picked method. If DOKU responds with
 * "invalid payment method type", the enum name here is wrong for that channel
 * — check the DOKU dashboard/API docs and update.
 *
 * `inactive: true` marks a channel that this merchant account does NOT have
 * enabled (DOKU replies "PAYMENT CHANNEL IS INACTIVE"). Such entries are kept
 * in the registry — not deleted — because historical orders still reference
 * their key, and `getMethodLabel` / `calcPaymentFee` must keep resolving for
 * order history. The picker hides them via `getSelectableMethods()`.
 *
 * Channel enums verified against the DOKU sandbox account on 2026-08-24.
 * Several VA channels need the `_BANK_` infix — without it DOKU reports the
 * channel as inactive even though the bank is enabled.
 *
 * The `inactive` flags track the PRODUCTION merchant account, not sandbox. A
 * channel that is live in production but off in sandbox still shows in the
 * picker during local dev; DOKU rejects it there, and the checkout route falls
 * back to the full catalog rather than dead-ending the user.
 */

export const PAYMENT_METHODS = {
  // ---------- QRIS ----------
  QRIS: {
    label: 'QRIS',
    category: 'QRIS',
    dokuType: 'QRIS',
    fee: { percent: 0.007 },
  },

  // ---------- Virtual Account (SNAP) ----------
  VA_BCA: { label: 'BCA Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BCA', fee: { flat: 4000 } },
  VA_BNI: { label: 'BNI Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BNI', fee: { flat: 4000 } },
  VA_BRI: { label: 'BRI Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BRI', fee: { flat: 4000 } },
  VA_MANDIRI: { label: 'Mandiri Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BANK_MANDIRI', fee: { flat: 4000 } },
  VA_BSI: { label: 'BSI Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BSI', fee: { flat: 4000 }, inactive: true },
  VA_PERMATA: { label: 'Permata Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BANK_PERMATA', fee: { flat: 4000 } },
  VA_CIMB: { label: 'CIMB Niaga Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BANK_CIMB', fee: { flat: 4000 } },
  VA_DANAMON: { label: 'Danamon Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BANK_DANAMON', fee: { flat: 4000 } },
  VA_MAYBANK: { label: 'Maybank Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_MAYBANK', fee: { flat: 4000 } },
  VA_BTN: { label: 'BTN Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BTN', fee: { flat: 4000 } },
  VA_BJB: { label: 'BJB Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_BANK_BJB', fee: { flat: 4000 } },
  VA_SINARMAS: { label: 'Sinarmas Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_SINARMAS', fee: { flat: 4000 } },
  VA_DOKU: { label: 'DOKU Virtual Account', category: 'VA', dokuType: 'VIRTUAL_ACCOUNT_DOKU', fee: { flat: 4000 } },

  // ---------- E-Wallet ----------
  EWALLET_DOKU: {
    label: 'DOKU e-Wallet',
    category: 'E-Wallet',
    dokuType: 'EMONEY_DOKU',
    fee: { percent: 0.015 },
    inactive: true, // belum di-enable di merchant account
  },

  // ---------- Paylater ----------
  PAYLATER_AKULAKU: {
    label: 'Akulaku (Cicilan)',
    category: 'Paylater',
    dokuType: 'PEER_TO_PEER_AKULAKU',
    fee: { percent: 0.015 },
    // DOKU mewajibkan customer.address/city/state/postcode untuk channel ini;
    // dikirim dari data alamat order lewat createCheckoutSession().
  },

  // ---------- Retail (Bayar di Toko) ----------
  RETAIL_ALFA: {
    label: 'Alfamart',
    category: 'Retail',
    dokuType: 'ONLINE_TO_OFFLINE_ALFA',
    fee: { flat: 5000 },
  },
  RETAIL_INDOMARET: {
    label: 'Indomaret',
    category: 'Retail',
    dokuType: 'ONLINE_TO_OFFLINE_INDOMARET',
    fee: { flat: 6500 },
  },
};

export const CATEGORY_ORDER = ['QRIS', 'VA', 'E-Wallet', 'Paylater', 'Retail'];

export const CATEGORY_LABEL = {
  QRIS: 'QRIS',
  VA: 'Virtual Account (Transfer Bank)',
  'E-Wallet': 'E-Wallet',
  Paylater: 'Bayar Nanti / Cicilan',
  Retail: 'Bayar di Toko',
};

/**
 * Calculate the fee in rupiah for a chosen method against a base amount
 * (subtotal + shippingFee). Rounded UP to the nearest rupiah.
 *
 * Percent methods use the exact break-even formula:
 *   fee = ceil(base × percent / (1 − percent))
 * Because DOKU cuts their percent from the TOTAL charged (base + fee), a
 * naive `base × percent` leaves the merchant short by roughly `base × percent²`.
 * The break-even formula makes customer_pay − doku_cut = base exactly, so
 * merchant nets the full subtotal + shipping regardless of transaction size.
 *
 * Throws if the method key is unknown so we fail loud on typos.
 */
export function calcPaymentFee(methodKey, base) {
  const method = PAYMENT_METHODS[methodKey];
  if (!method) throw new Error(`Unknown payment method: ${methodKey}`);
  if (method.fee.flat != null) return method.fee.flat;
  if (method.fee.percent != null) {
    return Math.ceil((base * method.fee.percent) / (1 - method.fee.percent));
  }
  return 0;
}

export function isValidPaymentMethod(methodKey) {
  return methodKey != null && Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, methodKey);
}

/** True kalau channel-nya hidup di merchant account (bisa ditawarkan ke user). */
export function isSelectablePaymentMethod(methodKey) {
  return isValidPaymentMethod(methodKey) && !PAYMENT_METHODS[methodKey].inactive;
}

/**
 * Registry tanpa channel yang inactive — dipakai UI picker. Entry inactive
 * tetap ada di PAYMENT_METHODS supaya order lama yang menyimpan key tersebut
 * masih bisa di-resolve label & fee-nya.
 */
export function getSelectableMethods() {
  return Object.entries(PAYMENT_METHODS)
    .filter(([, m]) => !m.inactive)
    .map(([key, m]) => ({ key, ...m }));
}

export function getMethodLabel(methodKey) {
  return PAYMENT_METHODS[methodKey]?.label || methodKey || '-';
}

export function getMethodsByCategory() {
  const out = {};
  for (const cat of CATEGORY_ORDER) out[cat] = [];
  for (const m of getSelectableMethods()) {
    if (!out[m.category]) out[m.category] = [];
    out[m.category].push(m);
  }
  return out;
}
