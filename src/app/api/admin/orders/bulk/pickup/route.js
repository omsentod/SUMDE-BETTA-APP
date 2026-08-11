import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { createShipment } from '@/lib/shipping';

// POST /api/admin/orders/bulk/pickup
// Body: { orderIds: string[] }
// Book Biteship pickup untuk multiple order sekaligus. Partial success:
// tiap order dieksekusi terpisah, error di satu tidak menghentikan yang lain.
// Return per-order result supaya UI bisa tampilkan sukses/gagal spesifik.
export async function POST(request) {
  try {
    await requireAdmin(request);

    const { orderIds } = await request.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds wajib array non-kosong.' }, { status: 400 });
    }
    if (orderIds.length > 50) {
      return NextResponse.json({ error: 'Maksimum 50 order per batch.' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { items: true },
    });

    const results = [];

    for (const orderId of orderIds) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        results.push({ orderId, ok: false, error: 'Pesanan tidak ditemukan.' });
        continue;
      }
      if (order.status !== 'PROCESSING') {
        results.push({ orderId, ok: false, error: `Status ${order.status} — hanya PROCESSING yang bisa di-pickup.` });
        continue;
      }
      if (order.biteshipShipmentId) {
        results.push({ orderId, ok: false, error: 'Sudah punya shipmentId — skip.' });
        continue;
      }

      const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
      try {
        const shipmentData = await createShipment(order, totalQty);
        const freshWaybill =
          shipmentData.courier?.waybill_id ||
          shipmentData.courier?.tracking_id ||
          shipmentData.waybill_id ||
          null;

        const data = {
          biteshipShipmentId: shipmentData.id,
          biteshipStatus: shipmentData.status || 'allocated',
        };
        if (freshWaybill) {
          data.trackingNumber = freshWaybill;
          data.status = 'SHIPPED';
        }

        await prisma.order.update({ where: { id: order.id }, data });
        results.push({
          orderId,
          ok: true,
          trackingNumber: freshWaybill,
          awaitingWaybill: !freshWaybill,
        });
      } catch (err) {
        console.error(`Bulk pickup failed for order ${orderId}:`, err);
        results.push({ orderId, ok: false, error: err.message || 'Biteship error' });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
