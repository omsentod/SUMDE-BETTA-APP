import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import {
  isTelegramConfigured,
  getTelegramConfig,
  broadcastDropToTelegram,
  updateTelegramDropMessage,
  callTelegramApi,
  formatEventHeaderMessage,
  formatLiveRecapMessage,
  broadcastLiveRecap,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * GET: Mengambil daftar Event Broadcast Telegram, produk drop, produk yang tersedia,
 * status konfigurasi bot, dan ringkasan metrik.
 */
export async function GET(request) {
  try {
    await requirePermission(request, ['products:view', 'products:manage', 'events:view', 'events:manage']);

    const { defaultChatId } = getTelegramConfig();
    const isConfigured = isTelegramConfigured();

    const now = new Date();

    // 1. Ambil semua Event Broadcast Telegram (dengan produk-produk di dalamnya)
    let events = [];
    if (prisma.telegramBroadcastEvent?.findMany) {
      events = await prisma.telegramBroadcastEvent.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              price: true,
              image: true,
              category: true,
              form: true,
              age: true,
              statsForm: true,
              statsSpirit: true,
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
              broadcastEventId: true,
            },
            orderBy: { dropNumber: 'asc' },
          },
        },
      });
    }

    // 2. Ambil produk yang pernah/sedang di-drop ke Telegram
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
        broadcastEventId: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // 3. Ambil produk yang siap di-drop (belum terjual dan stok masih ada)
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
        broadcastEventId: true,
      },
    });

    // 4. Hitung statistik drop & event
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
        totalEvents: events.length,
        activeEvents: events.filter((e) => e.status === 'ACTIVE').length,
      },
      events,
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
 * POST: Menangani Event Broadcast (Create, Update, Broadcast, Close, Recap).
 */
