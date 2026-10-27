import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { syncUserProfileFromAddress } from '@/lib/address';

export async function GET(request) {
  try {
    const session = await requireUser(request);
    const addresses = await prisma.address.findMany({
      where: { userId: session.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }]
    });
    return NextResponse.json(addresses);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const session = await requireUser(request);
    const userId = session.id;
    const { label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault } = await request.json();
    const cleanedPostal = String(postalCode || '').trim();
    if (!recipientName || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !/^\d{5}$/.test(cleanedPostal)) {
      return NextResponse.json({ error: 'Data alamat tidak lengkap atau format kode pos tidak valid (wajib 5 digit).' }, { status: 400 });
    }
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const count = await prisma.address.count({ where: { userId } });
    const address = await prisma.address.create({
      data: { userId, label: label || 'Rumah', recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode: cleanedPostal, isDefault: isDefault || count === 0 }
    });
    // Mirror the default address into the User profile columns
    if (address.isDefault) {
      await syncUserProfileFromAddress(userId, address);
    }
    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
