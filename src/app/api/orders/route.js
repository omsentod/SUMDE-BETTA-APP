import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, requireUser } from '@/lib/auth';
import { findAndValidateRate } from '@/lib/shipping';
import { notifyAllAdmins } from '@/lib/notification';
import { calcPaymentFee, isValidPaymentMethod } from '@/lib/paymentFee';

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
    const { name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items, shipping, paymentMethod } = await request.json();
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return NextResponse.json({ error: 'Detail pesanan tidak lengkap.' }, { status: 400 });
    }
    if (!shipping?.courier || !shipping?.service) {
      return NextResponse.json({ error: 'Pilih kurir pengiriman terlebih dahulu.' }, { status: 400 });
    }
    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'Pilih metode pembayaran terlebih dahulu.' }, { status: 400 });
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

    // Compute the authoritative subtotal server-side. The client's total is
    // ignored — trusting it would let a caller pay any amount they want.
    const subtotal = normalized.reduce((sum, item) => {
      const product = productById.get(item.productId);
      return sum + product.price * item.quantity;
    }, 0);

    // Re-quote shipping from RajaOngkir right now, using the same courier+service
    // the client picked. The fee we store is what RajaOngkir says NOW — never
    // what the client sent — so a tampered shippingFee in the body is ignored.
    const rate = await findAndValidateRate({
      destinationPostal: postalCode,
      destinationCity: city,
      items: normalized,
      courier: shipping.courier,
      service: shipping.service,
    });
    if (!rate) {
      return NextResponse.json(
        { error: 'Layanan kurir yang dipilih tidak lagi tersedia. Pilih ulang ongkir.' },
        { status: 400 }
      );
    }
    const shippingFee = Number(rate.price) || 0;
    // Payment gateway admin fee — calculated server-side on subtotal + shipping.
    // Percent methods (QRIS 0.7%, e-wallet 1.5%, paylater 1.5%) round up.
    // Flat methods (VA Rp 4.000, Alfa Rp 5.000, Indomaret Rp 6.500) use nominal.
    const paymentFee = calcPaymentFee(paymentMethod, subtotal + shippingFee);
    const total = subtotal + shippingFee + paymentFee;

    // Attribute the order to the logged-in user (guest checkout => null).
    // userId is taken from the session, never trusted from the request body.
    const session = await getSession(request);
    const userId = session?.id ?? null;

    // Stock is NOT decremented here — that happens in the DOKU webhook on
    // successful payment. selectedSize is persisted for the webhook.
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          status: 'PENDING',
          subtotal, shippingFee, paymentFee, paymentMethod, total,
          shippingCourier: rate.courier_code,
          shippingService: rate.courier_service_code,
          shippingEta: rate.duration || null,
          name, email, phone, streetAddress, rtRw,
          province, city, district, village, postalCode,
          ...(userId ? { user: { connect: { id: userId } } } : {}),
        },
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

    // Notif admin: pesanan baru masuk (status PENDING, belum bayar).
    // Best-effort — jangan gagalkan order create kalau notif error.
    try {
      await notifyAllAdmins({
        type: 'order.new',
        title: 'Pesanan baru masuk',
        body: `${name} — ${order.items?.length || 0} item — menunggu pembayaran`,
        link: '/admin/orders?status=PENDING',
      });
    } catch (notifErr) {
      console.error('New order notification fanout failed:', notifErr.message);
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
