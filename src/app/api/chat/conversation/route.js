import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { publishToConversation, publishToAdminChat } from '@/lib/ably';
import { consume, clientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSession(request);
    if (!session?.id) {
      return NextResponse.json({
        conversation: null,
        messages: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const guestSessionId = searchParams.get('guestSessionId');

    let conversation = null;

    if (session?.id) {
      // 1. User terautentikasi (Customer)
      conversation = await prisma.conversation.findFirst({
        where: { userId: session.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 100,
          },
        },
      });

      // Jika user punya riwayat obrolan sebagai guest sebelumnya, gabungkan (merge) ke akun user
      if (guestSessionId) {
        const guestConvo = await prisma.conversation.findUnique({
          where: { guestSessionId },
          include: { messages: true },
        });

        if (guestConvo && guestConvo.id !== conversation?.id) {
          if (!conversation) {
            // Ubah guest conversation menjadi user conversation
            conversation = await prisma.conversation.update({
              where: { id: guestConvo.id },
              data: {
                userId: session.id,
                guestSessionId: null,
              },
              include: {
                messages: {
                  orderBy: { createdAt: 'asc' },
                  take: 100,
                },
              },
            });
          } else {
            // Pindahkan pesan guest ke percakapan user
            await prisma.chatMessage.updateMany({
              where: { conversationId: guestConvo.id },
              data: { conversationId: conversation.id },
            });
            await prisma.conversation.delete({
              where: { id: guestConvo.id },
            });
            // Ambil ulang pesan terkini
            conversation = await prisma.conversation.findUnique({
              where: { id: conversation.id },
              include: {
                messages: {
                  orderBy: { createdAt: 'asc' },
                  take: 100,
                },
              },
            });
          }
        }
      }
    } else if (guestSessionId) {
      // 2. Guest dengan guestSessionId
      conversation = await prisma.conversation.findUnique({
        where: { guestSessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 100,
          },
        },
      });
    }

    if (!conversation) {
      return NextResponse.json({
        conversation: null,
        messages: [],
      });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        guestName: conversation.guestName,
        guestEmail: conversation.guestEmail,
        unreadCustomerCount: conversation.unreadCustomerCount,
        lastMessageAt: conversation.lastMessageAt,
      },
      messages: conversation.messages,
    });
  } catch (err) {
    console.error('Error saat GET conversation:', err.message);
    return NextResponse.json(
      { error: 'Gagal memuat percakapan chat.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const ip = clientIp(request);
    const session = await getSession(request);

    if (!session?.id) {
      return NextResponse.json(
        { error: 'Silakan login terlebih dahulu untuk menggunakan fitur chat.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const rawMessage = (body.message || '').trim();
    if (!rawMessage) {
      return NextResponse.json(
        { error: 'Pesan tidak boleh kosong.' },
        { status: 400 }
      );
    }
    if (rawMessage.length > 2000) {
      return NextResponse.json(
        { error: 'Pesan terlalu panjang (maksimal 2000 karakter).' },
        { status: 400 }
      );
    }

    // Rate limiting
    const rateLimitKey = session?.id
      ? `chat:user:${session.id}`
      : `chat:guest:${ip}`;
    const rateLimitConfig = session?.id
      ? { limit: 25, windowMs: 60 * 1000 }
      : { limit: 8, windowMs: 60 * 1000 };

    const { ok, retryAfterSec } = consume(rateLimitKey, rateLimitConfig);
    if (!ok) {
      return NextResponse.json(
        { error: `Terlalu banyak pesan terkirim. Mohon tunggu ${retryAfterSec} detik.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const guestSessionId = body.guestSessionId ? String(body.guestSessionId).trim() : null;
    const guestName = body.guestName ? String(body.guestName).trim().slice(0, 50) : null;
    const guestEmail = body.guestEmail ? String(body.guestEmail).trim().toLowerCase().slice(0, 100) : null;

    let conversation = null;

    if (session?.id) {
      conversation = await prisma.conversation.findFirst({
        where: { userId: session.id },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            userId: session.id,
            status: 'OPEN',
          },
        });
      }
    } else {
      if (!guestSessionId) {
        return NextResponse.json(
          { error: 'guestSessionId diperlukan untuk pengunjung tanpa login.' },
          { status: 400 }
        );
      }

      conversation = await prisma.conversation.findUnique({
        where: { guestSessionId },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            guestSessionId,
            guestName: guestName || 'Pengunjung Toko',
            guestEmail: guestEmail || null,
            status: 'OPEN',
          },
        });
      } else if (guestName && !conversation.guestName) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { guestName, guestEmail: guestEmail || conversation.guestEmail },
        });
      }
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

    // Cek apakah ada jawaban otomatis yang dipasangkan dengan pertanyaan ini
    let autoReplyText = typeof body.autoAnswer === 'string' ? body.autoAnswer.trim() : null;
    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : null;

    if (!autoReplyText && templateId) {
      try {
        const tmpl = await prisma.chatTemplate.findUnique({
          where: { id: templateId },
        });
        if (tmpl && tmpl.isActive && tmpl.isAutoReply && tmpl.answerText) {
          autoReplyText = tmpl.answerText.trim();
        }
      } catch (err) {
        console.warn('Gagal mencari template auto-reply:', err.message);
      }
    }

    // Simpan pesan pelanggan ke DB & update percakapan
    const newMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderRole: 'CUSTOMER',
        senderId: session?.id || null,
        message: rawMessage,
        attachedType,
        attachedId,
        attachedMeta,
        isRead: false,
      },
    });

    let autoReplyMessage = null;
    if (autoReplyText) {
      // Simpan balasan otomatis toko sebagai pesan dari ADMIN
      autoReplyMessage = await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderRole: 'ADMIN',
          senderId: null,
          message: autoReplyText,
          attachedType: null,
          attachedId: null,
          attachedMeta: JSON.stringify({ isAutoReply: true }),
          isRead: true, // Langsung dibaca customer di layarnya
        },
      });
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadAdminCount: { increment: 1 },
        status: 'OPEN',
      },
    });

    // Broadcast realtime via Ably
    const senderDisplay = session?.id
      ? 'Customer'
      : conversation.guestName || 'Pengunjung';

    const publishPromises = [
      publishToConversation(conversation.id, 'new-message', newMessage),
      publishToAdminChat('new-inbound-chat', {
        conversationId: conversation.id,
        senderName: senderDisplay,
        preview: rawMessage.slice(0, 100),
        attachedType,
        createdAt: newMessage.createdAt,
      }),
    ];

    if (autoReplyMessage) {
      publishPromises.push(
        publishToConversation(conversation.id, 'new-message', autoReplyMessage)
      );
    }

    await Promise.allSettled(publishPromises);

    return NextResponse.json({
      success: true,
      message: newMessage,
      autoReply: autoReplyMessage,
      conversationId: conversation.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengirimkan pesan.' },
      { status: 500 }
    );
  }
}
