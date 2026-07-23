import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, isLegacyPassword, hashPassword, signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
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
