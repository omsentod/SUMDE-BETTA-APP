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
    const tab = (searchParams.get('tab') || 'bagging').toLowerCase(); // bagging | boxing | ready | all
    const search = (searchParams.get('search') || '').trim();
    const rawDateFilter = searchParams.get('dateFilter');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const dateFilter = rawDateFilter || 'all';

    // Helper rentang tanggal (WIB / Local timezone server)
    const getDateRange = (filter) => {
      if (!filter || filter === 'all') return null;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (filter === 'today') {
        return { gte: todayStart, lte: todayEnd };
      }
      if (filter === 'yesterday') {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(todayEnd);
        yEnd.setDate(yEnd.getDate() - 1);
        return { gte: yStart, lte: yEnd };
      }
      if (filter === '7days') {
        const past7 = new Date(todayStart);
        past7.setDate(past7.getDate() - 6);
        return { gte: past7, lte: todayEnd };
      }
      if (filter === '30days') {
        const past30 = new Date(todayStart);
        past30.setDate(past30.getDate() - 29);
        return { gte: past30, lte: todayEnd };
      }
      if (filter === 'custom' && (startDateParam || endDateParam)) {
        const start = startDateParam ? new Date(startDateParam) : new Date(todayStart);
        start.setHours(0, 0, 0, 0);
        const end = endDateParam ? new Date(endDateParam) : new Date(todayEnd);
        end.setHours(23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      return null;
    };

    const dateRange = getDateRange(dateFilter);

    // 1. Ambil agregat jumlah per tahap alur packing
    // Khusus Pos 1-3 berlaku untuk pesanan berstatus PROCESSING (resi sudah dicetak / pesanan diproses).
    const [baggingCount, boxingCount, readyCount] = await Promise.all([
      prisma.order.count({
        where: {
          status: 'PROCESSING',
          packingStatus: 'PENDING',
        },
      }),
      prisma.order.count({
        where: {
          status: 'PROCESSING',
          packingStatus: 'BAGGED',
        },
      }),
      prisma.order.count({
        where: {
          status: 'PROCESSING',
          packingStatus: 'READY_FOR_PICKUP',
        },
      }),
    ]);

    // 2. Susun filter query list pesanan
    const whereClause = {};

    if (tab === 'bagging') {
      whereClause.status = 'PROCESSING';
      whereClause.packingStatus = 'PENDING';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (tab === 'boxing') {
      whereClause.status = 'PROCESSING';
      whereClause.packingStatus = 'BAGGED';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (tab === 'ready') {
      whereClause.status = 'PROCESSING';
      whereClause.packingStatus = 'READY_FOR_PICKUP';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else {
      // 'all'
      whereClause.status = 'PROCESSING';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
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
        updatedAt: true,
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
        pendingTotal: baggingCount + boxingCount,
      },
      dateFilter,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan internal server.' },
      { status: error.status || 500 }
    );
  }
}
