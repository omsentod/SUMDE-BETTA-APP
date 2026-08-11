import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendMail, passwordResetEmailTemplate } from '@/lib/email';
import { consume, clientIp } from '@/lib/rateLimit';

const TOKEN_TTL_MINUTES = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hash token dengan SHA-256 sebelum disimpan — kalau DB bocor, attacker tidak
// bisa langsung pakai token untuk reset password user lain.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(request) {
  try {
    // Rate limit per IP untuk cegah enumeration + spam email quota provider.
    const ip = clientIp(request);
    const rl = consume(`forgot:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { email } = await request.json();
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Anti-enumeration: response identik apakah user exists atau tidak.
    // User yang tidak ada di DB → response sukses palsu, tidak ada email dikirim.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

      // Invalidate token reset lama untuk user ini (yang belum dipakai).
      // User yang minta reset beberapa kali → cuma token terakhir yang jalan.
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

      const appUrl = process.env.APP_URL || 'https://sumdebetta.com';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      try {
        await sendMail({
          to: user.email,
          subject: 'Reset Password SUMDE BETTA',
          html: passwordResetEmailTemplate({
            name: user.name,
            resetUrl,
            expiresMinutes: TOKEN_TTL_MINUTES,
          }),
        });
      } catch (mailErr) {
        // Log tapi tetap balas 200 (anti-enumeration + user tidak stuck kalau
        // SMTP sementara down — bisa retry). Admin bisa cek log kalau bermasalah.
        console.error('Forgot password email send failed:', mailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Kalau email terdaftar, link reset password akan dikirim dalam 5 menit. Cek folder spam kalau tidak masuk inbox.',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