export async function POST(request) {
  try {
    await requirePermission(request, ['products:manage', 'events:manage']);

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // 1. BUAT EVENT BARU (DRAFT)
    if (action === 'create-event') {
      const {
        title,
        description,
        date,
        durationHours,
        isLifetime,
        prefix = 'R-',
        startNumber = 1,
        padZero = true,
      } = body;

      if (!title || !title.trim()) {
        return NextResponse.json({ error: 'Nama/Judul Event wajib diisi.' }, { status: 400 });
      }

      const event = await prisma.telegramBroadcastEvent.create({
        data: {
          title: title.trim(),
          description: description?.trim() || null,
          date: date ? new Date(date) : new Date(),
          durationHours: isLifetime ? null : (Number(durationHours) || 24),
          isLifetime: Boolean(isLifetime),
          prefix: prefix?.trim() || 'R-',
          startNumber: Number(startNumber) || 1,
          padZero: padZero !== false,
          status: 'DRAFT',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Event broadcast berhasil dibuat sebagai Draft.',
        event,
      });
    }

    // 2. UPDATE EVENT & DAFTAR PRODUK (DENGAN PENOMORAN OTOMATIS)
    if (action === 'update-event') {
      const {
        eventId,
        title,
        description,
        date,
        durationHours,
        isLifetime,
        prefix = 'R-',
        startNumber = 1,
        padZero = true,
        productIds = [],
      } = body;

      if (!eventId) {
        return NextResponse.json({ error: 'Event ID wajib disertakan.' }, { status: 400 });
      }

      const existingEvent = await prisma.telegramBroadcastEvent.findUnique({
        where: { id: eventId },
      });

      if (!existingEvent) {
        return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
      }

      const cleanPrefix = prefix?.trim() || 'R-';
      const cleanStart = Number(startNumber) || 1;
      const cleanPad = padZero !== false;

      // Update produk dalam database
      await prisma.$transaction(async (tx) => {
        // Lepaskan produk lama yang sebelumnya terikat ke event ini tapi sekarang tidak dipilih
        await tx.product.updateMany({
          where: {
            broadcastEventId: eventId,
            id: { notIn: productIds },
          },
          data: {
            broadcastEventId: null,
          },
        });

        // Hubungkan produk terpilih dan atur kode urutnya
        for (let i = 0; i < productIds.length; i++) {
          const pId = productIds[i];
          const numVal = cleanStart + i;
          const numFormatted = cleanPad ? String(numVal).padStart(2, '0') : String(numVal);
          const dropCode = `${cleanPrefix}${numFormatted}`;

          await tx.product.update({
            where: { id: pId },
            data: {
              broadcastEventId: eventId,
              dropNumber: dropCode,
            },
          });
        }

        // Update info event
        await tx.telegramBroadcastEvent.update({
          where: { id: eventId },
          data: {
            title: title ? title.trim() : existingEvent.title,
            description: description !== undefined ? description?.trim() : existingEvent.description,
            date: date ? new Date(date) : existingEvent.date,
            durationHours: isLifetime ? null : (Number(durationHours) || 24),
            isLifetime: Boolean(isLifetime),
            prefix: cleanPrefix,
            startNumber: cleanStart,
            padZero: cleanPad,
            totalItems: productIds.length,
          },
        });
      });

      const updatedEvent = await prisma.telegramBroadcastEvent.findUnique({
        where: { id: eventId },
        include: {
          products: {
            orderBy: { dropNumber: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Event dan produk berhasil diperbarui.',
        event: updatedEvent,
      });
    }

    // 3. SIARKAN EVENT KE TELEGRAM (HEADER + PRODUK BERURUTAN + LIVE RECAP)
    if (action === 'broadcast-event') {
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

      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID wajib disertakan.' }, { status: 400 });
      }

      const event = await prisma.telegramBroadcastEvent.findUnique({
        where: { id: eventId },
        include: {
          products: {
            orderBy: { dropNumber: 'asc' },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
      }

      if (!event.products || event.products.length === 0) {
        return NextResponse.json(
          { error: 'Event ini belum memiliki produk. Tambahkan produk terlebih dahulu.' },
          { status: 400 }
        );
      }

      const chatId = defaultChatId;
      const expiresAt = event.isLifetime
        ? null
        : new Date(Date.now() + (event.durationHours || 24) * 60 * 60 * 1000);

      const firstCode = event.products[0]?.dropNumber || 'R-01';
      const lastCode = event.products[event.products.length - 1]?.dropNumber || firstCode;

      // Langkah 1: Kirim Banner Pengumuman Pembuka
      const headerText = formatEventHeaderMessage(event, event.products.length, firstCode, lastCode);
      let headerMessageId = null;

      try {
        const headerRes = await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: headerText,
          parse_mode: 'Markdown',
        });
        headerMessageId = headerRes?.message_id || null;
      } catch (headerErr) {
        console.error('Gagal kirim banner header pengumuman:', headerErr.message);
      }

      // Langkah 2: Kirim Tiap Produk Berurutan
      const results = [];
      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < event.products.length; i++) {
        const product = event.products[i];

        try {
          // Siapkan data produk untuk dibroadcast
          const productWithDropInfo = {
            ...product,
            dropNumber: product.dropNumber || `#${String(i + 1).padStart(2, '0')}`,
            broadcastEventId: event.id,
          };

          const { messageId } = await broadcastDropToTelegram(productWithDropInfo, chatId);

          await prisma.product.update({
            where: { id: product.id },
            data: {
              isDailyDrop: true,
              dropExpiresAt: expiresAt,
              telegramMessageId: messageId,
              telegramChatId: String(chatId),
              bookedBy: null,
              bookedTelegramId: null,
              bookedUntil: null,
            },
          });

          results.push({
            productId: product.id,
            name: product.name,
            dropNumber: productWithDropInfo.dropNumber,
            ok: true,
            messageId,
          });
          succeeded++;

          // Jeda aman anti flood limit Telegram
          if (i < event.products.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 350));
          }
        } catch (itemErr) {
          console.error(`Gagal kirim produk ${product.id} ke Telegram:`, itemErr.message);
          results.push({
            productId: product.id,
            ok: false,
            error: itemErr.message,
          });
          failed++;
        }
      }

      // Langkah 3: Kirim Papan Live Recap Pertama Kali
      const updatedProducts = await prisma.product.findMany({
        where: { broadcastEventId: event.id },
        orderBy: { dropNumber: 'asc' },
      });

      const recapText = formatLiveRecapMessage(
        { ...event, expiresAt },
        updatedProducts
      );

      let recapMessageId = null;
      try {
        const recapRes = await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: recapText,
          parse_mode: 'Markdown',
        });
        recapMessageId = recapRes?.message_id || null;
      } catch (recapErr) {
        console.error('Gagal kirim pesan rekap pertama:', recapErr.message);
      }

      // Langkah 4: Update status event menjadi ACTIVE
      const finalEvent = await prisma.telegramBroadcastEvent.update({
        where: { id: event.id },
        data: {
          status: 'ACTIVE',
          expiresAt,
          chatId: String(chatId),
          headerMessageId,
          recapMessageId,
          totalItems: event.products.length,
        },
        include: {
          products: {
            orderBy: { dropNumber: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Event "${finalEvent.title}" berhasil disiarkan ke Telegram! ${succeeded} produk sukses, ${failed} gagal.`,
        event: finalEvent,
        succeeded,
        failed,
        results,
      });
    }

    // 4. TUTUP / SELESAIKAN EVENT BROADCAST
    if (action === 'close-event') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID wajib disertakan.' }, { status: 400 });
      }

      const event = await prisma.telegramBroadcastEvent.findUnique({
        where: { id: eventId },
        include: { products: true },
      });

      if (!event) {
        return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
      }

      // Tutup semua produk drop yang belum laku di event ini
      for (const p of event.products) {
        if (!p.isSold && p.isDailyDrop) {
          await prisma.product.update({
            where: { id: p.id },
            data: {
              isDailyDrop: false,
              bookedBy: null,
              bookedTelegramId: null,
              bookedUntil: null,
            },
          });

          if (p.telegramChatId && p.telegramMessageId) {
            try {
              await callTelegramApi('editMessageReplyMarkup', {
                chat_id: p.telegramChatId,
                message_id: p.telegramMessageId,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '⏰ FLASH DEAL SELESAI', callback_data: `info:expired:${p.id}` }],
                  ],
                },
              });
            } catch {
              // ignore
            }
          }
        }
      }

      const updated = await prisma.telegramBroadcastEvent.update({
        where: { id: eventId },
        data: {
          status: 'COMPLETED',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Event "${event.title}" telah ditutup.`,
        event: updated,
      });
    }

    // 5. MANUAL BROADCAST RECAP
    if (action === 'broadcast-recap') {
      const { eventId } = body;
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID wajib disertakan.' }, { status: 400 });
      }

      const res = await broadcastLiveRecap(eventId);
      if (!res) {
        return NextResponse.json({ error: 'Gagal mengirim rekap ke grup Telegram.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Papan Live Recap berhasil disiarkan ke grup Telegram.',
      });
    }

    // 6. LEGACY MULTI-DROP FALLBACK (Untuk kompatibilitas)
    let items = body.items || [];
    const durationHours = Number(body.durationHours) || 24;

    if (!items.length && body.productId) {
      items = [{ productId: body.productId, dropNumber: body.dropNumber }];
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Pilih minimal satu produk atau tentukan aksi yang valid.' },
        { status: 400 }
      );
    }

    const { defaultChatId } = getTelegramConfig();
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

        if (!product || product.isSold || product.quantity <= 0) {
          throw new Error('Produk tidak valid atau sudah terjual.');
        }

        const finalDropNumber = requestedDropNumber || product.dropNumber || `#${String(i + 1).padStart(2, '0')}`;
        const productWithDropInfo = {
          ...product,
          dropNumber: finalDropNumber,
        };

        const { messageId, chatId } = await broadcastDropToTelegram(productWithDropInfo, defaultChatId);

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

        results.push({ productId, ok: true, messageId });
        succeeded++;
      } catch (err) {
        results.push({ productId, ok: false, error: err.message });
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
    return NextResponse.json({ error: error.message || 'Gagal memproses aksi broadcast.' }, { status: 500 });
  }
}

/**
 * DELETE: Hapus Event Broadcast atau Batalkan status drop produk.
 */
export async function DELETE(request) {
  try {
    await requirePermission(request, ['products:manage', 'events:manage']);

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const productId = searchParams.get('productId');

    if (eventId) {
      // Lepaskan semua produk yang terhubung ke event ini
      await prisma.product.updateMany({
        where: { broadcastEventId: eventId },
        data: { broadcastEventId: null },
      });

      await prisma.telegramBroadcastEvent.delete({
        where: { id: eventId },
      });

      return NextResponse.json({
        success: true,
        message: 'Event broadcast berhasil dihapus.',
      });
    }

    if (productId) {
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
    }

    return NextResponse.json({ error: 'Parameter eventId atau productId wajib disertakan.' }, { status: 400 });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error DELETE /api/admin/telegram:', error);
    return NextResponse.json({ error: 'Gagal menghapus data.' }, { status: 500 });
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

      // Update papan rekap
      if (product.broadcastEventId) {
        try {
          await broadcastLiveRecap(product.broadcastEventId, product.telegramChatId);
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        message: `Booking @${prevBuyer} untuk "${product.name}" berhasil dilepas. Status kembali OPEN.`,
        product: updated,
      });
    }

    if (action === 'resync-telegram') {
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
