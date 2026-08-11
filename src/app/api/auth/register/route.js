import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { sendMail, otpEmailTemplate } from '@/lib/email';
import { consume, clientIp } from '@/lib/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MINUTES = 10;

// OTP di-hash sebelum simpan — kalau DB bocor, attacker tidak bisa langsung
// pakai OTP orang lain. Pakai scrypt seperti password (mirror src/lib/auth.js).
function hashOtp(otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(otp, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function generateOtp() {
  // 6 digit angka, cukup entropy untuk 10 menit + rate-limit 5 attempts.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function POST(request) {
  try {
    const ip = clientIp(request);
    const rl = consume(`register:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan registrasi. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { email, password, name } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
    }
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 400 });
    }

    // User dibuat dengan emailVerified=null. Login akan diblokir sampai OTP
    // di-verify di /api/auth/verify-otp — lihat AGENTS.md §Auth.
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashPassword(password),
        name,
        role: 'customer',
        emailVerified: null,
      }
    });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await prisma.emailVerification.upsert({
      where: { email: normalizedEmail },
      update: { otp: hashOtp(otp), expiresAt, attempts: 0 },
      create: { email: normalizedEmail, otp: hashOtp(otp), expiresAt, attempts: 0 },
    });

    try {
      await sendMail({
        to: normalizedEmail,
        subject: 'Kode Verifikasi SUMDE BETTA',
        html: otpEmailTemplate({ name, otp, expiresMinutes: OTP_TTL_MINUTES }),
      });
    } catch (mailErr) {
      // Log tapi jangan gagalkan register — user bisa retry via resend-otp.
      console.error('Register OTP email send failed:', mailErr.message);
    }

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      message: 'Registrasi berhasil. Cek email untuk kode verifikasi.',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
