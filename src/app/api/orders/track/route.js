import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { consume, clientIp } from '@/lib/rateLimit';

const RATE_LIMIT = { limit: 20, windowMs: 60 * 1000 }; // 20 lookups / min / IP

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '***';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length <= 4) return '***';
  return `${clean.slice(0, 4)}****${clean.slice(-3)}`;
}

function phoneMatches(p1, p2) {
  if (!p1 || !p2) return false;
  let d1 = String(p1).replace(/\D/g, '');
  let d2 = String(p2).replace(/\D/g, '');
  if (d1 === d2) return true;
  if (d1.startsWith('62')) d1 = '0' + d1.slice(2);
  if (d2.startsWith('62')) d2 = '0' + d2.slice(2);
  return d1 === d2;
}

async function lookupOrder(orderId, identifier) {
  const cleanId = String(orderId || '').trim().replace(/^#/, '');
  const cleanIdent = String(identifier || '').trim().toLowerCase();

  if (!cleanId || !cleanIdent) {
    return { error: 'Nomor pesanan dan Email/Nomor HP wajib diisi.', status: 400 };
  }

  // 1. Cari pesanan by UUID penuh atau 8 digit awalan
  let order = null;
  if (cleanId.length === 36) {
    order = await prisma.order.findUnique({
      where: { id: cleanId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                id: true,
                size: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });
  } else if (cleanId.length >= 6) {
    order = await prisma.order.findFirst({
      where: { id: { startsWith: cleanId } },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                id: true,
                size: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!order) {
    return { error: 'Pesanan tidak ditemukan atau data verifikasi tidak cocok.', status: 404 };
  }

  // 2. Verifikasi kepemilikan via Email OR Phone
  const emailMatch = order.email && order.email.toLowerCase() === cleanIdent;
  const phoneMatch = phoneMatches(order.phone, cleanIdent);

  if (!emailMatch && !phoneMatch) {
    return { error: 'Pesanan tidak ditemukan atau data verifikasi tidak cocok.', status: 404 };
  }

  // 3. Format payload aman (sanitized PII)
  const items = (order.items || []).map((item) => {
    const fallbackImage = item.variant?.imageUrl || item.product?.image || '/img/betta-1.png';
    return {
      id: item.id,
      productId: item.productId,
      name: item.product?.name || 'Produk Akuatik',
      image: fallbackImage,
      quantity: item.quantity,
      selectedSize: item.selectedSize || item.variant?.size || null,
      price: item.price,
    };
  });

  return {
    order: {
      id: order.id,
      shortId: order.id.slice(0, 8),
      status: order.status,
      createdAt: order.createdAt,
      recipientName: order.name,
      maskedEmail: maskEmail(order.email),
      maskedPhone: maskPhone(order.phone),
      streetAddress: order.streetAddress,
      city: order.city,
      district: order.district,
      province: order.province,
      postalCode: order.postalCode,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      paymentFee: order.paymentFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      shippingCourier: order.shippingCourier,
      shippingService: order.shippingService,
      shippingEta: order.shippingEta,
      trackingNumber: order.trackingNumber,
      items,
    },
  };
}

export async function GET(request) {
  try {
    const gate = consume(`track-guest:${clientIp(request)}`, RATE_LIMIT);
    if (!gate.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan pelacakan. Coba lagi dalam 1 menit.' },
        { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId') || searchParams.get('id');
    const identifier = searchParams.get('identifier') || searchParams.get('email') || searchParams.get('phone');

    const result = await lookupOrder(orderId, identifier);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.order);
  } catch (error) {
    console.error('Track order lookup error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem saat mencari pesanan.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const gate = consume(`track-guest:${clientIp(request)}`, RATE_LIMIT);
    if (!gate.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan pelacakan. Coba lagi dalam 1 menit.' },
        { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const orderId = body.orderId || body.id;
    const identifier = body.identifier || body.email || body.phone;

    const result = await lookupOrder(orderId, identifier);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.order);
  } catch (error) {
    console.error('Track order lookup error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem saat mencari pesanan.' }, { status: 500 });
  }
}

