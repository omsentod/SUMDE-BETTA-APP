import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Source of truth for the client's current user, backed by the httpOnly cookie
// (replaces reading the user out of localStorage).
export async function GET(request) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) {
    return NextResponse.json({ user: null });
  }
  const { password, ...userData } = user;
  // Expose flags derived dari kolom sensitif — client butuh tahu tapi tidak
  // boleh lihat nilai actual.
  // - hasPassword: user bisa login pakai email/password (kalau false → cuma Google)
  // - hasGoogle: user sudah link akun Google
  return NextResponse.json({
    user: {
      ...userData,
      hasPassword: !!password,
      hasGoogle: !!user.googleId,
    },
  });
}

