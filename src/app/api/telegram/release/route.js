import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  updateTelegramDropMessage,
  callTelegramApi,
  broadcastLiveRecap,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const now = new Date();

    // 1. Cari booking yang sudah lewat 15 menit dan belum lunas
    const expiredBookings = await prisma.product.findMany({
      where: {
        isDailyDrop: true,
        isSold: false,
        bookedUntil: {
          not: null,
          lte: now,
        },
      },
    });

    const released = [];

    for (const p of expiredBookings) {
      const prevBuyer = p.bookedBy || 'Pembeli';

      // Reset status booking di database
      const updated = await prisma.product.update({
        where: { id: p.id },
        data: {
          bookedBy: null,
          bookedTelegramId: null,
          bookedUntil: null,
        },
      });

      // Kembalikan tombol di Telegram ke status OPEN
      await updateTelegramDropMessage(updated, 'OPEN');

      // Kirim pesan alert di grup bahwa ikan kembali OPEN
      if (p.telegramChatId) {
        try {
          await callTelegramApi('sendMessage', {
            chat_id: p.telegramChatId,
            reply_to_message_id: p.telegramMessageId || undefined,
            text:
              `⚠️ *BOOKING EXPIRED!*\n` +
              `Waktu 15 menit @${prevBuyer} untuk ikan *${p.dropNumber || '#IKAN'} (${p.name})* telah habis.\n` +
              `🟢 Status ikan sekarang: *KEMBALI TERSEDIA (OPEN)*!\n` +
              `Silakan tekan tombol di postingan atas untuk mengambil.`,
            parse_mode: 'Markdown',
          });
        } catch (msgErr) {
          console.warn('Gagal kirim notif booking expired:', msgErr.message);
        }
      }

      released.push({ id: p.id, name: p.name, prevBuyer });

      // Jika produk terikat dengan Broadcast Event, update papan rekap di grup
      if (p.broadcastEventId) {
        try {
          await broadcastLiveRecap(p.broadcastEventId, p.telegramChatId);
        } catch {
          // ignore
        }
      }
    }

    // 2. Cari drop 24 jam yang sudah habis waktunya
    const expired24h = await prisma.product.findMany({
      where: {
        isDailyDrop: true,
        isSold: false,
        dropExpiresAt: {
          not: null,
          lte: now,
        },
      },
    });

    const closedDrops = [];

    for (const p of expired24h) {
      const updated = await prisma.product.update({
        where: { id: p.id },
        data: {
          isDailyDrop: false, // Tidak lagi berstatus Daily Drop aktif
          bookedBy: null,
          bookedTelegramId: null,
          bookedUntil: null,
        },
      });

      // Update pesan Telegram bahwa waktu 24 jam telah selesai
      if (p.telegramChatId && p.telegramMessageId) {
        try {
          await callTelegramApi('editMessageReplyMarkup', {
            chat_id: p.telegramChatId,
            message_id: p.telegramMessageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: '⏰ WAKTU DROP 24 JAM SELESAI', callback_data: `info:expired:${p.id}` }],
              ],
            },
          });
        } catch {
          // ignore
        }
      }

      closedDrops.push({ id: p.id, name: p.name });
    }

    return NextResponse.json({
      success: true,
      releasedBookings: released,
      closedDrops,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error auto-release drop:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/telegram/release
 * Melepaskan status booking secara manual ketika pembeli membatalkan transaksi di halaman checkout.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID wajib disertakan.' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    // Jika sudah lunas terjual, tidak bisa dilepas
    if (product.isSold) {
      return NextResponse.json({ error: 'Produk sudah resmi terjual.' }, { status: 400 });
    }

    // Reset status booking
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        bookedBy: null,
        bookedTelegramId: null,
        bookedUntil: null,
      },
    });

    // Kembalikan tombol di Telegram ke status OPEN
    await updateTelegramDropMessage(updated, 'OPEN');

    // Jika produk terkait dengan Broadcast Event, update papan rekap
    if (product.broadcastEventId) {
      try {
        await broadcastLiveRecap(product.broadcastEventId, product.telegramChatId);
      } catch (err) {
        console.warn('Gagal broadcastLiveRecap setelah cancel:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Booking berhasil dibatalkan dan status kembali OPEN.',
      product: updated,
    });
  } catch (error) {
    console.error('Error POST /api/telegram/release:', error);
    return NextResponse.json({ error: error.message || 'Gagal melepaskan booking.' }, { status: 500 });
  }
}
