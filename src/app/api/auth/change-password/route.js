import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser, verifyPassword, hashPassword } from '@/lib/auth';
import { consume } from '@/lib/rateLimit';

export async function POST(request) {
  try {
    const session = await requireUser(request);

    // Guard: kalau session cookie dicuri, batasi guessing current password.
    const rl = consume(`change-pw:${session.id}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Password lama dan baru wajib diisi.' }, { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password lama.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }
    // User via Google OAuth tidak punya password di sistem kita.
    // Suruh mereka ganti password di Google Account Settings.
    if (!user.password) {
      return NextResponse.json(
        { error: 'Akun kamu login lewat Google. Ganti password di Google Account Settings.' },
        { status: 400 }
      );
    }
    if (!verifyPassword(currentPassword, user.password)) {
      return NextResponse.json({ error: 'Password lama salah.' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { password: hashPassword(newPassword) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
