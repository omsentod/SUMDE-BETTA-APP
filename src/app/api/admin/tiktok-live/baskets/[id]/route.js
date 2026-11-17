import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { normalizeWhatsAppNumber } from '@/lib/tiktokLive';

export async function PATCH(request, { params }) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { id } = await params;
    const body = await request.json();
    const { whatsappNumber, markWaSent, toggleWaSent } = body;

    const basket = await prisma.tikTokLiveBasket.findUnique({ where: { id } });
    if (!basket) {
      return NextResponse.json({ error: 'Keranjang live tidak ditemukan.' }, { status: 404 });
    }

    const updateData = { updatedAt: new Date() };

    if (whatsappNumber !== undefined) {
      if (whatsappNumber === null || String(whatsappNumber).trim() === '') {
        updateData.whatsappNumber = null;
      } else {
        const trimmed = String(whatsappNumber).trim();
        const norm = normalizeWhatsAppNumber(trimmed);
        if (!norm.ok) {
          return NextResponse.json({ error: norm.error }, { status: 400 });
        }
        updateData.whatsappNumber = norm.normalized;
      }
    }

    if (toggleWaSent === true) {
      if (basket.waSentAt) {
        updateData.waSentAt = null;
      } else {
        updateData.waSentAt = new Date();
        updateData.waSentCount = { increment: 1 };
      }
    } else if (markWaSent === true) {
      updateData.waSentAt = new Date();
      updateData.waSentCount = { increment: 1 };
    } else if (markWaSent === false) {
      updateData.waSentAt = null;
    }

    const updated = await prisma.tikTokLiveBasket.update({
      where: { id },
      data: updateData,
      include: {
        tiktokAccount: { select: { id: true, name: true, handle: true, avatar: true, hostName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            tiktokAccount: { select: { id: true, name: true, handle: true, avatar: true } },
            product: { select: { id: true, name: true, image: true } },
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            total: true,
            subtotal: true,
            shippingFee: true,
            trackingNumber: true,
            name: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, basket: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

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
