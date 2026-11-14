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
    // Default filter tanggal: khusus tab shipped default 'today' (real-time monitor pickup kurir hari ini)
    const rawDateFilter = searchParams.get('dateFilter');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const dateFilter = rawDateFilter || (tab === 'shipped' ? 'today' : 'all');

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
    const todayRange = getDateRange('today');

    // 1. Ambil agregat jumlah per tahap alur packing
    // Khusus shipped: hitung pickup hari ini agar KPI real-time relevan dengan shift hari ini
    const [baggingCount, boxingCount, readyCount, shippedTodayCount, shippedTotalCount] = await Promise.all([
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
          updatedAt: todayRange,
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
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (tab === 'boxing') {
      whereClause.status = { in: ['PAID', 'PROCESSING'] };
      whereClause.packingStatus = 'BAGGED';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (tab === 'ready') {
      whereClause.status = { in: ['PAID', 'PROCESSING'] };
      whereClause.packingStatus = 'READY_FOR_PICKUP';
      if (dateRange) {
        whereClause.createdAt = dateRange;
      }
    } else if (tab === 'shipped') {
      whereClause.status = { in: ['SHIPPED', 'COMPLETED'] };
      // Khusus tab riwayat ekspedisi / pickup: filter berdasarkan waktu update pickup (updatedAt)
      if (dateRange) {
        whereClause.updatedAt = dateRange;
      }
    } else {
      // 'all'
      whereClause.status = { in: ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] };
      if (dateRange) {
        whereClause.updatedAt = dateRange;
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
        shipped: shippedTodayCount,
        shippedTotal: shippedTotalCount,
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
