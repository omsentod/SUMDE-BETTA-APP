import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function DELETE(request, { params }) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { id } = await params;
    const basket = await prisma.tikTokLiveBasket.findUnique({ where: { id } });
    if (!basket) {
      return NextResponse.json({ error: 'Keranjang live tidak ditemukan.' }, { status: 404 });
    }
    if (basket.status !== 'OPEN') {
      return NextResponse.json({ error: 'Hanya keranjang yang belum di-checkout yang dapat dihapus.' }, { status: 400 });
    }

    await prisma.tikTokLiveBasket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
