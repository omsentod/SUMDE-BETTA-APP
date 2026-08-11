import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { consume, clientIp } from '@/lib/rateLimit';

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(request) {
  try {
    // Rate limit per IP untuk brute-force token attempt.
    const ip = clientIp(request);
    const rl = consume(`reset:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { token, newPassword } = await request.json();
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token dan password baru wajib diisi.' }, { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }

    const record = await prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(String(token)) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Link reset tidak valid atau sudah kedaluwarsa. Minta ulang link reset.' },
        { status: 400 }
      );
    }

    // Atomic: update password + mark token used dalam satu transaction.
    // Kalau salah satu gagal, dua-duanya rollback — tidak ada state setengah jadi.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashPassword(newPassword) },
      }),
      prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
