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
    const { name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items } = await request.json();
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return NextResponse.json({ error: 'Detail pesanan tidak lengkap.' }, { status: 400 });
    }

    // Normalize incoming items — client only supplies productId, quantity, and
    // (optional) selectedSize. Price and total are authoritative from the DB.
    const normalized = [];
    for (const raw of items) {
      const productId = raw.productId || raw.id;
      const quantity = parseInt(raw.quantity);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Item pesanan tidak valid.' }, { status: 400 });
      }
      normalized.push({ productId, quantity, selectedSize: raw.selectedSize ?? null });
    }

    // Load authoritative prices from DB in a single query.
    const productIds = [...new Set(normalized.map(i => i.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map(p => [p.id, p]));
    for (const item of normalized) {
      const product = productById.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `Produk ${item.productId} tidak ditemukan.` }, { status: 400 });
      }
      if (product.isArchived) {
        return NextResponse.json({ error: `Produk "${product.name}" sudah tidak tersedia.` }, { status: 400 });
      }
    }

    // Compute the authoritative total server-side. The client's total is
    // ignored — trusting it would let a caller pay any amount they want.
    const serverTotal = normalized.reduce((sum, item) => {
      const product = productById.get(item.productId);
      return sum + product.price * item.quantity;
    }, 0);

    // Attribute the order to the logged-in user (guest checkout => null).
    // userId is taken from the session, never trusted from the request body.
    const session = await getSession(request);
    const userId = session?.id ?? null;

    // Stock is NOT decremented here — that happens in the DOKU webhook on
    // successful payment. selectedSize is persisted for the webhook.
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: { userId, total: serverTotal, status: 'PENDING', name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode }
      });
      for (const item of normalized) {
        const product = productById.get(item.productId);
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: product.price,
            selectedSize: item.selectedSize,
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
