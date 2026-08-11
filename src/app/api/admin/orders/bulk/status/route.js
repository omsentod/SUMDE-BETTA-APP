import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

const VALID_STATUSES = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED']);

// PUT /api/admin/orders/bulk/status
// Body: { orderIds: string[], status: string }
//
// Admin override — mengubah Order.status LANGSUNG tanpa side effects:
// TIDAK trigger restock (kalau CANCELLED dari PROCESSING+)
// TIDAK kirim email notif
// TIDAK panggil Biteship
//
// Untuk cancel dengan restock, pakai flow webhook Biteship (auto-restock).
// Endpoint ini untuk kondisi darurat: webhook missed, koreksi status manual.
export async function PUT(request) {
  try {
    await requireAdmin(request);

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

    const results = [];
    for (const orderId of orderIds) {
      try {
        const updated = await prisma.order.update({
          where: { id: orderId },
          data: { status },
        });
        console.warn(`[Admin override] Order ${orderId} status → ${status} (was likely ${updated.status})`);
        results.push({ orderId, ok: true, status });
      } catch (err) {
        results.push({ orderId, ok: false, error: err.message || 'Update gagal' });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
