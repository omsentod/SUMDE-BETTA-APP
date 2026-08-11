import crypto from 'crypto';

// Google OAuth 2.0 wrapper untuk SUMDE-BETTA-APP.
//
// Flow "authorization code":
//   1. UI klik "Login dengan Google" → GET /api/auth/google
//   2. Server generate state (CSRF) + redirect ke Google consent URL
//   3. User pilih akun Google, allow permissions
//   4. Google redirect balik ke /api/auth/google/callback?code=...&state=...
//   5. Server verify state, tukar code jadi access_token, ambil userinfo,
//      create/link user, issue session cookie
//
// Env vars:
//   GOOGLE_CLIENT_ID     - dari Google Cloud Console → Credentials
//   GOOGLE_CLIENT_SECRET - sama
//   GOOGLE_REDIRECT_URI  - contoh https://sumdebetta.com/api/auth/google/callback

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function config() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    const err = new Error(
      'Google OAuth belum di-konfigurasi. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.'
    );
    err.status = 500;
    throw err;
  }
  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI };
}

// Random string sebagai CSRF state. Disimpan sementara di httpOnly cookie
// dan dibandingkan saat callback masuk — mencegah attacker menipu user untuk
// login ke akun mereka via craft URL callback.
export function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * URL untuk redirect user ke Google consent. Include state untuk CSRF verify.
 */
export function buildAuthUrl({ state, redirectAfter }) {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = config();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: `${state}:${redirectAfter || ''}`, // titik dua pisah state|next path
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Tukar `code` (dari Google callback) jadi access_token + id_token.
 */
export async function exchangeCode(code) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = config();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Gagal tukar code Google.');
    err.status = 400;
    throw err;
  }
  return data; // { access_token, id_token, expires_in, ... }
}

/**
 * Ambil profil user via access_token. Return { sub, email, email_verified, name, picture }.
 */
export async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Gagal ambil profil Google.');
    err.status = 502;
    throw err;
  }
  if (!data.email || !data.email_verified) {
    const err = new Error('Email Google belum diverifikasi. Login pakai email/password saja.');
    err.status = 400;
    throw err;
  }
  return data;
}

// Cookie name untuk simpan state CSRF di /api/auth/google, dibaca di /callback.
export const OAUTH_STATE_COOKIE = 'sumde-oauth-state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 menit

export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  };
}
