import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { syncUserProfileFromAddress } from '@/lib/address';

/**
 * PUT /api/admin/users/[id]/addresses/[addressId]
 * Admin memperbarui data alamat tersimpan milik pengguna.
 */
export async function PUT(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id, addressId } = await params;

    const existingAddr = await prisma.address.findFirst({
      where: { id: addressId, userId: id },
    });

    if (!existingAddr) {
      return NextResponse.json({ error: 'Alamat tidak ditemukan untuk user ini.' }, { status: 404 });
    }

    const {
      label,
      recipientName,
      phone,
      streetAddress,
      rtRw,
      province,
      city,
      district,
      village,
      postalCode,
      isDefault,
    } = await request.json();

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: id },
        data: { isDefault: false },
      });
    }

    const fieldsToUpdate = {};
    if (label !== undefined) fieldsToUpdate.label = String(label).trim();
    if (recipientName !== undefined) fieldsToUpdate.recipientName = String(recipientName).trim();
    if (phone !== undefined) fieldsToUpdate.phone = String(phone).trim();
    if (streetAddress !== undefined) fieldsToUpdate.streetAddress = String(streetAddress).trim();
    if (rtRw !== undefined) fieldsToUpdate.rtRw = String(rtRw).trim();
    if (province !== undefined) fieldsToUpdate.province = String(province).trim();
    if (city !== undefined) fieldsToUpdate.city = String(city).trim();
    if (district !== undefined) fieldsToUpdate.district = String(district).trim();
    if (village !== undefined) fieldsToUpdate.village = String(village).trim();
    if (postalCode !== undefined) {
      const cleaned = String(postalCode || '').trim();
      if (!/^\d{5}$/.test(cleaned)) {
        return NextResponse.json({ error: 'Kode pos wajib terdiri dari 5 digit angka.' }, { status: 400 });
      }
      fieldsToUpdate.postalCode = cleaned;
    }
    if (isDefault !== undefined) fieldsToUpdate.isDefault = Boolean(isDefault);

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: fieldsToUpdate,
    });

    if (updated.isDefault) {
      await syncUserProfileFromAddress(id, updated);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]/addresses/[addressId]
 * Admin menghapus alamat dari buku alamat pengguna.
 */
export async function DELETE(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id, addressId } = await params;

    const existingAddr = await prisma.address.findFirst({
      where: { id: addressId, userId: id },
    });

    if (!existingAddr) {
      return NextResponse.json({ error: 'Alamat tidak ditemukan untuk user ini.' }, { status: 404 });
    }

    await prisma.address.delete({ where: { id: addressId } });

    // Jika yang dihapus adalah alamat default, tunjuk alamat lain menjadi default
    if (existingAddr.isDefault) {
      const nextDefault = await prisma.address.findFirst({
        where: { userId: id },
        orderBy: { createdAt: 'asc' },
      });
      if (nextDefault) {
        await prisma.address.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
        await syncUserProfileFromAddress(id, nextDefault);
      }
    }

    return NextResponse.json({ message: 'Alamat berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
