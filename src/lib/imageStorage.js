import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export const EXT_BY_KIND = {
  png: '.png',
  jpg: '.jpg',
  gif: '.gif',
  webp: '.webp',
};

/**
 * Sniff the actual image kind from magic bytes.
 */
export function detectImageKind(buf) {
  if (!buf || buf.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }

  // GIF: GIF87a or GIF89a
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    return 'gif';
  }

  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Return resolved uploads directory.
 */
export function getUploadDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
}

/**
 * Save an image buffer securely to storage.
 * @param {Buffer} buffer - image buffer
 * @param {string} [uploadDir] - target directory (optional)
 * @returns {Promise<string>} public relative URL e.g. /uploads/<hash>.<ext>
 */
export async function saveImageBuffer(buffer, uploadDir = getUploadDir()) {
  const detectedKind = detectImageKind(buffer);
  if (!detectedKind) {
    const err = new Error('Isi file bukan gambar yang valid (JPEG, PNG, WebP, GIF).');
    err.status = 400;
    throw err;
  }

  await fs.mkdir(uploadDir, { recursive: true });

  const safeFilename = `${crypto.randomBytes(16).toString('hex')}${EXT_BY_KIND[detectedKind]}`;
  const targetPath = path.join(uploadDir, safeFilename);

  await fs.writeFile(targetPath, buffer);
  return `/uploads/${safeFilename}`;
}
