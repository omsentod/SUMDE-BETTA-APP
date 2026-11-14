import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isOrderExpired } from '@/lib/orderExpiry';

// Minimal status endpoint for the payment page to poll after DOKU checkout.
// Deliberately returns ONLY the order status — no PII — so that leaking the
// order UUID (via URL, referrer, tab-sharing, etc.) doesn't expose the
// customer's name/email/phone/address the way GET /api/orders/[id] would.

export async function GET(request, { params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, createdAt: true },
  });
  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  }

  // Cek apakah pesanan PENDING sudah kadaluwarsa (> 24 jam)
  if (order.status === 'PENDING' && isOrderExpired(order)) {
    await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    return NextResponse.json({ status: 'CANCELLED', expired: true });
  }

  return NextResponse.json({ status: order.status });
}
