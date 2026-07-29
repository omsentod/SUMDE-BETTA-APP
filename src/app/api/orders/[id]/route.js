import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession, requireAdmin } from '@/lib/auth';

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

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

    // PROCESSING = "paid" and is set exclusively by the DOKU webhook after
    // signature verification — never from a client, not even an admin.
    if (status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Status PROCESSING hanya dapat ditetapkan oleh webhook pembayaran DOKU.' },
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
