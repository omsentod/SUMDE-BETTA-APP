import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getTelegramConfig,
  answerCallbackQuery,
  updateTelegramDropMessage,
  callTelegramApi,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

function formatTime(date) {
  try {
    return new Date(date).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  } catch {
    return '';
  }
}

export async function POST(request) {
  try {
    const { secret, appUrl } = getTelegramConfig();

    // Verifikasi Secret Token jika dikonfigurasi di .env
    if (secret) {
      const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized secret token.' }, { status: 403 });
      }
    }

    const update = await request.json();

    // 1. Tangani Klik Tombol (Callback Query)
    if (update.callback_query) {
      const { id: queryId, from, data, message } = update.callback_query;
      const chatId = message?.chat?.id;

      if (!data) {
        await answerCallbackQuery(queryId, 'Aksi tidak valid.');
        return NextResponse.json({ ok: true });
      }

      // Kasus tombol info (SOLD / BOOKED)
      if (data.startsWith('info:sold:')) {
        await answerCallbackQuery(queryId, 'Ikan ini sudah RESMI TERJUAL (SOLD OUT).', true);
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith('info:booked:')) {
        const pId = data.replace('info:booked:', '');
        const p = await prisma.product.findUnique({ where: { id: pId } });
        const sisaMenit = p?.bookedUntil ? Math.max(0, Math.ceil((new Date(p.bookedUntil) - new Date()) / 60000)) : 0;
        await answerCallbackQuery(
          queryId,
          `Ikan ini sedang di-booking oleh @${p?.bookedBy || 'pembeli'}. Sisa waktu pembayaran: ~${sisaMenit} menit.`,
          true
        );
        return NextResponse.json({ ok: true });
      }

      // Kasus TAKE / AMBIL IKAN
      if (data.startsWith('take:')) {
        const productId = data.replace('take:', '');

        const buyerUsername = from.username ? `@${from.username}` : from.first_name || 'Pembeli';
        const buyerDisplay = from.username || from.first_name || 'Pembeli';

        // Eksekusi Atomic Transaction untuk mengunci ikan
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: productId },
          });

          if (!product) {
            return { ok: false, error: 'Ikan tidak ditemukan di katalog.' };
          }

          if (product.isSold) {
            return { ok: false, error: 'Maaf, ikan ini sudah resmi TERJUAL (SOLD OUT)!' };
          }

          const now = new Date();
          const isCurrentlyBooked = product.bookedUntil && new Date(product.bookedUntil) > now;

          if (isCurrentlyBooked) {
            // Jika diklik ulang oleh user yang sama, tetap berikan link
            if (String(product.bookedTelegramId) === String(from.id)) {
              return { ok: true, alreadyBookedByMe: true, product };
            }
            return {
              ok: false,
              error: `Maaf, ikan ini baru saja diamankan oleh @${product.bookedBy || 'orang lain'}! Tunggu 15 menit, jika tidak dibayar ikan akan kembali OPEN.`,
            };
          }

          // Booking 15 menit
          const bookedUntil = new Date(Date.now() + 15 * 60 * 1000);
          const updated = await tx.product.update({
            where: { id: productId },
            data: {
              bookedBy: buyerDisplay,
              bookedTelegramId: String(from.id),
              bookedUntil,
              telegramMessageId: message?.message_id || product.telegramMessageId,
              telegramChatId: String(chatId || product.telegramChatId || ''),
            },
          });

          return { ok: true, updated, bookedUntil };
        });

        if (!result.ok) {
          // Tampilkan pop-up peringatan jika kalah cepat
          await answerCallbackQuery(queryId, result.error, true);
          return NextResponse.json({ ok: true });
        }

        // Sukses mengamankan ikan!
        await answerCallbackQuery(queryId, 'Berhasil diamankan! Cek pesan balasan untuk link pembayaran.', false);

        const targetProduct = result.updated || result.product;
        const checkoutUrl = `${appUrl}/checkout?buyNow=${targetProduct.id}&telegramUser=${encodeURIComponent(buyerDisplay)}`;
        const timeLimitStr = formatTime(targetProduct.bookedUntil || result.bookedUntil);

        // 1. Update tombol pesan asli di grup menjadi "Sedang Di-booking"
        await updateTelegramDropMessage(targetProduct, 'BOOKED', buyerDisplay);

        // 2. Kirim reply pengumuman wasit di grup
        const replyText =
          `⚡ *DEAL TERCEPAT!*\n` +
          `Selamat ${buyerUsername}, kamu tercepat mengamankan:\n` +
          `🔖 *${targetProduct.dropNumber || '#IKAN'} - ${targetProduct.name}*\n\n` +
          `⏳ *Batas Waktu Bayar:* 15 Menit (Hingga ${timeLimitStr} WIB)\n` +
          `💳 *Selesaikan Transaksi & Ongkir di Sini:*\n` +
          `👉 [Klik Di Sini Untuk Checkout & Pembayaran](${checkoutUrl})\n\n` +
          `⚠️ _Jika dalam 15 menit belum dibayar di website, booking otomatis dibatalkan dan ikan kembali OPEN._`;

        try {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            reply_to_message_id: message?.message_id,
            text: replyText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Bayar Sekarang di Website', url: checkoutUrl }],
              ],
            },
          });
        } catch (msgErr) {
          console.error('Gagal mengirim reply wasit:', msgErr.message);
        }

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
