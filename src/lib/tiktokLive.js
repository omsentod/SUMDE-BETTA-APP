import crypto from 'crypto';

export const LIVE_ITEM_PLACEHOLDER_IMAGE = '/img/betta-1.png';

export const DEFAULT_TIKTOK_ACCOUNTS = [
  { name: 'Akun Live 1', handle: '@sumdebetta.live1', orderIndex: 0 },
  { name: 'Akun Live 2', handle: '@sumdebetta.live2', orderIndex: 1 },
  { name: 'Akun Live 3', handle: '@sumdebetta.live3', orderIndex: 2 },
  { name: 'Akun Live 4', handle: '@sumdebetta.live4', orderIndex: 3 },
  { name: 'Akun Live 5', handle: '@sumdebetta.live5', orderIndex: 4 },
];

/**
 * Normalisasi username TikTok: hapus spasi, hapus awalan '@', lowercase.
 * Mengizinkan huruf, angka, titik, dan underscore (2..50 karakter).
 */
export function normalizeTikTokUsername(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!cleaned) {
    return { ok: false, username: '', error: 'Username TikTok wajib diisi.' };
  }
  if (!/^[a-z0-9._]{2,50}$/.test(cleaned)) {
    return {
      ok: false,
      username: '',
      error: 'Username TikTok hanya boleh berisi huruf, angka, titik, dan underscore (minimal 2 karakter).',
    };
  }
  return { ok: true, username: cleaned, error: null };
}

/**
 * Normalisasi handle akun TikTok tim agar selalu diawali '@' dan lowercase.
 */
export function normalizeTikTokHandle(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
  if (!cleaned || !/^[a-z0-9._]{2,50}$/.test(cleaned)) {
    return null;
  }
  return `@${cleaned}`;
}

/**
 * Kode label singkat untuk identifikasi internal admin (mis. LV-4829).
 */
export function generateClaimCode() {
  const num = crypto.randomInt(1000, 9999);
  return `LV-${num}`;
}

/**
 * Token unik kriptografis (16 karakter URL-safe) untuk link klaim privat per username.
 * Tidak dapat ditebak agar pembeli lain tidak bisa mengambil pesanan pemenang.
 */
export function generateClaimToken() {
  return crypto.randomBytes(12).toString('base64url');
}

export function isValidClaimToken(raw) {
  return /^[A-Za-z0-9_-]{12,64}$/.test(String(raw || '').trim());
}

/**
 * Ekstrak token dari link lengkap (/live/<token> atau ?token=<token>) maupun input token mentah.
 */
export function extractClaimToken(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (isValidClaimToken(trimmed)) return trimmed;

  try {
    const asUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://placeholder.local');
    const queryToken = asUrl.searchParams.get('token');
    if (queryToken && isValidClaimToken(queryToken)) return queryToken;
    const parts = asUrl.pathname.split('/').filter(Boolean);
    const liveIdx = parts.indexOf('live');
    if (liveIdx !== -1 && parts[liveIdx + 1] && isValidClaimToken(parts[liveIdx + 1])) {
      return parts[liveIdx + 1];
    }
  } catch {
    // Fallback to raw substring match
  }

  const match = trimmed.match(/\/live\/([A-Za-z0-9_-]{12,64})/);
  return match ? match[1] : '';
}

/**
 * Pastikan minimal 5 akun TikTok default tersedia saat fitur pertama kali dibuka.
 */
export async function ensureDefaultTikTokAccounts(db) {
  const count = await db.tikTokAccount.count();
  if (count > 0) return;

  await db.tikTokAccount.createMany({
    data: DEFAULT_TIKTOK_ACCOUNTS.map((acc) => ({
      name: acc.name,
      handle: acc.handle,
      orderIndex: acc.orderIndex,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}

/**
 * Normalisasi nomor WhatsApp Indonesia menjadi format wa.me resmi (628xxx).
 * Menerima format: 0812..., +62812..., 62812..., 812...
 */
export function normalizeWhatsAppNumber(raw) {
  if (!raw) {
    return { ok: false, normalized: '', display: '', error: 'Nomor WhatsApp wajib diisi.' };
  }
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) {
    return { ok: false, normalized: '', display: '', error: 'Nomor WhatsApp tidak valid.' };
  }
  if (digits.startsWith('08')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  } else if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (!digits.startsWith('62') && digits.length >= 9 && digits.length <= 13) {
    digits = '62' + digits;
  }

  if (!/^628[0-9]{7,13}$/.test(digits)) {
    return {
      ok: false,
      normalized: '',
      display: '',
      error: 'Nomor WhatsApp harus nomor seluler Indonesia yang valid (08xx / 628xx, 10-15 digit).',
    };
  }

  const localNum = '0' + digits.slice(2);
  let display = localNum;
  if (localNum.length >= 10) {
    display = `${localNum.slice(0, 4)}-${localNum.slice(4, 8)}-${localNum.slice(8)}`;
  }

  return {
    ok: true,
    normalized: digits,
    display,
    error: null,
  };
}

export function formatWhatsAppDisplay(raw) {
  if (!raw) return '';
  const norm = normalizeWhatsAppNumber(raw);
  return norm.ok ? norm.display : String(raw);
}

/**
 * Buat template teks pesan rekap checkout untuk dikirim ke pembeli via WhatsApp / DM.
 */
export function buildBuyerCheckoutMessage({ basket, appOrigin = '' }) {
  if (!basket) return '';
  const totalItems = (basket.items || []).reduce(
    (acc, it) => acc + (Number(it.quantity) || 1),
    0
  );
  const countText = totalItems > 0 ? `${totalItems} ekor ikan` : 'ikan';
  const url = `${appOrigin}/live/${basket.claimToken || ''}`;

  const accountsMap = new Map();
  if (basket.tiktokAccount) {
    accountsMap.set(basket.tiktokAccount.id || basket.tiktokAccount.handle || 'primary', basket.tiktokAccount);
  }
  (basket.items || []).forEach((it) => {
    if (it.tiktokAccount) {
      accountsMap.set(it.tiktokAccount.id || it.tiktokAccount.handle || `item-${it.id}`, it.tiktokAccount);
    }
  });
  const accounts = Array.from(accountsMap.values());
  const accountNames = accounts.map((a) => a.handle || a.name).join(' & ');
  const liveSourceText = accountNames
    ? `sesi TikTok Live (${accountNames})`
    : 'sesi TikTok Live Sumde Betta';

  return [
    `Halo kak @${basket.tiktokUsername}!`,
    ``,
    `Terima kasih sudah ikutan ${liveSourceText}.`,
    `Berikut link rekap order & keep kamu (${countText}):`,
    url,
    ``,
    `Silakan buka link di atas untuk cek rincian ikan, lengkapi alamat kirim, dan selesaikan pembayaran ya kak.`,
    `Terima kasih!`,
  ].join('\n');
}

/**
 * Buat deep link https://wa.me/628... dengan pesan rekap otomatis.
 */
export function buildBuyerWhatsAppUrl({ basket, appOrigin = '' }) {
  if (!basket?.claimToken || !basket?.whatsappNumber) return '';
  const norm = normalizeWhatsAppNumber(basket.whatsappNumber);
  if (!norm.ok) return '';
  const message = buildBuyerCheckoutMessage({ basket, appOrigin });
  return `https://wa.me/${norm.normalized}?text=${encodeURIComponent(message)}`;
}
