import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { sendMail, passwordResetEmailTemplate } from '@/lib/email';

const TOKEN_TTL_MINUTES = 30;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    // Invalidate token lama
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordReset.create({
      data: {
        tokenHash: hashToken(rawToken),
        userId: user.id,
        expiresAt,
      },
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'Permintaan Reset Password Akun SUMDE BETTA',
        html: passwordResetEmailTemplate({
          name: user.name,
          resetUrl,
          expiresMinutes: TOKEN_TTL_MINUTES,
        }),
      });
    } catch (mailErr) {
      console.error('Gagal mengirim email reset password admin trigger:', mailErr.message);
      return NextResponse.json(
        { error: 'Gagal mengirim email via server SMTP. Periksa konfigurasi SMTP.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Link reset password berhasil dikirim ke alamat email ${user.email}.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
