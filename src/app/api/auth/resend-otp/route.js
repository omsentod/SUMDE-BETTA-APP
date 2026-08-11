import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendMail, otpEmailTemplate } from '@/lib/email';
import { consume, clientIp } from '@/lib/rateLimit';

const OTP_TTL_MINUTES = 10;

function hashOtp(otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(otp, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function POST(request) {
  try {
    // Rate limit dua lapis:
    // 1. Per IP untuk cegah abuse global.
    // 2. Per email untuk cegah harass user tertentu (spam OTP ke inboxnya).
    const ip = clientIp(request);
    const rl = consume(`resend-otp-ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });
    }
    const normalizedEmail = String(email).trim().toLowerCase();

    const rlEmail = consume(`resend-otp-email:${normalizedEmail}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!rlEmail.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan untuk email ini. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rlEmail.retryAfterSec) } }
      );
    }

    // Anti-enumeration: sukses palsu kalau user tidak ada atau sudah verified.
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Kalau email terdaftar dan belum diverifikasi, kode akan dikirim.',
      });
    }

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
        html: otpEmailTemplate({ name: user.name, otp, expiresMinutes: OTP_TTL_MINUTES }),
      });
    } catch (mailErr) {
      console.error('Resend OTP email send failed:', mailErr.message);
      // Beda dari forgot-password: karena user tahu akun mereka ada dan
      // sengaja minta resend, tampilkan error email delivery bukan sukses palsu.
      return NextResponse.json(
        { error: 'Gagal kirim email. Coba lagi beberapa menit ke depan.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kode verifikasi baru dikirim ke email kamu.',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
