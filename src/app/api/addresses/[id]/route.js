import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault, userId } = await request.json();
    if (isDefault && userId) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    const fields = {};
    if (label !== undefined) fields.label = label;
    if (recipientName !== undefined) fields.recipientName = recipientName;
    if (phone !== undefined) fields.phone = phone;
    if (streetAddress !== undefined) fields.streetAddress = streetAddress;
    if (rtRw !== undefined) fields.rtRw = rtRw;
    if (province !== undefined) fields.province = province;
    if (city !== undefined) fields.city = city;
    if (district !== undefined) fields.district = district;
    if (village !== undefined) fields.village = village;
    if (postalCode !== undefined) fields.postalCode = postalCode;
    if (isDefault !== undefined) fields.isDefault = isDefault;
    const updated = await prisma.address.update({ where: { id }, data: fields });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const addr = await prisma.address.findUnique({ where: { id } });
    await prisma.address.delete({ where: { id } });
    if (addr?.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId: addr.userId }, orderBy: { createdAt: 'asc' } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return NextResponse.json({ message: 'Alamat berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
