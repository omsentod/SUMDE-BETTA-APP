import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, requireUser } from '@/lib/auth';

export async function GET(request) {
  try {
    // Admins see every order; a regular user sees only their own.
    const session = await requireUser(request);
    const where = session.role === 'admin' ? {} : { userId: session.id };
    const orders = await prisma.order.findMany({
      where,
      include: { items: { include: { product: true } }, user: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    const { total, name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items } = await request.json();
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return NextResponse.json({ error: 'Detail pesanan tidak lengkap.' }, { status: 400 });
    }

    // Attribute the order to the logged-in user (guest checkout => null).
    // userId is taken from the session, never trusted from the request body.
    const session = await getSession(request);
    const userId = session?.id ?? null;

    // Stock is NOT decremented here — that happens in the DOKU webhook on
    // successful payment. selectedSize is persisted for the webhook.
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: { userId, total: parseFloat(total), status: 'PENDING', name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode }
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
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
