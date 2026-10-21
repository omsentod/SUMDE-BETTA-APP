import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { broadcastDropToTelegram, isTelegramConfigured } from '@/lib/telegram';

export async function POST(request, { params }) {
  try {
    await requirePermission(request, 'products:manage');

    if (!isTelegramConfigured()) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN belum diatur di .env.' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { dropNumber, durationHours = 24 } = body;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    if (product.isSold) {
      return NextResponse.json({ error: 'Produk sudah berstatus SOLD OUT.' }, { status: 400 });
    }

    // Jika admin menyertakan nomor drop baru
    const finalDropNumber = dropNumber || product.dropNumber || `#${product.id.slice(0, 4).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    const productWithDropInfo = {
      ...product,
      dropNumber: finalDropNumber,
    };

    // Kirim ke grup Telegram
    const { messageId, chatId } = await broadcastDropToTelegram(productWithDropInfo);

    // Simpan status drop dan telegram metadata ke database
    const updated = await prisma.product.update({
      where: { id },
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

    return NextResponse.json({
      success: true,
      message: `Berhasil membroadcast ikan ${finalDropNumber} ke Telegram!`,
      product: updated,
    });
  } catch (error) {
    console.error('Error broadcast drop to telegram:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
