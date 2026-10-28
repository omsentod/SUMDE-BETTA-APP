import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import {
  isTelegramConfigured,
  getTelegramConfig,
  broadcastDropToTelegram,
  updateTelegramDropMessage,
  callTelegramApi,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * GET: Mengambil daftar produk drop Telegram, produk yang tersedia untuk dibroadcast,
 * status konfigurasi bot, dan ringkasan metrik drop.
 */
export async function GET(request) {
  try {
    await requirePermission(request, ['products:view', 'products:manage', 'events:view', 'events:manage']);

    const { defaultChatId } = getTelegramConfig();
    const isConfigured = isTelegramConfigured();

    const now = new Date();

    // 1. Ambil produk yang pernah/sedang di-drop ke Telegram
    const drops = await prisma.product.findMany({
      where: {
        OR: [
          { isDailyDrop: true },
          { telegramMessageId: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        form: true,
        age: true,
        statsForm: true,
        statsSpirit: true,
        image: true,
        images: true,
        videoUrl: true,
        isSold: true,
        isDailyDrop: true,
        dropNumber: true,
        dropExpiresAt: true,
        bookedBy: true,
        bookedTelegramId: true,
        bookedUntil: true,
        telegramMessageId: true,
        telegramChatId: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // 2. Ambil produk yang siap di-drop (belum terjual dan stok masih ada)
    const availableProducts = await prisma.product.findMany({
      where: {
        isSold: false,
        quantity: { gt: 0 },
        isArchived: false,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
        form: true,
        age: true,
        statsForm: true,
        statsSpirit: true,
        image: true,
        images: true,
        videoUrl: true,
        dropNumber: true,
        isDailyDrop: true,
      },
    });

    // 3. Hitung statistik drop
    const totalDropped = drops.length;
    const activeDrops = drops.filter(
      (d) => d.isDailyDrop && !d.isSold && (!d.dropExpiresAt || new Date(d.dropExpiresAt) > now)
    ).length;
    const bookedDrops = drops.filter(
      (d) => d.bookedUntil && new Date(d.bookedUntil) > now && !d.isSold
    ).length;
    const soldDrops = drops.filter((d) => d.isSold).length;

    return NextResponse.json({
      config: {
        isConfigured,
        hasChatId: Boolean(defaultChatId),
        defaultChatId: defaultChatId ? `${defaultChatId.slice(0, 4)}...${defaultChatId.slice(-3)}` : null,
      },
      stats: {
        totalDropped,
        activeDrops,
        bookedDrops,
        soldDrops,
      },
      drops,
      availableProducts,
    });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error GET /api/admin/telegram:', error);
    return NextResponse.json({ error: 'Gagal mengambil data broadcast Telegram.' }, { status: 500 });
  }
}

/**
 * POST: Broadcast produk ke grup Telegram (mendukung single atau multiple produk).
 */
export async function POST(request) {
  try {
    await requirePermission(request, ['products:manage', 'events:manage']);

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
    let items = body.items || [];
    const durationHours = Number(body.durationHours) || 24;

    if (!items.length && body.productId) {
      items = [{ productId: body.productId, dropNumber: body.dropNumber }];
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Pilih minimal satu produk untuk dibroadcast.' },
        { status: 400 }
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        { error: 'Maksimal 50 produk per satu kali broadcast masif.' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
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

        const { messageId, chatId } = await broadcastDropToTelegram(productWithDropInfo);

        await prisma.product.update({
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

        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (err) {
        console.error(`Gagal broadcast produk ${productId}:`, err.message);
        results.push({
          productId,
          ok: false,
          error: err.message,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Broadcast selesai. ${succeeded} berhasil, ${failed} gagal.`,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error POST /api/admin/telegram:', error);
    return NextResponse.json({ error: error.message || 'Gagal broadcast ke Telegram.' }, { status: 500 });
  }
}

/**
 * DELETE: Batalkan / Selesaikan status drop produk dari Telegram.
 */
export async function DELETE(request) {
  try {
    await requirePermission(request, ['products:manage', 'events:manage']);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'ID produk wajib disertakan.' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    // Reset status daily drop
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        isDailyDrop: false,
        bookedBy: null,
        bookedTelegramId: null,
        bookedUntil: null,
      },
    });

    // Update pesan di Telegram jika ada
    if (product.telegramChatId && product.telegramMessageId) {
      try {
        await callTelegramApi('editMessageReplyMarkup', {
          chat_id: product.telegramChatId,
          message_id: product.telegramMessageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⏰ FLASH DROP SELESAI', callback_data: `info:expired:${product.id}` }],
            ],
          },
        });
      } catch (tgErr) {
        console.warn('Gagal update markup Telegram:', tgErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Status drop untuk "${product.name}" berhasil diakhiri.`,
      product: updated,
    });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error DELETE /api/admin/telegram:', error);
    return NextResponse.json({ error: 'Gagal membatalkan status drop produk.' }, { status: 500 });
  }
}

/**
 * PUT: Buka kunci booking manual (release booking) atau sinkronisasi pesan ke Telegram.
 */
export async function PUT(request) {
  try {
    await requirePermission(request, ['products:manage', 'events:manage']);

    const body = await request.json();
    const { productId, action } = body;

    if (!productId) {
      return NextResponse.json({ error: 'ID produk wajib disertakan.' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    if (action === 'release-booking') {
      const prevBuyer = product.bookedBy || 'Pembeli';

      // Reset booking di DB
      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          bookedBy: null,
          bookedTelegramId: null,
          bookedUntil: null,
        },
      });

      // Kembalikan tombol Telegram ke status OPEN
      await updateTelegramDropMessage(updated, 'OPEN');

      // Notif info di grup
      if (product.telegramChatId) {
        try {
          await callTelegramApi('sendMessage', {
            chat_id: product.telegramChatId,
            reply_to_message_id: product.telegramMessageId || undefined,
            text:
              `📢 *BOOKING DILEPAS OLEH ADMIN*\n` +
              `Booking @${prevBuyer} untuk ikan *${product.dropNumber || '#IKAN'}* telah dibuka kembali oleh Admin.\n` +
              `🟢 Status ikan sekarang: *KEMBALI TERSEDIA (OPEN)*!`,
            parse_mode: 'Markdown',
          });
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        message: `Booking untuk "${product.name}" berhasil dilepas. Status kembali OPEN.`,
        product: updated,
      });
    }

    if (action === 'resync-telegram') {
      // Sinkronkan status terkini ke pesan Telegram
      const currentStatus = product.isSold
        ? 'SOLD'
        : product.bookedUntil && new Date(product.bookedUntil) > new Date()
        ? 'BOOKED'
        : 'OPEN';

      await updateTelegramDropMessage(product, currentStatus, product.bookedBy);

      return NextResponse.json({
        success: true,
        message: `Pesan Telegram untuk "${product.name}" berhasil disinkronkan.`,
      });
    }

    return NextResponse.json({ error: 'Aksi tidak valid.' }, { status: 400 });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error PUT /api/admin/telegram:', error);
    return NextResponse.json({ error: 'Gagal memperbarui status drop.' }, { status: 500 });
  }
}
