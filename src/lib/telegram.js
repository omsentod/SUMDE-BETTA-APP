/**
 * Telegram Bot API Client for SUMDE-BETTA-APP
 * Menghubungkan sistem Daily Drop 24 Jam & Flash Sale dengan grup Telegram.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function getTelegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const defaultChatId = process.env.TELEGRAM_CHAT_ID || '';
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

  return { token, defaultChatId, appUrl, secret };
}

/**
 * Mengambil daftar Chat ID target tujuan notifikasi.
 * Mendukung pengiriman ke BANYAK tujuan sekaligus (dipisahkan koma di .env).
 * Contoh: Akun Pribadi Owner, Akun Staff Packing, dan Grup Admin Operasional.
 */
export function getTelegramNotifTargets() {
  const raw =
    process.env.TELEGRAM_NOTIF_TARGETS ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.TELEGRAM_CHAT_ID ||
    '';

  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pemanggilan API mentah ke Telegram Bot API
 */
export async function callTelegramApi(method, body = {}) {
  const { token } = getTelegramConfig();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN belum dikonfigurasi di environment (.env).');
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    console.error(`Telegram API Error [${method}]:`, data);
    throw new Error(data.description || `Gagal memanggil Telegram API: ${method}`);
  }

  return data.result;
}

/**
 * Format Caption Pesan Drop untuk Grup Telegram
 */
export function formatDropCaption(product, status = 'OPEN', buyer = null) {
  const code = product.dropNumber || `#${String(product.id).slice(-4).toUpperCase()}`;
  const price = formatIDR(product.price);
  const form = product.form || '-';
  const age = product.age || '-';
  const spirit = product.statsSpirit || 'Aktif';
  const grade = product.statsForm || 'COMP';
  const safeName = (product.name || '').replace(/_/g, ' ');

  let statusBadge = '🟢 TERSEDIA (OPEN)';
  if (status === 'BOOKED' || (product.bookedUntil && new Date(product.bookedUntil) > new Date())) {
    statusBadge = `🟡 SEDANG DI-BOOKING @${buyer || product.bookedBy || 'User'} (Batas 15 Menit)`;
  } else if (status === 'SOLD' || product.isSold) {
    statusBadge = `🔴 SUDAH TERJUAL (SOLD OUT) ke @${buyer || product.bookedBy || 'Pembeli'}`;
  }

  return (
    `🐟 *SUMDE BETTA • FLASH DROP*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 *Kode:* \`${code}\`\n` +
    `🏷️ *Nama:* ${safeName}\n` +
    `💰 *Harga:* *${price}*\n\n` +
    `📐 *Spesifikasi:*\n` +
    `• Form: ${form}\n` +
    `• Grade: ${grade}\n` +
    `• Usia: ${age}\n` +
    `• Mental: ${spirit}\n\n` +
    `📍 *Status:* ${statusBadge}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Tekan tombol di bawah untuk mengamankan ikan ini._`
  );
}

export function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim().toLowerCase();
  return s.includes('youtube.com/') || s.includes('youtu.be/');
}

export function getYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

export function normalizeYouTubeUrl(url) {
  const id = getYouTubeVideoId(url);
  if (id) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return url;
}

export function isDirectVideoFile(url) {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url);
}

/**
 * Membuat Tombol Interaktif (Inline Keyboard) Telegram
 */
export function buildDropInlineKeyboard(product, status = 'OPEN') {
  const { appUrl } = getTelegramConfig();
  const isExpired = product.bookedUntil && new Date(product.bookedUntil) <= new Date();
  const isBooked = (status === 'BOOKED' || product.bookedUntil) && !isExpired && !product.isSold;
  const isSold = status === 'SOLD' || product.isSold;

  const baseUrl = (appUrl && !appUrl.startsWith('http://localhost'))
    ? appUrl
    : 'https://sumdebetta.com';

  const webUrl = `${baseUrl}/produk/${product.id}`;

  const hasYtVideo = isYouTubeUrl(product.videoUrl);
  const ytCanonical = hasYtVideo ? normalizeYouTubeUrl(product.videoUrl) : null;

  if (isSold) {
    const catalogUrl = `${baseUrl}/produk`;
    return {
      inline_keyboard: [
        [{ text: `🔴 SUDAH TERJUAL (SOLD OUT) ke @${product.bookedBy || 'Pembeli'}`, callback_data: `info:sold:${product.id}` }],
        [{ text: '🌐 Lihat Koleksi Ikan Lainnya', url: catalogUrl }],
      ],
    };
  }

  if (isBooked) {
    const secondaryRow = [];
    if (hasYtVideo) {
      secondaryRow.push({ text: '▶️ Buka di YouTube', url: ytCanonical || product.videoUrl });
    }
    secondaryRow.push({ text: '🌐 Lihat di Website', url: webUrl });

    return {
      inline_keyboard: [
        [
          {
            text: `⏳ Sedang Di-Book @${product.bookedBy || 'User'} (Batas 15 Menit)`,
            callback_data: `info:booked:${product.id}`,
          },
        ],
        secondaryRow,
      ],
    };
  }

  // Status OPEN (Bisa diambil langsung via Checkout Web App / URL)
  const checkoutUrl = `${baseUrl}/checkout?buyNow=${product.id}&dropNumber=${encodeURIComponent(product.dropNumber || '')}&eventId=${product.broadcastEventId || ''}`;
  const isHttps = checkoutUrl.startsWith('https://');

  const dealButton = isHttps
    ? {
        text: `⚡ DEAL SEKARANG (${product.dropNumber || '#DROP'})`,
        web_app: { url: checkoutUrl },
      }
    : {
        text: `⚡ DEAL SEKARANG (${product.dropNumber || '#DROP'})`,
        url: checkoutUrl,
      };

  const secondaryRow = [];
  if (hasYtVideo) {
    secondaryRow.push({ text: '▶️ Buka di YouTube', url: ytCanonical || product.videoUrl });
  }
  secondaryRow.push({ text: '🌐 Lihat Foto di Web', url: webUrl });

  return {
    inline_keyboard: [
      [dealButton],
      secondaryRow,
    ],
  };
}

