import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidPaymentMethod } from '@/lib/paymentFee';

// PATCH /api/orders/[id]/payment-method
// Customer-facing: ganti metode pembayaran pada order yang masih PENDING.
// Dipakai saat user balik dari DOKU (mis. channel inactive / mau ganti VA
// bank) dan retry — supaya order lama di-reuse alih-alih membuat order baru
// (mencegah duplikat untuk cart yang sama).
//
// Auth model sama dengan /cancel: guest order (userId null) boleh diakses
// oleh siapa saja yang punya orderId (UUID sulit di-guess); user order butuh
// session cocok atau admin.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { paymentMethod } = await request.json();

    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: 'Metode pembayaran tidak valid.' }, { status: 400 });
    }

    const session = await getSession(request);
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    if (order.userId !== null) {
      if (!session) {
        return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
      }
      if (order.userId !== session.id && session.role !== 'admin') {
        return NextResponse.json({ error: 'Anda tidak berhak mengubah pesanan ini.' }, { status: 403 });
      }
    }

    // Hanya boleh ganti metode selama belum bayar. Setelah PAID, metode sudah
    // final di sisi DOKU/settlement.
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Metode pembayaran tidak dapat diubah pada status ${order.status}.` },
        { status: 409 }
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { paymentMethod },
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
