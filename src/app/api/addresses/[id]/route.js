import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { syncUserProfileFromAddress } from '@/lib/address';

// Ensure the address exists and belongs to the caller (or caller is admin).
async function loadOwnedAddress(id, session) {
  const addr = await prisma.address.findUnique({ where: { id } });
  if (!addr) return { error: NextResponse.json({ error: 'Alamat tidak ditemukan.' }, { status: 404 }) };
  if (addr.userId !== session.id && session.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Anda tidak memiliki akses ke alamat ini.' }, { status: 403 }) };
  }
  return { addr };
}

export async function PUT(request, { params }) {
  try {
    const session = await requireUser(request);
    const { id } = await params;
    const { addr, error } = await loadOwnedAddress(id, session);
    if (error) return error;

    const { label, recipientName, phone, streetAddress, rtRw, province, city, district, village, postalCode, isDefault } = await request.json();
    if (isDefault) {
      await prisma.address.updateMany({ where: { userId: addr.userId }, data: { isDefault: false } });
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
    // Keep the User profile in sync with the default address
    if (updated.isDefault) {
      await syncUserProfileFromAddress(updated.userId, updated);
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireUser(request);
    const { id } = await params;
    const { addr, error } = await loadOwnedAddress(id, session);
    if (error) return error;

    await prisma.address.delete({ where: { id } });
    if (addr.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId: addr.userId }, orderBy: { createdAt: 'asc' } });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
        await syncUserProfileFromAddress(next.userId, next);
      }
    }
    return NextResponse.json({ message: 'Alamat berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
