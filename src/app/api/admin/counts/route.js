import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

// GET /api/admin/counts
// Sumber data badge di AdminSidebar. Dipanggil polling 30 detik dari client.
// Ringan sengaja: hanya count() query, tidak fetch full row.
export async function GET(request) {
  try {
    await requirePermission(request, [
      'dashboard:view',
      'orders:view',
      'orders:read',
      'shipping:view',
      'shipping:packing',
      'products:view',
      'reports:view',
      'events:view',
      'users:view',
      'roles:view',
      'chat:view',
    ]);

    // Gunakan groupBy untuk status agar hanya butuh 1 query agregat (1 koneksi DB)
    // untuk menghitung PENDING, PAID, PROCESSING, dan RETURNED secara efisien.
    const [statusGroups, awaitingWaybill, archivedProducts, otherRecycledCount, unreadChatCount, pendingPacking, readyForPickup] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.order.count({
        where: {
          biteshipShipmentId: { not: null },
          trackingNumber: null,
        },
      }),
      prisma.product.count({
        where: { isArchived: true },
      }),
      prisma.recycleBinItem.count().catch(() => 0),
      prisma.conversation.count({
        where: { unreadAdminCount: { gt: 0 } },
      }).catch(() => 0),
      prisma.order.count({
        where: {
          status: { in: ['PAID', 'PROCESSING'] },
          packingStatus: 'PENDING',
        },
      }).catch(() => 0),
      prisma.order.count({
        where: {
          status: 'PROCESSING',
          packingStatus: 'READY_FOR_PICKUP',
        },
      }).catch(() => 0),
    ]);

    const countsByStatus = {};
    for (const group of statusGroups) {
      countsByStatus[group.status] = group._count.id;
    }

    const pendingOrders = (countsByStatus['PENDING'] || 0) + (countsByStatus['PAID'] || 0);
    const totalProcessing = countsByStatus['PROCESSING'] || 0;
    const readyForPickupCount = readyForPickup || 0;
    const processing = Math.max(0, totalProcessing - readyForPickupCount);
    const returned = countsByStatus['RETURNED'] || 0;
    const totalRecycled = (archivedProducts || 0) + (otherRecycledCount || 0);

    return NextResponse.json({
      pendingOrders,
      processing,
      readyForPickup: readyForPickupCount,
      pendingPacking,
      awaitingWaybill,
      returned,
      archivedProducts: totalRecycled,
      unreadChat: unreadChatCount,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
