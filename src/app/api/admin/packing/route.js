import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function GET(request) {
  try {
    await requirePermission(request, [
      'shipping:packing',
      'shipping:manage',
      'orders:view',
    ]);

    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get('tab') || 'bagging').toLowerCase(); // bagging | boxing | ready | shipped | all
    const search = (searchParams.get('search') || '').trim();

    // 1. Ambil agregat jumlah per tahap alur packing
    const [baggingCount, boxingCount, readyCount, shippedCount] = await Promise.all([
      prisma.order.count({
        where: {
          status: { in: ['PAID', 'PROCESSING'] },
          packingStatus: 'PENDING',
        },
      }),
      prisma.order.count({
        where: {
          status: { in: ['PAID', 'PROCESSING'] },
          packingStatus: 'BAGGED',
        },
      }),
      prisma.order.count({
        where: {
          status: { in: ['PAID', 'PROCESSING'] },
          packingStatus: 'READY_FOR_PICKUP',
        },
      }),
      prisma.order.count({
        where: {
          status: { in: ['SHIPPED', 'COMPLETED'] },
        },
      }),
    ]);

    // 2. Susun filter query list pesanan
    const whereClause = {};

    if (tab === 'bagging') {
      whereClause.status = { in: ['PAID', 'PROCESSING'] };
      whereClause.packingStatus = 'PENDING';
    } else if (tab === 'boxing') {
      whereClause.status = { in: ['PAID', 'PROCESSING'] };
      whereClause.packingStatus = 'BAGGED';
    } else if (tab === 'ready') {
      whereClause.status = { in: ['PAID', 'PROCESSING'] };
      whereClause.packingStatus = 'READY_FOR_PICKUP';
    } else if (tab === 'shipped') {
      whereClause.status = { in: ['SHIPPED', 'COMPLETED'] };
    } else {
      // 'all'
      whereClause.status = { in: ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] };
    }

    if (search) {
      whereClause.OR = [
        { id: { contains: search } },
        { trackingNumber: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } },
        { tiktokUsername: { contains: search } },
        { telegramUsername: { contains: search } },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        packingStatus: true,
        baggedAt: true,
        baggedBy: true,
        packedAt: true,
        packedBy: true,
        name: true,
        phone: true,
        city: true,
        province: true,
        shippingCourier: true,
        shippingService: true,
        trackingNumber: true,
        orderSource: true,
        tiktokUsername: true,
        tiktokAccountName: true,
        telegramUsername: true,
        tiktokLiveBasket: {
          select: {
            tiktokAccount: {
              select: {
                handle: true,
                name: true,
              },
            },
          },
        },
        createdAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            customName: true,
            customImage: true,
            selectedSize: true,
            variant: {
              select: {
                imageUrl: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                brand: true,
                department: {
                  select: {
                    isLiveFish: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      orders,
      counts: {
        bagging: baggingCount,
        boxing: boxingCount,
        ready: readyCount,
        shipped: shippedCount,
        pendingTotal: baggingCount + boxingCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan internal server.' },
      { status: error.status || 500 }
    );
  }
}
