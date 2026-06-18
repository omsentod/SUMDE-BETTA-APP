import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    return NextResponse.json(addresses);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault } = await request.json();
    if (!userId || !recipientName || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
      return NextResponse.json({ error: 'Data alamat tidak lengkap.' }, { status: 400 });
    }
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const count = await prisma.address.count({ where: { userId } });
    const address = await prisma.address.create({
      data: { userId, label: label || 'Rumah', recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault: isDefault || count === 0 }
    });
    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
