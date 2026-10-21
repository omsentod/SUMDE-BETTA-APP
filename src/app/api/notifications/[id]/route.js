import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// DELETE /api/notifications/:id — Hapus 1 notifikasi milik user session
export async function DELETE(request, { params }) {
  try {
    const session = await requireUser(request);
    const { id } = await params;

    // Guard ownership — user hanya bisa menghapus notifikasi miliknya sendiri
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== session.id) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan.' }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Notifikasi berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
