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

  let statusBadge = '🟢 TERSEDIA (OPEN)';
  if (status === 'BOOKED' || (product.bookedUntil && new Date(product.bookedUntil) > new Date())) {
    statusBadge = `🟡 SEDANG DI-BOOKING @${buyer || product.bookedBy || 'User'} (Batas 15 Menit)`;
  } else if (status === 'SOLD' || product.isSold) {
    statusBadge = `🔴 SUDAH TERJUAL (SOLD OUT) ke @${buyer || product.bookedBy || 'Pembeli'}`;
  }

  return (
    `🐟 *SUMDE BETTA • FLASH DROP 24 JAM*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 *Kode:* \`${code}\`\n` +
    `🏷️ *Nama:* ${product.name}\n` +
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
  if (!url) return false;
  return /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i.test(url);
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

  const webUrl = (appUrl && !appUrl.startsWith('http://localhost'))
    ? `${appUrl}/produk/${product.id}`
    : `https://sumdebetta.com/produk/${product.id}`;

  const hasYtVideo = isYouTubeUrl(product.videoUrl);

  if (isSold) {
    const catalogUrl = (appUrl && !appUrl.startsWith('http://localhost'))
      ? `${appUrl}/produk`
      : 'https://sumdebetta.com/produk';
    return {
      inline_keyboard: [
        [{ text: '❌ SUDAH TERJUAL (SOLD OUT)', callback_data: `info:sold:${product.id}` }],
        [{ text: '🌐 Lihat Koleksi Ikan Lainnya', url: catalogUrl }],
      ],
    };
  }

  if (isBooked) {
    const secondaryRow = [];
    if (hasYtVideo) {
      secondaryRow.push({ text: '▶️ Buka di YouTube', url: product.videoUrl });
    }
    secondaryRow.push({ text: '🌐 Lihat di Website', url: webUrl });

    return {
      inline_keyboard: [
        [
          {
            text: `⏳ Di-booking @${product.bookedBy || 'User'} (Sisa Waktu Bayar)`,
            callback_data: `info:booked:${product.id}`,
          },
        ],
        secondaryRow,
      ],
    };
  }

  // Status OPEN (Bisa diambil)
  const secondaryRow = [];
  if (hasYtVideo) {
    secondaryRow.push({ text: '▶️ Buka di YouTube', url: product.videoUrl });
  }
  secondaryRow.push({ text: '🌐 Lihat Foto di Web', url: webUrl });

  return {
    inline_keyboard: [
      [
        {
          text: `⚡ AMBIL / TAKE IKAN INI (${product.dropNumber || '#DROP'})`,
          callback_data: `take:${product.id}`,
        },
      ],
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
    const textWithVideo = `${caption}\n\n🎥 *Video Preview:* ${product.videoUrl}`;
    try {
      result = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: textWithVideo,
        parse_mode: 'Markdown',
        link_preview_options: {
          url: product.videoUrl,
          prefer_large_media: true,
          show_above_text: true,
        },
        reply_markup,
      });
      return { messageId: result.message_id, chatId: String(chatId) };
    } catch (err) {
      console.warn('Gagal kirim via YouTube preview, mencoba fallback video/foto:', err.message);
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
  const textContent = isYt ? `${caption}\n\n🎥 *Video Preview:* ${product.videoUrl}` : caption;

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
  } catch (err) {
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
          url: product.videoUrl,
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
