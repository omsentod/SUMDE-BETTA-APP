import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, isLegacyPassword, hashPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { consume, clientIp } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    // Rate limit per IP to blunt online brute-force / credential-stuffing.
    const ip = clientIp(request);
    const rl = consume(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
    }

    // Block login sampai email diverifikasi (AGENTS.md §Auth). Kode 403 +
    // shape khusus supaya UI tahu redirect ke /verify-email dengan email.
    // Admin di-whitelist supaya seeded/legacy admin tetap bisa login untuk
    // manage — production admin sebaiknya tetap verify manual via UI.
    if (!user.emailVerified && user.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Email belum diverifikasi. Cek inbox untuk kode OTP atau minta kode baru.',
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Seamlessly upgrade a legacy plaintext password to a hash on first login
    if (isLegacyPassword(user.password)) {
      await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
    }

    const token = await signSession({ id: user.id, role: user.role });
    const { password: _, ...userData } = user;

    const res = NextResponse.json(userData);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
