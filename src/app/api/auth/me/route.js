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
  const { password: _, ...userData } = user;
  return NextResponse.json({ user: userData });
}

