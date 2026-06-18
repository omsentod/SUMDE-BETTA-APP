import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const sanitizedUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json(sanitizedUsers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, name, phone, streetAddress, rtRw, province, city, district, village, postalCode, role } = await request.json();
    if (!id) return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
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
    if (role !== undefined) dataToUpdate.role = role;
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
    if (!id) return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: 'User berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
