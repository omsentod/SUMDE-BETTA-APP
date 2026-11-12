import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await getSession(request);
    if (!session?.id) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
    }

    const body = await request.json();
    const conversationId = body.conversationId;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId wajib diisi.' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
    }

    // Validasi kepemilikan
    const isOwner = session.role === 'admin' || conversation.userId === session.id;

    if (!isOwner) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.chatMessage.updateMany({
        where: {
          conversationId,
          senderRole: 'ADMIN',
          isRead: false,
        },
        data: { isRead: true },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { unreadCustomerCount: 0 },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error saat POST chat/read:', err.message);
    return NextResponse.json(
      { error: 'Gagal memperbarui status baca.' },
      { status: 500 }
    );
  }
}
