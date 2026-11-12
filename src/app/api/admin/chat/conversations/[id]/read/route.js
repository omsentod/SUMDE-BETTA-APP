import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  try {
    await requirePermission(request, ['chat:view', 'chat:reply']);
    const { id } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Percakapan tidak ditemukan.' },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.chatMessage.updateMany({
        where: {
          conversationId: id,
          senderRole: 'CUSTOMER',
          isRead: false,
        },
        data: { isRead: true },
      }),
      prisma.conversation.update({
        where: { id },
        data: { unreadAdminCount: 0 },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal menandai pesan telah dibaca.' },
      { status: error.status || 500 }
    );
  }
}
