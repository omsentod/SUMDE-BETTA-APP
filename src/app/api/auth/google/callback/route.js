import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  exchangeCode,
  fetchUserInfo,
  OAUTH_STATE_COOKIE,
} from '@/lib/googleAuth';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

// GET /api/auth/google/callback?code=...&state=...
// 1. Verify state (CSRF check terhadap cookie)
// 2. Exchange code → tokens
// 3. Fetch userinfo (email verified oleh Google)
// 4. Cari user by googleId OR email → link/create/login
// 5. Issue session cookie + redirect ke `next` path
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // User klik "cancel" di consent screen — kembali ke login dengan info.
  if (errorParam) {
    return NextResponse.redirect(new URL(`/login?googleError=${encodeURIComponent(errorParam)}`, request.url));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/login?googleError=missing_params', request.url));
  }

  // State format: "<random>:<nextPath>". Bandingkan random dengan cookie.
  const [state, nextPathRaw] = stateParam.split(':');
  if (!cookieState || state !== cookieState) {
    // Kemungkinan CSRF attempt atau state cookie kedaluwarsa.
    return NextResponse.redirect(new URL('/login?googleError=state_mismatch', request.url));
  }
  const next = nextPathRaw && /^\/[a-zA-Z0-9/\-_?=&]*$/.test(nextPathRaw) ? nextPathRaw : '/customer/dashboard';

  try {
    const tokens = await exchangeCode(code);
    const info = await fetchUserInfo(tokens.access_token);
    // info: { sub, email, email_verified, name, picture, ... }

    const normalizedEmail = String(info.email).toLowerCase();
    const googleId = String(info.sub);

    // 1. Cari user yang sudah punya googleId ini (returning Google user).
    let user = await prisma.user.findUnique({ where: { googleId } });

    // 2. Kalau belum ada, cari by email — auto-link ke akun email/password
    //    yang sudah verified. Kalau belum verified, tetap link + auto-verify
    //    (Google sudah verify email jadi trusted).
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        user = await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId,
            emailVerified: existing.emailVerified || new Date(),
          },
        });
      }
    }

    // 3. User beneran baru — create dengan Google info (password null,
    //    emailVerified langsung karena Google sudah verify).
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: info.name || normalizedEmail.split('@')[0],
          password: null,
          role: 'customer',
          googleId,
          emailVerified: new Date(),
        },
      });
    }

    const token = await signSession({ id: user.id, role: user.role });
    const res = NextResponse.redirect(new URL(next, request.url));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    // Hapus state cookie — sudah dipakai.
    res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/login?googleError=${encodeURIComponent(error.message || 'unknown')}`, request.url)
    );
  }
}
