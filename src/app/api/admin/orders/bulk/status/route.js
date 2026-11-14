import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

const VALID_STATUSES = new Set([
  'PENDING',
  'PAID',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
]);

// PUT /api/admin/orders/bulk/status
// Body: { orderIds: string[], status: string }
//
// Admin override — mengubah Order.status & menyinkronkan alur packingStatus gudang:
// - PENDING: status=PENDING, packingStatus=PENDING (keluar dari antrean gudang, reset timestamps)
// - PAID: status=PAID, packingStatus=PENDING (keluar dari Pos 1, menunggu proses/cetak resi)
// - PROCESSING: status=PROCESSING, packingStatus=PENDING (masuk Pos 1 Bungkus Plastik Ikan)
// - READY_FOR_PICKUP: status=PROCESSING, packingStatus=READY_FOR_PICKUP (masuk Pos 3 Menunggu Kurir)
// - SHIPPED: status=SHIPPED, packingStatus=PICKED_UP (masuk Pos 4 Ekspedisi)
// - COMPLETED: status=COMPLETED, packingStatus=PICKED_UP (tetap Pos 4 Riwayat Selesai)
// - CANCELLED: status=CANCELLED, packingStatus=PENDING (keluar dari antrean gudang, reset timestamps)
// - RETURNED: status=RETURNED, packingStatus=PENDING (keluar dari antrean gudang)
export async function PUT(request) {
  try {
    const session = await requirePermission(request, 'orders:write');
    const staffName = session?.name || session?.email || 'Admin';

    const { orderIds, status } = await request.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds wajib array non-kosong.' }, { status: 400 });
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: `Status "${status}" tidak valid.` }, { status: 400 });
    }
    if (orderIds.length > 100) {
      return NextResponse.json({ error: 'Maksimum 100 order per batch.' }, { status: 400 });
    }

    let updateData = { status };

    if (status === 'READY_FOR_PICKUP') {
      updateData = {
        status: 'PROCESSING',
        packingStatus: 'READY_FOR_PICKUP',
        packedAt: new Date(),
        packedBy: staffName,
      };
    } else if (status === 'PROCESSING') {
      updateData = {
        status: 'PROCESSING',
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };
    } else if (status === 'PAID') {
      updateData = {
        status: 'PAID',
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };
    } else if (status === 'PENDING') {
      updateData = {
        status: 'PENDING',
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };
    } else if (status === 'SHIPPED') {
      updateData = {
        status: 'SHIPPED',
        packingStatus: 'PICKED_UP',
      };
    } else if (status === 'COMPLETED') {
      updateData = {
        status: 'COMPLETED',
        packingStatus: 'PICKED_UP',
      };
    } else if (status === 'CANCELLED') {
      updateData = {
        status: 'CANCELLED',
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };
    } else if (status === 'RETURNED') {
      updateData = {
        status: 'RETURNED',
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };
    }

    const results = [];
    for (const orderId of orderIds) {
      try {
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });
        console.warn(`[Admin override] Order ${orderId} status → ${updateData.status}, packingStatus → ${updateData.packingStatus} (was likely ${updated.status})`);
        results.push({ orderId, ok: true, status: updateData.status, packingStatus: updateData.packingStatus });
      } catch (err) {
        results.push({ orderId, ok: false, error: err.message || 'Update gagal' });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
