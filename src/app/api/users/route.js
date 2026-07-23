import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Resolve the requesting user from a client-asserted id.
 *
 * NOTE: This is a temporary band-aid. The project has no server-side session yet
 * (identity is asserted by the client), so this is NOT cryptographically strong —
 * it will be replaced by the real fix in the Session Migration (httpOnly + JWT).
 * We always re-read the role from the DB and never trust a client-supplied role.
 */
async function resolveRequester(requesterId) {
  if (!requesterId) return null;
  return prisma.user.findUnique({
    where: { id: requesterId },
    select: { id: true, role: true }
  });
}

export async function GET(request) {
  try {
    // Listing every user (emails, addresses, roles) is an admin-only operation.
    const requesterId = request.nextUrl.searchParams.get('requesterId');
    const requester = await resolveRequester(requesterId);
    if (!requester) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat melihat daftar user.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const sanitizedUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json(sanitizedUsers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, requesterId, name, phone, streetAddress, rtRw, province, city, district, village, postalCode, role } = await request.json();
    if (!id) return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });

    const requester = await resolveRequester(requesterId);
    if (!requester) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const isAdmin = requester.role === 'admin';
    const isSelf = requester.id === id;

    // A user may only edit their own profile; admins may edit anyone.
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Anda tidak dapat mengubah data user lain.' }, { status: 403 });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (streetAddress !== undefined) dataToUpdate.streetAddress = streetAddress;
    if (rtRw !== undefined) dataToUpdate.rtRw = rtRw;
    if (province !== undefined) dataToUpdate.province = province;
    if (city !== undefined) dataToUpdate.city = city;
    if (district !== undefined) dataToUpdate.district = district;
    if (village !== undefined) dataToUpdate.village = village;
    if (postalCode !== undefined) dataToUpdate.postalCode = postalCode;

    // CRITICAL: role changes are admin-only. This closes the privilege-escalation
    // hole where anyone could set their own role to "admin".
    if (role !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Hanya admin yang dapat mengubah role user.' }, { status: 403 });
      }
      dataToUpdate.role = role;
    }

    const updatedUser = await prisma.user.update({ where: { id }, data: dataToUpdate });
    const { password: _, ...userData } = updatedUser;
    return NextResponse.json(userData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const requesterId = searchParams.get('requesterId');
    if (!id) return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });

    // Deleting users is an admin-only operation.
    const requester = await resolveRequester(requesterId);
    if (!requester) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat menghapus user.' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: 'User berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
