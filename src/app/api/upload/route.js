import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/auth';

// Sniff the actual image kind from the first bytes of the file. The
// client-supplied MIME (file.type) and filename extension are both
// spoofable — this looks at what the file really is.
function detectImageKind(buf) {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) {
    return 'png';
  }
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'jpg';
  }
  if (buf.length >= 6 &&
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) {
    return 'gif';
  }
  // WebP: RIFF....WEBP
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return 'webp';
  }
  return null;
}

// Batas jumlah file per request — cukup untuk galeri produk, sekaligus
// membatasi penyalahgunaan (disk / bandwidth) walau endpoint sudah admin-only.
const MAX_FILES_PER_REQUEST = 12;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const EXT_BY_KIND = { png: '.png', jpg: '.jpg', gif: '.gif', webp: '.webp' };

// Validasi + simpan satu file. Lempar Error ber-`.status` kalau invalid.
async function saveOneFile(file, uploadDir) {
  // 1. Validasi tipe file (allowlist berdasarkan MIME yang di-supply klien).
  if (!ALLOWED_TYPES.includes(file.type)) {
    const err = new Error('Format file tidak didukung. Hanya JPEG, PNG, GIF, dan WEBP yang diperbolehkan.');
    err.status = 400; throw err;
  }
  // 2. Batasan ukuran file (5MB).
  if (file.size > MAX_SIZE_BYTES) {
    const err = new Error('Ukuran file terlalu besar. Maksimal 5MB per foto.');
    err.status = 400; throw err;
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // 3. Verifikasi isi file (magic bytes), bukan cuma MIME/ekstensi klien.
  const detectedKind = detectImageKind(buffer);
  if (!detectedKind) {
    const err = new Error('Isi file bukan gambar yang valid.');
    err.status = 400; throw err;
  }

  // 4. Nama file acak unik — cegah path traversal; ekstensi dari hasil deteksi.
  const safeFilename = `${crypto.randomBytes(16).toString('hex')}${EXT_BY_KIND[detectedKind]}`;
  await fs.writeFile(path.join(uploadDir, safeFilename), buffer);
  return `/uploads/${safeFilename}`;
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();

    // Terima satu ATAU banyak file dari field "file". getAll menangkap semua
    // entri berjudul "file" (form multi-select) — kompatibel dengan pemanggil
    // lama yang mengirim satu file.
    const files = formData.getAll('file').filter((f) => f && typeof f.arrayBuffer === 'function');

    if (files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_FILES_PER_REQUEST} foto per unggahan.` },
        { status: 400 }
      );
    }

    // Hostinger clone ulang git ke direktori versi BARU setiap deploy —
    // apa pun yang ditulis ke public/uploads relatif terhadap process.cwd()
    // cuma hidup di direktori versi itu dan hilang begitu deploy berikutnya
    // mengalihkan traffic ke direktori baru. UPLOADS_DIR (absolute path ke
    // public_html/uploads, di luar hbuilds/versions) dipakai di production
    // supaya file selamat lintas deploy — public_html sudah dikonfirmasi
    // di-serve langsung oleh webserver, bukan lewat Next.js. Kalau env var
    // ini tidak di-set (dev lokal), fallback ke public/uploads seperti biasa.
    const uploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    // Simpan berurutan supaya `urls` menjaga urutan sesuai file yang dipilih.
    const urls = [];
    for (const file of files) {
      urls.push(await saveOneFile(file, uploadDir));
    }

    // `url` (tunggal) dipertahankan untuk pemanggil lama; `urls` untuk galeri.
    return NextResponse.json({ url: urls[0], urls });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengunggah file.' }, { status: 500 });
  }
}