/**
 * Broadcast Produk Drop Baru ke Grup Telegram
 */
export async function broadcastDropToTelegram(product, targetChatId = null) {
  const { defaultChatId, appUrl } = getTelegramConfig();
  const chatId = targetChatId || defaultChatId;
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID belum ditentukan di .env.');
  }

  const caption = formatDropCaption(product, 'OPEN');
  const reply_markup = buildDropInlineKeyboard(product, 'OPEN');

  let result = null;

  // 1. Jika videoUrl adalah link YouTube (termasuk YouTube Shorts)
  // Telegram Bot API tidak bisa mengunduh stream YouTube via sendVideo,
  // tetapi mendukung Rich Video Player via sendMessage + link_preview_options
  if (isYouTubeUrl(product.videoUrl)) {
    const ytCanonical = normalizeYouTubeUrl(product.videoUrl);
    const textWithVideo = `${caption}\n\n🎥 *Video Preview:* ${ytCanonical}`;
    try {
      result = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: textWithVideo,
        parse_mode: 'Markdown',
        link_preview_options: {
          url: ytCanonical,
          prefer_large_media: true,
          show_above_text: true,
        },
        reply_markup,
      });
      return { messageId: result.message_id, chatId: String(chatId) };
    } catch (err) {
      console.warn('Gagal kirim via YouTube preview Markdown, mencoba plain text:', err.message);
      try {
        result = await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: textWithVideo.replace(/[*_`]/g, ''),
          link_preview_options: {
            url: ytCanonical,
            prefer_large_media: true,
            show_above_text: true,
          },
          reply_markup,
        });
        return { messageId: result.message_id, chatId: String(chatId) };
      } catch (retryErr) {
        console.warn('Gagal kirim via YouTube preview, mencoba fallback video/foto:', retryErr.message);
      }
    }
  }

  // 2. Jika ada videoUrl langsung (file MP4 lokal atau URL publik direct)
  if (product.videoUrl && isDirectVideoFile(product.videoUrl)) {
    let videoSource = product.videoUrl;
    if (videoSource.startsWith('/')) {
      videoSource = `${appUrl}${videoSource}`;
    }

    try {
      result = await callTelegramApi('sendVideo', {
        chat_id: chatId,
        video: videoSource,
        caption,
        parse_mode: 'Markdown',
        reply_markup,
      });
      return { messageId: result.message_id, chatId: String(chatId) };
    } catch (err) {
      console.warn('Gagal kirim via sendVideo, mencoba fallback foto:', err.message);
    }
  }

  // 3. Fallback foto utama produk
  if (product.image) {
    let photoSource = product.image;
    if (photoSource.startsWith('/')) {
      photoSource = `${appUrl}${photoSource}`;
    }

    let photoCaption = caption;
    if (product.videoUrl) {
      photoCaption = `${caption}\n\n🎥 *Video Ikan:* ${product.videoUrl}`;
    }

    result = await callTelegramApi('sendPhoto', {
      chat_id: chatId,
      photo: photoSource,
      caption: photoCaption,
      parse_mode: 'Markdown',
      reply_markup,
    });
    return { messageId: result.message_id, chatId: String(chatId) };
  }

  // 4. Fallback pesan teks biasa
  result = await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: caption,
    parse_mode: 'Markdown',
    reply_markup,
  });

  return { messageId: result.message_id, chatId: String(chatId) };
}

/**
 * Update Tombol & Caption Pesan Telegram Saat Status Berubah (misal: BOOKED atau SOLD)
 */
export async function updateTelegramDropMessage(product, newStatus, buyerName = null) {
  if (!product.telegramMessageId || !product.telegramChatId) {
    return false;
  }

  const caption = formatDropCaption(product, newStatus, buyerName);
  const reply_markup = buildDropInlineKeyboard(product, newStatus);
  const isYt = isYouTubeUrl(product.videoUrl);
  const ytCanonical = isYt ? normalizeYouTubeUrl(product.videoUrl) : null;
  const textContent = isYt ? `${caption}\n\n🎥 *Video Preview:* ${ytCanonical}` : caption;

  try {
    // Edit caption jika pesan awal adalah video/foto (sendVideo / sendPhoto)
    await callTelegramApi('editMessageCaption', {
      chat_id: product.telegramChatId,
      message_id: product.telegramMessageId,
      caption: isYt ? caption : (product.videoUrl ? `${caption}\n\n🎥 *Video Ikan:* ${product.videoUrl}` : caption),
      parse_mode: 'Markdown',
      reply_markup,
    });
    return true;
  } catch {
    // Jika pesan awal adalah teks (sendMessage dengan YouTube preview atau pesan biasa)
    try {
      const editBody = {
        chat_id: product.telegramChatId,
        message_id: product.telegramMessageId,
        text: textContent,
        parse_mode: 'Markdown',
        reply_markup,
      };

      if (isYt) {
        editBody.link_preview_options = {
          url: ytCanonical,
          prefer_large_media: true,
          show_above_text: true,
        };
      }

      await callTelegramApi('editMessageText', editBody);
      return true;
    } catch (fallbackErr) {
      console.warn('Gagal update pesan Telegram drop:', fallbackErr.message);
      return false;
    }
  }
}

/**
 * Respon Pop-up Toast di Telegram saat tombol Inline diklik
 */
export async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  try {
    return await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  } catch (err) {
    console.error('Error answerCallbackQuery:', err.message);
    return null;
  }
}

/**
 * Format Tanggal Indonesia (contoh: 29 OKTOBER 2026)
 */
export function formatIndoDate(date = new Date()) {
  try {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).toUpperCase();
  } catch {
    return '';
  }
}

/**
 * Format Pesan Banner Pengumuman Pembuka Event Broadcast
 */
export function formatEventHeaderMessage(event, itemsCount = 0, firstCode = '', lastCode = '') {
  const dateStr = formatIndoDate(event?.date || new Date());
  const rangeStr = firstCode && lastCode && firstCode !== lastCode
    ? ` (${firstCode} s/d ${lastCode})`
    : (firstCode ? ` (${firstCode})` : '');
  const durationStr = event?.isLifetime
    ? '♾️ Sesi Lifetime (Tanpa Batas Waktu)'
    : `${event?.durationHours || 24} Jam`;

  return (
    `✨ *UPDATE FLASH DEAL HARI INI* ✨\n` +
    `          — ${dateStr} —\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 *Sesi:* ${event?.title || 'FLASH DEAL SPESIAL'}\n` +
    `⏳ *Batas Waktu:* ${durationStr}\n` +
    `📦 *Total Koleksi:* ${itemsCount} Ekor Pilihan${rangeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ _Siapa cepat dia dapat! Tekan tombol DEAL pada postingan ikan yang kamu inginkan._\n` +
    `_Selamat berburu ikan impianmu! 🐟🔥_`
  );
}

/**
 * Format Pesan Papan Live Recap Flash Deal
 */
export function formatLiveRecapMessage(event, products = []) {
  const now = new Date();
  const dateStr = formatIndoDate(event?.date || now);
  const eventTitle = (event?.title || 'FLASH DEAL').toUpperCase();

  const total = products.length;
  let soldCount = 0;
  let bookedCount = 0;
  let openCount = 0;

  const lines = products.map((p, idx) => {
    const code = p.dropNumber || `#${String(idx + 1).padStart(2, '0')}`;
    const isBooked = p.bookedUntil && new Date(p.bookedUntil) > now && !p.isSold;
    const isSold = p.isSold;

    if (isSold) {
      soldCount++;
      const buyer = p.bookedBy ? `@${p.bookedBy.replace(/^@/, '')}` : 'Pembeli';
      return `${code} : 🔴 SOLD OUT to ${buyer} (LUNAS)`;
    }
    if (isBooked) {
      bookedCount++;
      const buyer = p.bookedBy ? `@${p.bookedBy.replace(/^@/, '')}` : 'User';
      const diffSec = Math.max(0, Math.floor((new Date(p.bookedUntil) - now) / 1000));
      const mins = Math.max(1, Math.ceil(diffSec / 60));
      return `${code} : 🔒 BOOKED ${buyer} (Sisa ${mins}m)`;
    }

    openCount++;
    return `${code} : 🟢 OPEN (Siap Diambil)`;
  });

  let timeStatus = '♾️ Lifetime';
  if (!event?.isLifetime && event?.expiresAt) {
    try {
      const timeStr = new Date(event.expiresAt).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
      timeStatus = `Berakhir ${timeStr} WIB`;
    } catch {
      timeStatus = 'Aktif';
    }
  }

  return (
    `🏆 *LIVE RECAP DEAL • SUMDE BETTA*\n` +
    `⚡ *${eventTitle} — ${dateStr}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (lines.length > 0 ? lines.join('\n') : '_Belum ada produk yang terdaftar dalam sesi ini._') +
    `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Progres:* ${total} Ikan • 🔴 ${soldCount} Sold • 🔒 ${bookedCount} Booked • 🟢 ${openCount} Open\n` +
    `⏰ *Status Sesi:* ${timeStatus}`
  );
}

/**
 * Kirim atau Perbarui Papan Live Recap ke Grup Telegram
 */
export async function broadcastLiveRecap(eventId, targetChatId = null) {
  if (!eventId) return null;

  try {
    const { default: prisma } = await import('./prisma.js');
    const event = await prisma.telegramBroadcastEvent.findUnique({
      where: { id: eventId },
      include: {
        products: {
          orderBy: { dropNumber: 'asc' },
        },
      },
    });

    if (!event) return null;

    const { defaultChatId } = getTelegramConfig();
    const chatId = targetChatId || event.chatId || defaultChatId;
    if (!chatId) return null;

    const recapText = formatLiveRecapMessage(event, event.products);

    // Kirim pesan baru ke grup Telegram agar langsung terlihat di chat terbawah
    const res = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: recapText,
      parse_mode: 'Markdown',
    });

    if (res?.message_id) {
      await prisma.telegramBroadcastEvent.update({
        where: { id: event.id },
        data: {
          recapMessageId: res.message_id,
          chatId: String(chatId),
        },
      });
    }

    return res;
  } catch (err) {
    console.error('Gagal broadcastLiveRecap:', err.message);
    return null;
  }
}

/**
 * Notifikasi Rekap Jam Packing Toko via Bot Telegram (Kloter Jam 10.00 & 15.00 WIB)
 * Mampu mengirim ke BANYAK tujuan sekaligus (Akun Pribadi, Staff Packing, Grup Admin).
 * Format anti-AI-slop (hanya 2 baris ringkas):
 * 📦 5 pesanan lunas siap dipacking.
 * Buka dashboard: https://sumdebetta.com/admin/orders?status=PAID
 */
export async function sendAdminPackingDigestTelegram(kloterLabel = '', customTargets = null, options = {}) {
  try {
    const { default: prisma } = await import('./prisma.js');
    const paidCount = await prisma.order.count({
      where: {
        status: 'PAID',
      },
    });

    if (paidCount === 0 && !options.force) {
      return {
        sent: false,
        count: 0,
        channel: 'telegram',
        reason: 'Tidak ada pesanan lunas yang menunggu dipacking (senyap total). Gunakan ?force=1 untuk tes kirim saat 0 pesanan.',
      };
    }

    const { token, appUrl } = getTelegramConfig();
    const targets = customTargets && customTargets.length > 0 ? customTargets : getTelegramNotifTargets();

    if (!token || targets.length === 0) {
      return {
        sent: false,
        channel: 'telegram',
        error: 'TELEGRAM_BOT_TOKEN atau target Chat ID belum dikonfigurasi di .env.',
      };
    }

    const displayCount = paidCount > 0 ? paidCount : (options.mockCount || 1);
    const message = `📦 ${displayCount} pesanan lunas siap dipacking.\nBuka dashboard: ${appUrl}/admin/orders?status=PAID`;

    const deliveries = [];
    for (const chatId of targets) {
      try {
        const res = await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: message,
          disable_web_page_preview: false,
        });
        deliveries.push({ chatId, ok: true, messageId: res?.message_id });
      } catch (err) {
        console.error(`Gagal kirim notif packing ke Chat ID ${chatId}:`, err.message);
        deliveries.push({ chatId, ok: false, error: err.message });
      }
    }

    const successCount = deliveries.filter((d) => d.ok).length;

    return {
      sent: successCount > 0,
      count: paidCount,
      channel: 'telegram',
      message,
      deliveries,
      successCount,
      totalTargets: targets.length,
    };
  } catch (err) {
    console.error('Error sendAdminPackingDigestTelegram:', err.message);
    return { sent: false, channel: 'telegram', error: err.message };
  }
}
