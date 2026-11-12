import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { consume, clientIp } from '@/lib/rateLimit';
import { findAndValidateRate } from '@/lib/shipping';
import { calcPaymentFee, isValidPaymentMethod } from '@/lib/paymentFee';
import { notifyAllAdmins, createNotification } from '@/lib/notification';
import { isValidClaimToken, normalizeTikTokUsername } from '@/lib/tiktokLive';

export async function POST(request) {
  try {
    const ip = clientIp(request);
    const rl = consume(`live-checkout:${ip}`, { limit: 15, windowMs: 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan checkout. Coba lagi sebentar.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const body = await request.json();
    const {
      basketId,
      claimToken,
      tiktokUsername,
      name,
      email,
      phone,
      streetAddress,
      rtRw,
      province,
      city,
      district,
      village,
      postalCode,
      shipping,
      paymentMethod,
    } = body;

    if (!basketId || !isValidClaimToken(claimToken)) {
      return NextResponse.json({ error: 'Token klaim keranjang live tidak valid.' }, { status: 400 });
    }
    const normUser = normalizeTikTokUsername(tiktokUsername);
    if (!normUser.ok) {
      return NextResponse.json({ error: normUser.error }, { status: 400 });
    }

    const cleanedPostal = String(postalCode || '').trim();
    const cleanedEmail = String(email || '').trim().toLowerCase();
    const cleanedName = String(name || '').trim();
    const cleanedPhone = String(phone || '').trim();
    const cleanedStreet = String(streetAddress || '').trim();
    const cleanedRtRw = String(rtRw || '').trim();

    if (
      !cleanedName ||
      !cleanedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail) ||
      !cleanedPhone ||
      !cleanedStreet ||
      !cleanedRtRw ||
      !province ||
      !city ||
      !district ||
      !village ||
      !/^\d{5}$/.test(cleanedPostal)
    ) {
      return NextResponse.json(
        { error: 'Detail penerima, email valid, dan kode pos 5 digit wajib diisi lengkap.' },
        { status: 400 }
      );
    }

    if (!shipping?.courier || !shipping?.service) {
      return NextResponse.json({ error: 'Pilih kurir pengiriman terlebih dahulu.' }, { status: 400 });
    }
    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'Pilih metode pembayaran terlebih dahulu.' }, { status: 400 });
    }

    const basket = await prisma.tikTokLiveBasket.findUnique({
      where: { id: String(basketId) },
      include: {
        tiktokAccount: { select: { name: true, handle: true } },
        items: {
          include: {
            tiktokAccount: { select: { name: true, handle: true } },
            product: { include: { variants: true } },
          },
        },
      },
    });

    if (!basket || !basket.claimToken || basket.claimToken !== String(claimToken).trim() || basket.tiktokUsername !== normUser.username) {
      return NextResponse.json({ error: 'Link klaim keranjang live tidak ditemukan atau tidak valid.' }, { status: 404 });
    }
    if (basket.status !== 'OPEN') {
      return NextResponse.json({ error: 'Keranjang live ini sudah di-checkout sebelumnya.' }, { status: 409 });
    }
    if (!basket.items || basket.items.length === 0) {
      return NextResponse.json({ error: 'Keranjang live kosong.' }, { status: 400 });
    }

    // Validasi ketersediaan stok jika item terhubung ke katalog produk web
    for (const item of basket.items) {
      if (!item.productId) continue;
      const product = item.product;
      if (!product || product.isArchived) {
        return NextResponse.json(
          { error: `Produk "${item.name}" sudah tidak tersedia di katalog.` },
          { status: 400 }
        );
      }
      if (item.variantId) {
        const variant = product.variants?.find((v) => v.id === item.variantId);
        if (!variant || variant.stock < item.quantity) {
          return NextResponse.json(
            { error: `Stok varian "${item.selectedSize || ''}" untuk "${item.name}" tidak mencukupi.` },
            { status: 400 }
          );
        }
      } else if (product.quantity < item.quantity) {
        return NextResponse.json(
          { error: `Stok produk "${item.name}" tidak mencukupi.` },
          { status: 400 }
        );
      }
    }

    // Recompute subtotal strictly from DB TikTokLiveItem records
    const subtotal = basket.items.reduce(
      (sum, item) => sum + Math.round(Number(item.price) || 0) * (item.quantity || 1),
      0
    );

    const rate = await findAndValidateRate({
      destinationPostal: cleanedPostal,
      destinationCity: city,
      destinationProvince: province,
      items: basket.items.map((i) => ({ productId: i.productId || i.id, quantity: i.quantity })),
      courier: shipping.courier,
      service: shipping.service,
    });
    if (!rate) {
      return NextResponse.json(
        { error: 'Layanan kurir yang dipilih tidak tersedia. Silakan cek ulang ongkir.' },
        { status: 400 }
      );
    }

    const shippingFee = Number(rate.price) || 0;
    const paymentFee = calcPaymentFee(paymentMethod, subtotal + shippingFee);
    const total = subtotal + shippingFee + paymentFee;

    const session = await getSession(request);
    const userId = session?.id ?? null;

    const accountLabels = [...new Set(
      basket.items
        .map((it) => it.tiktokAccount?.name || basket.tiktokAccount?.name)
        .filter(Boolean)
    )];
    const tiktokAccountName = accountLabels.length > 0 ? accountLabels.join(', ').slice(0, 190) : null;

    const order = await prisma.$transaction(async (tx) => {
      const lock = await tx.tikTokLiveBasket.updateMany({
        where: { id: basket.id, status: 'OPEN' },
        data: { status: 'CHECKED_OUT' },
      });
      if (lock.count === 0) {
        const err = new Error('Keranjang live ini sudah di-checkout.');
        err.status = 409;
        throw err;
      }

      const newOrder = await tx.order.create({
        data: {
          status: 'PENDING',
          subtotal,
          shippingFee,
          paymentFee,
          paymentMethod,
          total,
          shippingCourier: rate.courier_code,
          shippingService: rate.courier_service_code,
          shippingEta: rate.duration || null,
          name: cleanedName,
          email: cleanedEmail,
          phone: cleanedPhone,
          streetAddress: cleanedStreet,
          rtRw: cleanedRtRw,
          province: String(province).trim(),
          city: String(city).trim(),
          district: String(district).trim(),
          village: String(village).trim(),
          postalCode: cleanedPostal,
          orderSource: 'TIKTOK_LIVE',
          tiktokUsername: basket.tiktokUsername,
          tiktokAccountName,
          ...(userId ? { user: { connect: { id: userId } } } : {}),
        },
      });

      for (const item of basket.items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId || null,
            variantId: item.variantId || null,
            quantity: item.quantity,
            price: Math.round(Number(item.price) || 0),
            selectedSize: item.selectedSize || null,
            customName: item.name,
            customImage: item.image || null,
          },
        });
      }

      await tx.tikTokLiveBasket.update({
        where: { id: basket.id },
        data: { orderId: newOrder.id },
      });

      return newOrder;
    });

    try {
      const firstImage = basket.items[0]?.image || null;
      await notifyAllAdmins({
        type: 'order.new',
        title: 'Pesanan TikTok Live masuk',
        body: `Pesanan #${order.id.slice(0, 8)} @${basket.tiktokUsername} (${cleanedName}) — ${basket.items.length} item — menunggu pembayaran`,
        link: `/admin/orders?status=PENDING&highlightOrder=${order.id}`,
        imageUrl: firstImage,
      });
      if (userId) {
        await createNotification({
          userId,
          type: 'order.created',
          title: 'Pesanan Live Dibuat',
          body: `Pesanan #${order.id.slice(0, 8)} berhasil dibuat. Silakan selesaikan pembayaran.`,
          link: '/customer/orders',
          imageUrl: firstImage,
        });
      }
    } catch (notifErr) {
      console.error('Live order notification failed:', notifErr.message);
    }

    return NextResponse.json(
      { id: order.id, total: order.total, status: order.status },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
