import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const VALID_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

/**
 * Resolve the requesting user from a client-asserted userId.
 *
 * NOTE: This project has no server-side session (login only stores the user in
 * localStorage). Identity is asserted by the client via userId, the same pattern
 * used by /api/addresses and /api/users. We re-read the role from the DB here
 * instead of trusting any role value sent by the client.
 */
async function resolveRequester(userId) {
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const requesterId = request.nextUrl.searchParams.get('userId');

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } }
    });
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    // Guest orders have no owner and are protected only by their unguessable
    // UUID. This is required so guest checkout can poll its own payment status.
    // Orders that belong to a registered user must be read only by that user or
    // an admin.
    if (order.userId !== null) {
      const requester = await resolveRequester(requesterId);
      if (!requester) {
        return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
      }
      const isOwner = order.userId === requester.id;
      const isAdmin = requester.role === 'admin';
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Anda tidak memiliki akses ke pesanan ini.' }, { status: 403 });
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { userId: requesterId, status } = await request.json();

    // The PROCESSING status means "payment confirmed" and is what the UI treats
    // as a successful payment. It must NEVER be settable from a client request —
    // it is set exclusively by the DOKU webhook after signature verification.
    if (status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Status PROCESSING hanya dapat ditetapkan oleh webhook pembayaran DOKU.' },
        { status: 403 }
      );
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    }

    // Every other status change (SHIPPED / COMPLETED / CANCELLED / PENDING) is an
    // admin-only operation.
    const requester = await resolveRequester(requesterId);
    if (!requester) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }
    if (requester.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengubah status pesanan.' }, { status: 403 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
