import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/counts
// Sumber data badge di AdminSidebar. Dipanggil polling 30 detik dari client.
// Ringan sengaja: hanya count() query, tidak fetch full row.
export async function GET(request) {
  try {
    await requireAdmin(request);

    // Jalankan 4 count query paralel supaya total latency ≈ query terlambat,
    // bukan sum semua.
    const [pendingOrders, processing, awaitingWaybill, returned] = await Promise.all([
      // Pesanan Baru — belum bayar (PENDING) + sudah bayar tapi belum panggil
      // kurir (PAID). Keduanya actionable untuk admin (verifikasi/proses).
      prisma.order.count({ where: { status: { in: ['PENDING', 'PAID'] } } }),

      // Diproses — sudah panggil kurir, menunggu kurir pickup / AWB.
      // Aligned dengan link sidebar `/admin/orders?status=PROCESSING`.
      prisma.order.count({ where: { status: 'PROCESSING' } }),

      // Menunggu waybill — shipment sudah dibuat tapi AWB belum turun dari Biteship.
      prisma.order.count({
        where: {
          biteshipShipmentId: { not: null },
          trackingNumber: null,
        },
      }),

      // Retur — perlu review admin manual (tidak auto-restock).
      prisma.order.count({ where: { status: 'RETURNED' } }),
    ]);

    return NextResponse.json({
      pendingOrders,
      processing,
      awaitingWaybill,
      returned,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
