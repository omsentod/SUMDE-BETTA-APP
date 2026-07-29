import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Minimal status endpoint for the payment page to poll after DOKU checkout.
// Deliberately returns ONLY the order status — no PII — so that leaking the
// order UUID (via URL, referrer, tab-sharing, etc.) doesn't expose the
// customer's name/email/phone/address the way GET /api/orders/[id] would.

export async function GET(request, { params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ status: order.status });
}
