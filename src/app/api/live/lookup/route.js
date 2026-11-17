import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { consume, clientIp } from '@/lib/rateLimit';
import { isValidClaimToken } from '@/lib/tiktokLive';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const ip = clientIp(request);
    const rl = consume(`live-lookup:${ip}`, { limit: 120, windowMs: 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = String(searchParams.get('token') || '').trim();

    if (!isValidClaimToken(token)) {
      return NextResponse.json(
        { error: 'Link atau token klaim tidak valid. Gunakan link unik yang dikirim admin melalui DM TikTok.' },
        { status: 400 }
      );
    }

    const basket = await prisma.tikTokLiveBasket.findUnique({
      where: { claimToken: token },
      include: {
        tiktokAccount: { select: { name: true, handle: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            tiktokAccount: { select: { name: true, handle: true } },
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            subtotal: true,
            shippingFee: true,
            paymentFee: true,
            paymentMethod: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!basket) {
      return NextResponse.json({
        found: false,
        tiktokUsername: null,
        openBasket: null,
        pendingOrders: [],
        paidCount: 0,
      });
    }

    let openBasket = null;
    const pendingOrders = [];
    let paidCount = 0;

    const primaryAccount = basket.tiktokAccount
      ? { name: basket.tiktokAccount.name, handle: basket.tiktokAccount.handle }
      : null;

    const liveAccountHandles = [
      ...new Set(
        [
          basket.tiktokAccount?.handle,
          ...basket.items.map((it) => it.tiktokAccount?.handle),
        ].filter(Boolean)
      ),
    ];

    if (basket.status === 'OPEN') {
      openBasket = {
        id: basket.id,
        claimCode: basket.claimCode,
        claimToken: basket.claimToken,
        tiktokUsername: basket.tiktokUsername,
        whatsappNumber: basket.whatsappNumber || null,
        updatedAt: basket.updatedAt,
        primaryAccount,
        liveAccountHandles,
        items: basket.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          selectedSize: item.selectedSize,
          note: item.note,
          accountName: item.tiktokAccount?.name || basket.tiktokAccount?.name || null,
          accountHandle: item.tiktokAccount?.handle || basket.tiktokAccount?.handle || null,
        })),
        subtotal: basket.items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0),
        totalQty: basket.items.reduce((sum, it) => sum + (it.quantity || 1), 0),
      };
    } else if (basket.status === 'CHECKED_OUT' && basket.order) {
      if (basket.order.status === 'PENDING') {
        pendingOrders.push({
          basketId: basket.id,
          claimCode: basket.claimCode,
          claimToken: basket.claimToken,
          orderId: basket.order.id,
          status: basket.order.status,
          subtotal: basket.order.subtotal,
          shippingFee: basket.order.shippingFee,
          paymentFee: basket.order.paymentFee,
          paymentMethod: basket.order.paymentMethod,
          total: basket.order.total,
          createdAt: basket.order.createdAt,
          liveAccountHandles,
          items: basket.items.map((it) => ({
            id: it.id,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
            image: it.image,
            selectedSize: it.selectedSize,
          })),
        });
      } else if (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(basket.order.status)) {
        paidCount = 1;
      }
    }

    return NextResponse.json({
      found: true,
      tiktokUsername: basket.tiktokUsername,
      openBasket,
      pendingOrders,
      paidCount,
      isCancelled: basket.status === 'CANCELLED' || basket.order?.status === 'CANCELLED',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
