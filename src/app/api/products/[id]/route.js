import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

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
    await requireAdmin(request);
    const { id } = await params;
    const { name, price, category, gender, form, coloration, description, image, isPremium, statsForm, age, statsSpirit, isSold, quantity, sizes } = await request.json();
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
    if (age !== undefined) dataToUpdate.age = age;
    if (statsSpirit !== undefined) dataToUpdate.statsSpirit = statsSpirit;
    if (isSold !== undefined) dataToUpdate.isSold = Boolean(isSold);
    if (quantity !== undefined) {
      const qty = parseInt(quantity);
      dataToUpdate.quantity = qty;
      dataToUpdate.isSold = qty === 0;
    }
    if (sizes !== undefined) dataToUpdate.sizes = sizes;
    const updatedProduct = await prisma.product.update({ where: { id }, data: dataToUpdate });
    return NextResponse.json(updatedProduct);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requireAdmin(request);
    const { id } = await params;

    // If the product has ever been ordered, keep the row (and its OrderItems)
    // so past invoices stay intact — flip isArchived instead. Otherwise a
    // clean hard-delete is safe.
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      await prisma.product.update({ where: { id }, data: { isArchived: true } });
      return NextResponse.json({ message: 'Produk diarsipkan (memiliki riwayat pesanan).', archived: true });
    }
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: 'Produk berhasil dihapus.', archived: false });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
