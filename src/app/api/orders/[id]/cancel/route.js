import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// POST /api/orders/[id]/cancel
// Customer-facing: batalkan pesanan sendiri saat masih PENDING (belum bayar).
// Setelah PAID stock sudah decrement, refund harus lewat flow admin/webhook —
// jangan izinkan customer cancel via endpoint ini.
//
// Auth model:
//  - Logged-in user  → session.id harus == order.userId (atau admin bypass)
//  - Guest order     → order.userId === null, siapa saja yang punya orderId
//    boleh cancel. Aman karena orderId = UUID sulit di-guess.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const session = await getSession(request);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    // Owner-check: guest order (userId null) selalu boleh; user order butuh
    // session.id cocok atau admin.
    if (order.userId !== null) {
      if (!session) {
        return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
      }
      if (order.userId !== session.id && session.role !== 'admin') {
        return NextResponse.json({ error: 'Anda tidak berhak membatalkan pesanan ini.' }, { status: 403 });
      }
    }

    // Hanya PENDING (belum bayar) yang boleh customer cancel. PAID+ butuh
    // proses refund via admin.
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Pesanan tidak dapat dibatalkan pada status ${order.status}. Hubungi admin untuk pesanan yang sudah dibayar.` },
        { status: 409 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
