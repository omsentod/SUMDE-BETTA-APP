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

export async function POST(request) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah.' }, { status: 400 });
    }

    // 1. Validasi tipe file (allowlist)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Format file tidak didukung. Hanya JPEG, PNG, GIF, dan WEBP yang diperbolehkan.' }, { status: 400 });
    }

    // 2. Batasan ukuran file (5MB — cukup untuk foto produk berkualitas, dan
    //    tidak membebani hosting / bandwidth pengunjung).
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'Ukuran file terlalu besar. Maksimal 5MB.' }, { status: 400 });
    }

    // Membaca file bytes ke Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Verifikasi isi file (magic bytes), bukan cuma MIME/ekstensi yang
    //    di-supply klien. Menolak file yang bytes-nya bukan image asli.
    const detectedKind = detectImageKind(buffer);
    if (!detectedKind) {
      return NextResponse.json({ error: 'Isi file bukan gambar yang valid.' }, { status: 400 });
    }

    // 4. Ubah nama file menjadi string acak unik untuk mencegah path traversal.
    //    Ekstensi diambil dari hasil deteksi, bukan dari nama file klien.
    const extByKind = { png: '.png', jpg: '.jpg', gif: '.gif', webp: '.webp' };
    const fileExt = extByKind[detectedKind];
    const randomName = crypto.randomBytes(16).toString('hex');
    const safeFilename = `${randomName}${fileExt}`;

    // Menentukan lokasi penyimpanan di public/uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Pastikan folder penyimpanan tersedia
    await fs.mkdir(uploadDir, { recursive: true });

    // Menyimpan file
    const filePath = path.join(uploadDir, safeFilename);
    await fs.writeFile(filePath, buffer);

    // Mengembalikan URL relatif gambar
    return NextResponse.json({ url: `/uploads/${safeFilename}` });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengunggah file.' }, { status: 500 });
  }
}
