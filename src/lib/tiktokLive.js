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
