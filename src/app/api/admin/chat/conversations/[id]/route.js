import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { publishToConversation } from '@/lib/ably';
import { createNotification } from '@/lib/notification';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    await requirePermission(request, ['chat:view', 'chat:reply']);
    const { id } = await context.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            createdAt: true,
            _count: {
              select: { orders: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 150,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Percakapan tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Ambil profil user jika terhubung langsung via userId atau cocok via guestEmail
    let userProfile = conversation.user;
    if (!userProfile && conversation.guestEmail) {
      userProfile = await prisma.user.findUnique({
        where: { email: conversation.guestEmail.toLowerCase() },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
      });
    }

    // Ambil riwayat ringkas 3 order terakhir jika user terdaftar
    const effectiveUserId = conversation.userId || userProfile?.id;
    let recentOrders = [];
    if (effectiveUserId) {
      recentOrders = await prisma.order.findMany({
        where: { userId: effectiveUserId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
        },
      });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        customerName: userProfile?.name || conversation.guestName || 'Pengunjung Toko',
        customerEmail: userProfile?.email || conversation.guestEmail || null,
        customerPhone: userProfile?.phone || null,
        isGuest: !effectiveUserId,
        avatarUrl: userProfile?.avatarUrl || null,
        userSince: userProfile?.createdAt || conversation.createdAt,
        totalOrdersCount: userProfile?._count?.orders || 0,
        recentOrders,
        unreadAdminCount: conversation.unreadAdminCount,
        unreadCustomerCount: conversation.unreadCustomerCount,
        lastMessageAt: conversation.lastMessageAt,
      },
      messages: conversation.messages,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat detail percakapan.' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    const session = await requirePermission(request, 'chat:reply');
    const { id } = await context.params;
    const body = await request.json();

    const rawMessage = (body.message || '').trim();
    if (!rawMessage) {
      return NextResponse.json(
        { error: 'Pesan balasan tidak boleh kosong.' },
        { status: 400 }
      );
    }
    if (rawMessage.length > 2000) {
      return NextResponse.json(
        { error: 'Pesan terlalu panjang (maksimal 2000 karakter).' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Percakapan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const attachedType = ['PRODUCT', 'ORDER'].includes(body.attachedType)
      ? body.attachedType
      : null;
    const attachedId = body.attachedId ? String(body.attachedId).slice(0, 100) : null;
    const attachedMeta = body.attachedMeta
      ? typeof body.attachedMeta === 'string'
        ? body.attachedMeta.slice(0, 2000)
        : JSON.stringify(body.attachedMeta).slice(0, 2000)
      : null;

    const [newMessage] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: id,
          senderRole: 'ADMIN',
          senderId: session.id,
          message: rawMessage,
          attachedType,
          attachedId,
          attachedMeta,
          isRead: false,
        },
      }),
      prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          unreadCustomerCount: { increment: 1 },
          status: 'OPEN',
        },
      }),
    ]);

    // Broadcast ke channel customer via Ably
    await publishToConversation(id, 'new-message', newMessage);

    // Jika user terdaftar, kirimkan notifikasi ke akun mereka (Lonceng DB + Web Push)
    // Gunakan overwriteType: true agar pesan chat baru menimpa chat sebelumnya (hanya 1 baris chat terbaru di notifikasi)
    if (conversation.userId) {
      createNotification({
        userId: conversation.userId,
        type: 'chat.reply',
        title: 'Pesan Baru dari Admin SUMDE BETTA',
        body: rawMessage.slice(0, 100),
        link: '/customer/dashboard?openChat=1',
        imageUrl: '/img/logo.png',
        overwriteType: true,
      }).catch((err) => console.warn('[Notification] Dispatch failed:', err.message));
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengirimkan balasan admin.' },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(request, context) {
  try {
    await requirePermission(request, 'chat:reply');
    const { id } = await context.params;
    const body = await request.json();

    const allowed = ['OPEN', 'CLOSED'];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: 'Status tidak valid. Pilihan: OPEN, CLOSED' },
        { status: 400 }
      );
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status: body.status },
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengubah status percakapan.' },
      { status: error.status || 500 }
    );
  }
}
