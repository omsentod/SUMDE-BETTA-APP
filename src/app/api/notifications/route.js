import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TRANSACTION_TYPES = [
  'order.new',
  'order.created',
  'order.paid',
  'order.processing',
  'order.shipped',
  'order.completed',
  'order.cancelled',
  'shipment.picked',
  'shipment.dropping_off',
  'shipment.delivered',
  'shipment.returned',
];

// GET /api/notifications?limit=20&unread=true&filter=transaction
export async function GET(request) {
  try {
    const session = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')) || 20));
    const unreadOnly = searchParams.get('unread') === 'true';
    const filter = searchParams.get('filter'); // 'transaction' | 'system'

    const where = {
      userId: session.id,
      ...(unreadOnly ? { readAt: null } : {}),
      ...(filter === 'transaction' ? { type: { in: TRANSACTION_TYPES } } : {}),
      ...(filter === 'system' ? { type: { notIn: TRANSACTION_TYPES } } : {}),
    };

    const [notifications, unreadCount, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.id, readAt: null },
      }),
      prisma.notification.count({
        where: { userId: session.id },
      }),
    ]);

    return NextResponse.json(
      { notifications, unreadCount, totalCount },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

// DELETE /api/notifications?clear=read | all
export async function DELETE(request) {
  try {
    const session = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const clear = searchParams.get('clear') || 'read'; // default bersihkan yang sudah dibaca

    const where = {
      userId: session.id,
      ...(clear === 'read' ? { readAt: { not: null } } : {}),
    };

    const result = await prisma.notification.deleteMany({ where });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: clear === 'all'
        ? 'Semua notifikasi berhasil dihapus.'
        : 'Semua notifikasi yang telah dibaca berhasil dihapus.',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
