import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 400 });
    }
    const user = await prisma.user.create({
      data: { email, password, name, role: 'customer' }
    });
    const { password: _, ...userData } = user;
    return NextResponse.json(userData, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
