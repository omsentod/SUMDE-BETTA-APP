import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { broadcastDropToTelegram, isTelegramConfigured, getTelegramConfig } from '@/lib/telegram';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    await requirePermission(request, 'products:manage');

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN belum diatur di environment server (.env).' },
        { status: 400 }
      );
    }

    const { defaultChatId } = getTelegramConfig();
    if (!defaultChatId) {
      return NextResponse.json(
        { error: 'TELEGRAM_CHAT_ID grup belum diatur di environment server (.env).' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { items = [], durationHours = 24 } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Daftar produk yang akan dibroadcast tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        { error: 'Maksimal 50 produk per satu kali broadcast masif.' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = item.productId || item.id;
      const requestedDropNumber = item.dropNumber?.trim();

      try {
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new Error('Produk tidak ditemukan di database.');
        }

        if (product.isSold || product.quantity <= 0) {
          throw new Error('Produk sudah habis atau berstatus SOLD OUT.');
        }

        const finalDropNumber = requestedDropNumber || product.dropNumber || `#${String(i + 1).padStart(2, '0')}`;
        const productWithDropInfo = {
          ...product,
          dropNumber: finalDropNumber,
        };

        // Kirim foto/video ke grup Telegram
        const { messageId, chatId } = await broadcastDropToTelegram(productWithDropInfo);

        // Update status drop di database
        const updated = await prisma.product.update({
          where: { id: productId },
          data: {
            isDailyDrop: true,
            dropNumber: finalDropNumber,
            dropExpiresAt: expiresAt,
            telegramMessageId: messageId,
            telegramChatId: chatId,
            bookedBy: null,
            bookedTelegramId: null,
            bookedUntil: null,
          },
        });

        results.push({
          productId,
          name: product.name,
          dropNumber: finalDropNumber,
          ok: true,
          messageId,
        });
        succeeded++;
      } catch (err) {
        console.error(`Gagal broadcast produk ${productId}:`, err.message);
        results.push({
          productId,
          dropNumber: requestedDropNumber || '-',
          ok: false,
          error: err.message,
        });
        failed++;
      }

      // Jeda 700ms antar pengiriman untuk menghormati rate limit Telegram API
      if (i < items.length - 1) {
        await delay(700);
      }
    }

    return NextResponse.json({
      success: true,
      total: items.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error('Error bulk broadcast to telegram:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
