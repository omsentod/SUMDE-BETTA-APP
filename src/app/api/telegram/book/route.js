import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  updateTelegramDropMessage,
  broadcastLiveRecap,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * POST /api/telegram/book
 * Mengunci ikan selama 15 menit ketika pembeli mengklik tombol DEAL di Telegram
 * dan membuka halaman checkout.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId, telegramUser, telegramId } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID wajib disertakan.' }, { status: 400 });
    }

    const cleanUser = String(telegramUser || 'Pembeli').replace(/^@/, '').trim();
    const cleanId = telegramId ? String(telegramId) : null;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return { ok: false, status: 404, error: 'Produk tidak ditemukan di katalog.' };
      }

      if (product.isSold) {
        return { ok: false, status: 400, error: 'Maaf, ikan ini sudah resmi TERJUAL (SOLD OUT).' };
      }

      const now = new Date();
      const isCurrentlyBooked = product.bookedUntil && new Date(product.bookedUntil) > now;

      // Jika sedang di-book oleh user yang sama, perpanjang waktu atau biarkan
      if (isCurrentlyBooked) {
        if (
          (cleanId && String(product.bookedTelegramId) === cleanId) ||
          (product.bookedBy && product.bookedBy.toLowerCase() === cleanUser.toLowerCase())
        ) {
          return { ok: true, product, alreadyBookedByMe: true };
        }

        return {
          ok: false,
          status: 409,
          error: `Ikan ini sedang di-booking oleh @${product.bookedBy || 'orang lain'}! Tunggu 15 menit jika pembayaran tidak diselesaikan.`,
        };
      }

      // Booking 15 menit
      const bookedUntil = new Date(Date.now() + 15 * 60 * 1000);
      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          bookedBy: cleanUser,
          bookedTelegramId: cleanId,
          bookedUntil,
        },
      });

      return { ok: true, updated, bookedUntil, previousState: product };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    const targetProduct = result.updated || result.product;

    // 1. Update tombol pesan Telegram di grup menjadi "Sedang Di-Book"
    await updateTelegramDropMessage(targetProduct, 'BOOKED', cleanUser);

    // 2. Jika produk terkait dengan Broadcast Event, siarkan Live Recap terbaru ke grup
    if (targetProduct.broadcastEventId) {
      try {
        await broadcastLiveRecap(targetProduct.broadcastEventId, targetProduct.telegramChatId);
      } catch (recapErr) {
        console.warn('Gagal broadcastLiveRecap saat booking:', recapErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ikan berhasil diamankan untuk @${cleanUser}.`,
      product: {
        id: targetProduct.id,
        name: targetProduct.name,
        dropNumber: targetProduct.dropNumber,
        bookedBy: targetProduct.bookedBy,
        bookedUntil: targetProduct.bookedUntil,
      },
    });
  } catch (error) {
    console.error('Error POST /api/telegram/book:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses booking.' }, { status: 500 });
  }
}

