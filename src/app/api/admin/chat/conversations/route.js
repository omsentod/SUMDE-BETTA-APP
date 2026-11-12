import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, ['chat:view', 'chat:reply']);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status'); // 'OPEN' | 'CLOSED' | null (all)
    const q = (searchParams.get('q') || '').trim();

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { guestName: { contains: q } },
        { guestEmail: { contains: q } },
        { user: { name: { contains: q } } },
        { user: { email: { contains: q } } },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Pesan terakhir untuk preview baris
        },
      },
    });

    // Untuk percakapan tamu yang belum terhubung userId tapi email-nya terdaftar di sistem User,
    // ambil avatarUrl dan profil user mereka secara otomatis
    const unlinkedGuestEmails = conversations
      .filter((c) => !c.userId && c.guestEmail)
      .map((c) => c.guestEmail.toLowerCase());

    const guestUsersMap = new Map();
    if (unlinkedGuestEmails.length > 0) {
      const matchingUsers = await prisma.user.findMany({
        where: { email: { in: unlinkedGuestEmails } },
        select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
      });
      matchingUsers.forEach((u) => {
        guestUsersMap.set(u.email.toLowerCase(), u);
      });
    }

    const formatted = conversations.map((convo) => {
      const lastMsg = convo.messages[0] || null;
      const matchedUser = convo.user || (convo.guestEmail ? guestUsersMap.get(convo.guestEmail.toLowerCase()) : null);
      return {
        id: convo.id,
        status: convo.status,
        customerName: matchedUser?.name || convo.guestName || 'Pengunjung Toko',
        customerEmail: matchedUser?.email || convo.guestEmail || null,
        customerPhone: matchedUser?.phone || null,
        isGuest: !convo.userId && !matchedUser,
        avatarUrl: matchedUser?.avatarUrl || null,
        unreadAdminCount: convo.unreadAdminCount,
        lastMessageAt: convo.lastMessageAt,
        lastMessagePreview: lastMsg ? lastMsg.message : null,
        lastSenderRole: lastMsg ? lastMsg.senderRole : null,
      };
    });

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat daftar percakapan.' },
      { status: error.status || 500 }
    );
  }
}
