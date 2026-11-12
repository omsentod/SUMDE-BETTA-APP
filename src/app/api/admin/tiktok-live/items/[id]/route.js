import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function PATCH(request, { params }) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { id } = await params;
    const body = await request.json();

    const item = await prisma.tikTokLiveItem.findUnique({
      where: { id },
      include: { basket: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'Item tidak ditemukan.' }, { status: 404 });
    }
    if (item.basket?.status !== 'OPEN') {
      return NextResponse.json({ error: 'Item pada keranjang yang sudah di-checkout tidak dapat diubah.' }, { status: 400 });
    }

    const data = {};
    if (body.name !== undefined) {
      const cleanName = String(body.name).trim().slice(0, 200);
      if (!cleanName) {
        return NextResponse.json({ error: 'Nama item tidak boleh kosong.' }, { status: 400 });
      }
      data.name = cleanName;
    }
    if (body.price !== undefined) {
      const parsedPrice = Number(body.price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000_000) {
        return NextResponse.json({ error: 'Harga tidak valid.' }, { status: 400 });
      }
      data.price = Math.round(parsedPrice);
    }
    if (body.quantity !== undefined) {
      const parsedQty = parseInt(body.quantity, 10);
      if (!Number.isInteger(parsedQty) || parsedQty <= 0 || parsedQty > 1000) {
        return NextResponse.json({ error: 'Kuantitas harus 1 - 1000.' }, { status: 400 });
      }
      data.quantity = parsedQty;
    }
    if (body.note !== undefined) {
      data.note = body.note ? String(body.note).trim().slice(0, 300) : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.tikTokLiveItem.update({
        where: { id },
        data,
      });
      await tx.tikTokLiveBasket.update({
        where: { id: item.basketId },
        data: { updatedAt: new Date() },
      });
      return next;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { id } = await params;
    const item = await prisma.tikTokLiveItem.findUnique({
      where: { id },
      include: { basket: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'Item tidak ditemukan.' }, { status: 404 });
    }
    if (item.basket?.status !== 'OPEN') {
      return NextResponse.json({ error: 'Item pada keranjang yang sudah di-checkout tidak dapat dihapus.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.tikTokLiveItem.delete({ where: { id } });
      const remaining = await tx.tikTokLiveItem.count({ where: { basketId: item.basketId } });
      if (remaining === 0) {
        await tx.tikTokLiveBasket.delete({ where: { id: item.basketId } });
        return { deletedBasket: true };
      }
      await tx.tikTokLiveBasket.update({
        where: { id: item.basketId },
        data: { updatedAt: new Date() },
      });
      return { deletedBasket: false };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
