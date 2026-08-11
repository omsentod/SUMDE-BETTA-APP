import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { consume, clientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 5;

function verifyOtpHash(otpPlain, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(otpPlain, salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(derived, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  try {
    // Rate limit per IP untuk brute-force OTP (6 digit = 1M kombinasi).
    const ip = clientIp(request);
    const rl = consume(`verify-otp:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { email, otp } = await request.json();
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email dan kode OTP wajib diisi.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const record = await prisma.emailVerification.findUnique({ where: { email: normalizedEmail } });

    if (!record) {
      return NextResponse.json(
        { error: 'Kode tidak valid atau kedaluwarsa. Minta kode baru.' },
        { status: 400 }
      );
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Kode sudah kedaluwarsa. Minta kode baru.' },
        { status: 400 }
      );
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan salah. Minta kode baru.' },
        { status: 400 }
      );
    }

    if (!verifyOtpHash(String(otp), record.otp)) {
      await prisma.emailVerification.update({
        where: { email: normalizedEmail },
        data: { attempts: { increment: 1 } },
      });
      const remaining = MAX_ATTEMPTS - (record.attempts + 1);
      return NextResponse.json(
        { error: `Kode salah. Sisa ${Math.max(0, remaining)} kesempatan.` },
        { status: 400 }
      );
    }

    // Cari user yang match email + tandai verified. Hapus record OTP.
    // Semua atomic supaya tidak ada state setengah jadi (misal verified tapi
    // OTP masih tersimpan → resend nanti gagal karena timestamp lama).
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.emailVerification.delete({ where: { email: normalizedEmail } }),
    ]);

    // Auto-login setelah verify — customer experience lebih smooth.
    const token = await signSession({ id: user.id, role: user.role });
    const { password: _, ...userData } = user;
    const res = NextResponse.json({ ...userData, emailVerified: new Date() });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
