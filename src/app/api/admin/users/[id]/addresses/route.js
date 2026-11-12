import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { syncUserProfileFromAddress } from '@/lib/address';

/**
 * POST /api/admin/users/[id]/addresses
 * Admin menambahkan alamat baru ke buku alamat pengguna.
 */
export async function POST(request, { params }) {
  try {
    await requirePermission(request, ['users:update', 'users:manage']);
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
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

    const cleanedPostal = String(postalCode || '').trim();
    if (
      !recipientName ||
      !phone ||
      !streetAddress ||
      !rtRw ||
      !province ||
      !city ||
      !district ||
      !village ||
      !/^\d{5}$/.test(cleanedPostal)
    ) {
      return NextResponse.json(
        {
          error:
            'Data alamat belum lengkap atau kode pos tidak valid (wajib 5 digit angka).',
        },
        { status: 400 }
      );
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: id },
        data: { isDefault: false },
      });
    }

    const addressCount = await prisma.address.count({ where: { userId: id } });
    const shouldBeDefault = Boolean(isDefault) || addressCount === 0;

    const newAddress = await prisma.address.create({
      data: {
        userId: id,
        label: label ? String(label).trim() : 'Rumah',
        recipientName: String(recipientName).trim(),
        phone: String(phone).trim(),
        streetAddress: String(streetAddress).trim(),
        rtRw: String(rtRw).trim(),
        province: String(province).trim(),
        city: String(city).trim(),
        district: String(district).trim(),
        village: String(village).trim(),
        postalCode: cleanedPostal,
        isDefault: shouldBeDefault,
      },
    });

    if (newAddress.isDefault) {
      await syncUserProfileFromAddress(id, newAddress);
    }

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
