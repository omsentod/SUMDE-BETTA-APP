import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// POST /api/notifications/:id/read — mark 1 notif as read.
export async function POST(request, { params }) {
  try {
    const session = await requireUser(request);
    const { id } = await params;

    // Guard ownership — cegah user mark notif orang lain.
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== session.id) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan.' }, { status: 404 });
    }

    if (!notif.readAt) {
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
