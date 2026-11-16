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

function maskName(name) {
  if (!name) return '***';
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => (p.length <= 2 ? `${p[0]}*` : `${p[0]}***${p.slice(-1)}`)).join(' ');
}

function phoneMatches(p1, p2) {
  if (!p1 || !p2) return false;
  const d1 = String(p1).replace(/\D/g, '').replace(/^(0|62)/, '');
  const d2 = String(p2).replace(/\D/g, '').replace(/^(0|62)/, '');
  return d1.length >= 7 && d1 === d2;
}

async function lookupOrder(orderId, identifier) {
  const cleanId = String(orderId || '').trim().replace(/^#/, '');
  const cleanIdent = String(identifier || '').trim().toLowerCase();

  if (!cleanId) {
    return { error: 'Nomor pesanan atau No. Resi (AWB) wajib diisi.', status: 400 };
  }

  const includeQuery = {
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
  };

  let order = null;
  let isAwbMatch = false;

  // 1. Cari berdasarkan No. Resi (AWB / trackingNumber) atau ID Biteship terlebih dahulu
  if (cleanId.length >= 4) {
    const cleanAwb = cleanId.replace(/\s+/g, '');
    order = await prisma.order.findFirst({
      where: {
        OR: [
          { trackingNumber: cleanId },
          { trackingNumber: cleanAwb },
          { biteshipShipmentId: cleanId },
          { biteshipShipmentId: cleanAwb },
        ],
      },
      include: includeQuery,
      orderBy: { createdAt: 'desc' },
    });
    if (order) isAwbMatch = true;
  }

  // 2. Jika belum ditemukan by AWB, cari berdasarkan ID Pesanan (UUID penuh atau prefix >= 6 digit)
  if (!order) {
    order = await prisma.order.findUnique({
      where: { id: cleanId },
      include: includeQuery,
    }).catch(() => null);

    if (!order && cleanId.length >= 6) {
      order = await prisma.order.findFirst({
        where: { id: { startsWith: cleanId } },
        include: includeQuery,
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  if (!order) {
    return { error: 'Pesanan atau No. Resi tidak ditemukan.', status: 404 };
  }

  // 3. Verifikasi kepemilikan
  // Jika mencari dengan ID Pesanan, identifier (Email/WA) WAJIB diisi untuk keamanan privasi.
  // Jika mencari dengan No. Resi (AWB), identifier opsional: jika diisi diverifikasi; jika tidak sesuai/kosong, info alamat disanitasi.
  const hasIdentifier = Boolean(cleanIdent);
  const emailMatch = hasIdentifier && order.email && order.email.trim().toLowerCase() === cleanIdent;
  const phoneMatch = hasIdentifier && phoneMatches(order.phone, cleanIdent);
  const isVerified = emailMatch || phoneMatch;

  if (!isAwbMatch) {
    if (!hasIdentifier) {
      return { error: 'Email atau Nomor WhatsApp wajib diisi untuk verifikasi ID Pesanan.', status: 400 };
    }
    if (!isVerified) {
      return { error: 'Pesanan ditemukan, tetapi Email atau Nomor WhatsApp tidak sesuai dengan data pesanan.', status: 404 };
    }
  }

  // 4. Format payload aman (sanitized PII)
  const items = (order.items || []).map((item) => {
    const fallbackImage = item.variant?.imageUrl || item.product?.image || item.customImage || '/img/betta-1.png';
    return {
      id: item.id,
      productId: item.productId,
      name: item.customName || item.product?.name || 'Produk Akuatik',
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
      recipientName: isVerified ? order.name : maskName(order.name),
      maskedEmail: maskEmail(order.email),
      maskedPhone: maskPhone(order.phone),
      streetAddress: isVerified ? order.streetAddress : null,
      city: order.city,
      district: order.district,
      province: order.province,
      postalCode: isVerified ? order.postalCode : null,
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
      isVerified,
      matchedBy: isAwbMatch ? 'AWB' : 'ORDER_ID',
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
    const orderId = searchParams.get('orderId') || searchParams.get('id') || searchParams.get('waybill') || searchParams.get('resi') || searchParams.get('awb');
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
    const orderId = body.orderId || body.id || body.waybill || body.resi || body.awb;
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

