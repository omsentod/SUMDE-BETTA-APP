import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { name, price, category, gender, form, coloration, description, image, isPremium, statsForm, statsColor, statsSpirit, isSold } = await request.json();
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (category !== undefined) dataToUpdate.category = category;
    if (gender !== undefined) dataToUpdate.gender = gender;
    if (form !== undefined) dataToUpdate.form = form;
    if (coloration !== undefined) dataToUpdate.coloration = coloration;
    if (description !== undefined) dataToUpdate.description = description;
    if (image !== undefined) dataToUpdate.image = image;
    if (isPremium !== undefined) dataToUpdate.isPremium = Boolean(isPremium);
    if (statsForm !== undefined) dataToUpdate.statsForm = statsForm;
    if (statsColor !== undefined) dataToUpdate.statsColor = statsColor;
    if (statsSpirit !== undefined) dataToUpdate.statsSpirit = statsSpirit;
    if (isSold !== undefined) dataToUpdate.isSold = Boolean(isSold);
    const updatedProduct = await prisma.product.update({ where: { id }, data: dataToUpdate });
    return NextResponse.json(updatedProduct);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await prisma.orderItem.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: 'Produk berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
