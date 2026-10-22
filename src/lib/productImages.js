/**
 * Normalisasi daftar media & gambar produk (galeri multi-foto dan video).
 *
 * Dipakai server-side oleh POST/PUT /api/products dan client-side oleh
 * halaman admin serta detail produk (/produk/[id]).
 */

export function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

export function isSafeVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/videos/')) {
    return /\.(mp4|webm|mov)$/i.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isYt = host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
    const isVimeo = host === 'vimeo.com' || host === 'player.vimeo.com';
    const isHttps = parsed.protocol === 'https:';
    return isHttps && (isYt || isVimeo || /\.(mp4|webm|mov)$/i.test(parsed.pathname));
  } catch {
    return false;
  }
}

/**
 * Normalisasi galeri media (foto + video) agar urutan yang di-set admin
 * tersimpan rapi dan aman di database (Product.images Json).
 */
export function normalizeImages(images, fallback, videoUrl = null) {
  let arr = [];
  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === 'string') {
        const s = item.trim();
        if (s.startsWith('/')) {
          arr.push({ type: 'image', url: s });
        } else if (isSafeVideoUrl(s)) {
          arr.push({ type: 'video', url: s });
        }
      } else if (item && typeof item === 'object') {
        const u = typeof item.url === 'string' ? item.url.trim() : '';
        if (item.type === 'video' && isSafeVideoUrl(u)) {
          arr.push({ type: 'video', url: u });
        } else if (u.startsWith('/')) {
          arr.push({ type: 'image', url: u });
        }
      }
    }
  }

  // Jika ada videoUrl tapi belum masuk ke array urutan media, sisipkan ke daftar
  if (videoUrl && isSafeVideoUrl(videoUrl)) {
    const trimmedVid = videoUrl.trim();
    const hasVid = arr.some((m) => m.type === 'video' && m.url === trimmedVid);
    if (!hasVid) {
      arr.push({ type: 'video', url: trimmedVid });
    }
  }

  // Fallback ke cover gambar lama jika belum ada gambar apapun
  const hasImage = arr.some((m) => m.type === 'image');
  if (!hasImage && typeof fallback === 'string' && fallback.trim().startsWith('/')) {
    arr.unshift({ type: 'image', url: fallback.trim() });
  }

  // Buang item duplikat berurutan dengan URL identik
  const seen = new Set();
  const deduped = [];
  for (const item of arr) {
    const key = `${item.type}:${item.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped;
}

/**
 * Mencari URL foto cover utama pertama dari daftar media (Product.image).
 * Wajib berupa URL gambar internal yang valid, bukan video.
 */
export function findCoverImage(mediaList, fallback = '/img/betta-1.png') {
  if (Array.isArray(mediaList)) {
    for (const item of mediaList) {
      if (typeof item === 'string' && item.startsWith('/')) {
        return item;
      }
      if (item && item.type === 'image' && typeof item.url === 'string' && item.url.startsWith('/')) {
        return item.url;
      }
    }
  }
  if (typeof fallback === 'string' && fallback.startsWith('/')) {
    return fallback;
  }
  return '/img/betta-1.png';
}
