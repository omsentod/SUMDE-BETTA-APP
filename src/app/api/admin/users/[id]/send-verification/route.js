import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { sendMail, otpEmailTemplate } from '@/lib/email';

const OTP_TTL_MINUTES = 10;

function hashOtp(otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(otp, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function POST(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email pengguna ini sudah terverifikasi sebelumnya.' },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await prisma.emailVerification.upsert({
      where: { email: user.email },
      update: { otp: hashOtp(otp), expiresAt, attempts: 0 },
      create: { email: user.email, otp: hashOtp(otp), expiresAt },
    });

    try {
      await sendMail({
        to: user.email,
        subject: 'Kode Verifikasi Email Akun SUMDE BETTA',
        html: otpEmailTemplate({
          name: user.name,
          otp,
          expiresMinutes: OTP_TTL_MINUTES,
        }),
      });
    } catch (mailErr) {
      console.error('Gagal mengirim email OTP admin trigger:', mailErr.message);
      return NextResponse.json(
        { error: 'Gagal mengirim email via server SMTP. Periksa konfigurasi SMTP.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Kode OTP verifikasi berhasil dikirim ke alamat email ${user.email}.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
