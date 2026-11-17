/**
 * Utility Kompresi Gambar di Sisi Browser (Client-Side)
 * 
 * Mengubah foto kamera beresolusi raksasa (3-5MB, 4000x3000px) menjadi format WebP
 * berukuran ringkas (70-130KB, maks 1200px) dengan ketajaman visual tetap jernih
 * (perceptually lossless) sebelum di-upload ke server Hostinger.
 */

/**
 * Kompresi satu file gambar.
 * @param {File} file - File asli dari input form
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1200] - Lebar maksimal piksel
 * @param {number} [options.maxHeight=1200] - Tinggi maksimal piksel
 * @param {number} [options.quality=0.82] - Kualitas WebP (0.80 - 0.85 adalah sweet spot tajam & ringan)
 * @returns {Promise<File>} File terkompresi atau file asli jika tidak didukung
 */
export async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = {}) {
  if (typeof window === 'undefined') return file;

  // Jika bukan gambar biasa atau merupakan SVG/GIF animasi, biarkan asli
  if (
    !file ||
    !file.type ||
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return file;
  }

  // Jika ukuran file sudah sangat kecil (< 80KB), tidak perlu dikompres lagi
  if (file.size <= 80 * 1024) {
    return file;
  }

  try {
    let source;
    let imgWidth = 0;
    let imgHeight = 0;

    // Coba gunakan createImageBitmap (modern, cepat, hemat memori)
    if (typeof window.createImageBitmap === 'function') {
      try {
        const bitmap = await window.createImageBitmap(file);
        source = bitmap;
        imgWidth = bitmap.width;
        imgHeight = bitmap.height;
      } catch {
        // Fallback ke Image element biasa jika format tidak kompatibel dengan createImageBitmap
      }
    }

    if (!source) {
      source = await new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Gagal memuat gambar untuk kompresi'));
        };
        img.src = objectUrl;
      });
      imgWidth = source.naturalWidth || source.width;
      imgHeight = source.naturalHeight || source.height;
    }

    if (!imgWidth || !imgHeight) {
      if (source && typeof source.close === 'function') source.close();
      return file;
    }

    // Hitung dimensi skala proporsional
    let targetWidth = imgWidth;
    let targetHeight = imgHeight;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    // Gambar ke canvas dengan interpolasi kualitas tinggi
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      if (source && typeof source.close === 'function') source.close();
      return file;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    if (source && typeof source.close === 'function') {
      source.close();
    }

    // Export ke format WebP
    let blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality);
    });

    // Fallback ke JPEG jika browser lama tidak mendukung ekspor toBlob WebP
    if (!blob) {
      blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });
    }

    if (!blob) return file;

    // Jika hasil kompresi ternyata lebih besar dari file asli, gunakan file asli
    if (blob.size >= file.size) {
      return file;
    }

    const mime = blob.type || 'image/webp';
    const ext = mime === 'image/webp' ? '.webp' : '.jpg';
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const newName = `${cleanBaseName || 'photo'}${ext}`;

    return new File([blob], newName, {
      type: mime,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('Kompresi gambar client-side dilewati:', err);
    return file;
  }
}

/**
 * Kompresi serentak array file gambar.
 * @param {File[]} files
 * @param {Object} [options]
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, options) {
  if (!Array.isArray(files) || files.length === 0) return [];
  return Promise.all(files.map((f) => compressImage(f, options)));
}
