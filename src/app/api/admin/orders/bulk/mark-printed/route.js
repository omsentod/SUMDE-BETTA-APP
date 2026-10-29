import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { createNotification, notifyAllAdmins } from '@/lib/notification';

// POST /api/admin/orders/bulk/mark-printed
// Body: { orderIds: string[] }
//
// Dipanggil otomatis saat admin mencetak resi (single atau batch).
// Mengubah status pesanan dari PAID -> PROCESSING (arti: resi sudah dicetak,
// barang sedang dikemas/siap diserahkan ke kurir).
// Order yang sudah PROCESSING / SHIPPED / COMPLETED tidak diubah agar aman dari downgrade.
export async function POST(request) {
  try {
    await requirePermission(request, ['shipping:label', 'orders:write', 'shipping:manage']);

    const { orderIds } = await request.json();
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds wajib berupa array non-kosong.' }, { status: 400 });
    }

    if (orderIds.length > 100) {
      return NextResponse.json({ error: 'Maksimum 100 order per request.' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const results = [];

    for (const order of orders) {
      // Hanya ubah status jika saat ini masih PAID
      if (order.status === 'PAID') {
        try {
          const updated = await prisma.order.update({
            where: { id: order.id },
            data: { status: 'PROCESSING' },
          });

          // Notifikasi ke pembeli bahwa resi telah dicetak dan paket sedang dikemas
          const firstImage = order.items?.[0]?.product?.image || null;
          if (order.userId) {
            await createNotification({
              userId: order.userId,
              type: 'order.processing',
              title: 'Pesanan sedang diproses',
              body: `Pesanan #${order.id.slice(0, 8)} sedang dikemas dan resi pengiriman telah dicetak.`,
              link: '/customer/orders',
              imageUrl: firstImage,
            }).catch((notifErr) => console.warn('Customer notification failed:', notifErr.message));
          }

          results.push({
            orderId: order.id,
            ok: true,
            status: 'PROCESSING',
            previousStatus: 'PAID',
          });
        } catch (err) {
          results.push({
            orderId: order.id,
            ok: false,
            error: err.message || 'Gagal mengubah status ke PROCESSING.',
          });
        }
      } else {
        // Status sudah PROCESSING, SHIPPED, COMPLETED, dll. Jangan downgrade!
        results.push({
          orderId: order.id,
          ok: true,
          status: order.status,
          previousStatus: order.status,
          unchanged: true,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error marking orders as printed:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

