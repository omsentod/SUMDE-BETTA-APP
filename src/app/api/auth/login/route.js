import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Kredensial tidak valid.' }, { status: 401 });
    }
    const { password: _, ...userData } = user;
    return NextResponse.json(userData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
