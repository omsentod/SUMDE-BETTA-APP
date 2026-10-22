import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

// GET /api/admin/counts
// Sumber data badge di AdminSidebar. Dipanggil polling 30 detik dari client.
// Ringan sengaja: hanya count() query, tidak fetch full row.
export async function GET(request) {
  try {
    await requirePermission(request, ['orders:read', 'products:view', 'dashboard:view']);

    // Gunakan groupBy untuk status agar hanya butuh 1 query agregat (1 koneksi DB)
    // untuk menghitung PENDING, PAID, PROCESSING, dan RETURNED secara efisien.
    const [statusGroups, awaitingWaybill, archivedProducts] = await Promise.all([
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
    ]);

    const countsByStatus = {};
    for (const group of statusGroups) {
      countsByStatus[group.status] = group._count.id;
    }

    const pendingOrders = (countsByStatus['PENDING'] || 0) + (countsByStatus['PAID'] || 0);
    const processing = countsByStatus['PROCESSING'] || 0;
    const returned = countsByStatus['RETURNED'] || 0;

    return NextResponse.json({
      pendingOrders,
      processing,
      awaitingWaybill,
      returned,
      archivedProducts,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
