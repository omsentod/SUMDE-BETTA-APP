import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST(request) {
  try {
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

    // 2. Batasan ukuran file (maksimal 20MB sesuai request user)
    const maxSizeBytes = 20 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json({ error: 'Ukuran file terlalu besar. Maksimal 20MB.' }, { status: 400 });
    }

    // 3. Ekstraksi dan verifikasi ekstensi file secara aman
    const fileExt = path.extname(file.name).toLowerCase() || '.png';
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ error: 'Ekstensi file tidak valid.' }, { status: 400 });
    }

    // 4. Ubah nama file menjadi string acak unik untuk mencegah path traversal dan tabrakan nama file
    const randomName = crypto.randomBytes(16).toString('hex');
    const safeFilename = `${randomName}${fileExt}`;

    // Membaca file bytes ke Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengunggah file.' }, { status: 500 });
  }
}
