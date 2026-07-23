import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } }, user: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, total, status, name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items } = await request.json();
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return NextResponse.json({ error: 'Detail pesanan tidak lengkap.' }, { status: 400 });
    }
    // NOTE: stock is intentionally NOT decremented here. It is decremented only
    // when payment is confirmed by the DOKU webhook (see webhook/route.js), so
    // abandoned/unpaid PENDING orders no longer consume stock. selectedSize is
    // persisted so the webhook knows which size to decrement.
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: { userId: userId || null, total: parseFloat(total), status: status || 'PENDING', name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode }
      });
      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId || item.id,
            quantity: parseInt(item.quantity) || 1,
            price: parseFloat(item.price),
            selectedSize: item.selectedSize ?? null,
          }
        });
      }
      return newOrder;
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
