import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createChatTokenRequest, isEnabled } from '@/lib/ably';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    if (!isEnabled()) {
      return NextResponse.json({ error: 'Ably tidak dikonfigurasi.' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const guestSessionId = searchParams.get('guestSessionId');

    const session = await getSession(request);

    // Kasus 1: Admin
    if (session?.role === 'admin') {
      const tokenRequest = await createChatTokenRequest({
        clientId: `admin:${session.id}`,
        channels: ['admin:chat', 'chat:*', 'chat:status'],
        allowPublish: true,
      });
      return NextResponse.json(tokenRequest);
    }

    // Kasus 2: User terdaftar (Customer)
    if (session?.id) {
      const allowedChannels = [`user:${session.id}`, 'chat:status'];

      // Verifikasi bahwa conversationId milik user ini jika dikirimkan
      if (conversationId) {
        const convo = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { userId: true },
        });
        if (convo && convo.userId === session.id) {
          allowedChannels.push(`chat:${conversationId}`);
        }
      }

      const tokenRequest = await createChatTokenRequest({
        clientId: `user:${session.id}`,
        channels: allowedChannels,
      });
      return NextResponse.json(tokenRequest);
    }

    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu untuk mengakses realtime chat.' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghasilkan token chat.' },
      { status: 500 }
    );
  }
}
