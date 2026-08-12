import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

// Server-trusted session for SUMDE-BETTA-APP.
// Replaces the old "client asserts its own userId" model: on login the server
// issues a signed JWT stored in an httpOnly cookie that JS cannot read or forge.

export const SESSION_COOKIE = 'sumde-session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not configured.');
  return new TextEncoder().encode(s);
}

// ---------------------------------------------------------------------------
// Password hashing — Node's built-in scrypt (no native/3rd-party dependency).
// Stored format: "scrypt:<salt-hex>:<hash-hex>"
// ---------------------------------------------------------------------------
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(derived, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Legacy plaintext password (created before hashing existed).
  // Use a constant-time comparison so we don't leak length/prefix information
  // via response timing.
  const a = Buffer.from(stored);
  const b = Buffer.from(plain);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function isLegacyPassword(stored) {
  return !!stored && !stored.startsWith('scrypt:');
}

// ---------------------------------------------------------------------------
// Session token (JWT, HS256)
// ---------------------------------------------------------------------------
export async function signSession({ id, role }) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers — set on a NextResponse via res.cookies.set(...)
// ---------------------------------------------------------------------------
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearedCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 };
}

// ---------------------------------------------------------------------------
// Reading the session inside a route handler (NextRequest)
// ---------------------------------------------------------------------------
export async function getSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Guards throw an error carrying a `.status`; wrap route bodies in try/catch
// and use authErrorResponse() to convert them.
export async function requireUser(request) {
  const session = await getSession(request);
  if (!session) {
    const err = new Error('Autentikasi diperlukan.');
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireAdmin(request) {
  const session = await requireUser(request);
  if (session.role !== 'admin') {
    const err = new Error('Akses khusus admin.');
    err.status = 403;
    throw err;
  }
  return session;
}
