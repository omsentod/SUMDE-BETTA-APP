import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { publishToConversation } from '@/lib/ably';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/messages/batch-delete
 * Menghapus beberapa pesan sekaligus dalam mode Multi-Select (WhatsApp-Style)
 */
export async function POST(request) {
  try {
    const session = await getSession(request);
    if (!session?.id) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan untuk menghapus pesan.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const messageIds = Array.isArray(body.messageIds) ? body.messageIds : [];

    if (messageIds.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada pesan yang dipilih untuk dihapus.' },
        { status: 400 }
      );
    }

    if (messageIds.length > 50) {
      return NextResponse.json(
        { error: 'Maksimal 50 pesan yang dapat dihapus sekaligus.' },
        { status: 400 }
      );
    }

    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: messageIds } },
      include: { conversation: true },
    });

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Pesan yang dipilih tidak ditemukan.' },
        { status: 404 }
      );
    }

    const isAdmin =
      session.role === 'admin' ||
      (Array.isArray(session.permissions) && session.permissions.includes('chat:reply'));

    // Filter pesan yang berhak dihapus oleh pemohon
    const authorizedMessages = messages.filter((m) => {
      if (isAdmin) return true;
      return (
        m.senderRole === 'CUSTOMER' &&
        (m.senderId === session.id || m.conversation?.userId === session.id)
      );
    });

    if (authorizedMessages.length === 0) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki hak untuk menghapus pesan yang dipilih.' },
        { status: 403 }
      );
    }

    const authorizedIds = authorizedMessages.map((m) => m.id);

    // Update soft-delete di database
    await prisma.chatMessage.updateMany({
      where: { id: { in: authorizedIds } },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        message: 'Pesan ini telah dihapus',
        attachedType: null,
        attachedId: null,
        attachedMeta: null,
      },
    });

    // Kelompokkan per percakapan untuk publish event Ably
    const groupedByConvo = {};
    for (const m of authorizedMessages) {
      if (!groupedByConvo[m.conversationId]) {
        groupedByConvo[m.conversationId] = [];
      }
      groupedByConvo[m.conversationId].push(m.id);
    }

    for (const [convoId, ids] of Object.entries(groupedByConvo)) {
      await publishToConversation(convoId, 'messages-deleted', { ids });
    }

    return NextResponse.json({
      success: true,
      deletedIds: authorizedIds,
    });
  } catch (err) {
    console.error('Error saat batch-delete pesan chat:', err.message);
    return NextResponse.json(
      { error: 'Gagal memproses penghapusan pesan.' },
      { status: 500 }
    );
  }
}
