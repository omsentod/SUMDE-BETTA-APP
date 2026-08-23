import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, requireAdmin } from '@/lib/auth';

const VALID_STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED'];

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } }
    });
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    // Full order details (name, email, phone, address, items) are PII —
    // require the owner or an admin. Guest orders (userId = null) are NOT
    // fetchable through this endpoint; the payment page polls the minimal
    // /status endpoint instead, which returns only the order status.
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    if (order.userId !== session.id && session.role !== 'admin') {
      return NextResponse.json({ error: 'Anda tidak memiliki akses ke pesanan ini.' }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    // Only admins may change order status via this endpoint.
    await requireAdmin(request);

    const { id } = await params;
    const { status } = await request.json();

    // PAID = "uang masuk" — hanya boleh di-set oleh DOKU webhook setelah
    // signature verification. Admin tidak boleh set PAID manual (untuk itu
    // pakai flow webhook manual atau bulk status override yang log warning).
    if (status === 'PAID') {
      return NextResponse.json(
        { error: 'Status PAID hanya dapat ditetapkan oleh webhook pembayaran DOKU.' },
        { status: 403 }
      );
    }
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
