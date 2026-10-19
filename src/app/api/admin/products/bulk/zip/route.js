import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { saveImageBuffer, detectImageKind } from '@/lib/imageStorage';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Ekstraksi angka urutan dari nama file (misal "1.jpg" -> 1, "02.png" -> 2, "ikan_10.jpg" -> 10)
function extractFileNumber(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

export async function POST(request) {
  try {
    await requirePermission(request, 'products:manage');

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'File ZIP tidak ditemukan dalam unggahan.' }, { status: 400 });
    }

    const filename = file.name || 'photos.zip';
    if (!filename.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah file .zip.' }, { status: 400 });
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    if (zipBuffer.length > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file ZIP melebihi batas maksimal 200MB.' }, { status: 400 });
    }

    // Verifikasi magic bytes ZIP (PK\x03\x04 atau PK\x05\x06)
    if (
      zipBuffer.length < 4 ||
      zipBuffer[0] !== 0x50 ||
      zipBuffer[1] !== 0x4b
    ) {
      return NextResponse.json({ error: 'File bukan arsip ZIP yang valid.' }, { status: 400 });
    }

    let zip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      return NextResponse.json({ error: 'Gagal mengekstrak arsip ZIP. Pastikan file tidak terenkripsi atau rusak.' }, { status: 400 });
    }

    // Ambil seluruh produk dari database untuk pencocokan nama folder
    const allProducts = await prisma.product.findMany();
    const productMap = new Map();
    for (const p of allProducts) {
      productMap.set(p.name.trim().toLowerCase(), p);
    }

    // Kelompokkan file gambar berdasarkan folder produk
    // Map: productNameLower -> [{ entry, filename, number }]
    const foldersMap = new Map();
    const unmatchedFolders = new Set();
    const parseErrors = [];

    const entries = Object.values(zip.files);

    for (const entry of entries) {
      // Abaikan folder dan file sistem / metadata macOS
      if (entry.dir) continue;
      const normalizedPath = entry.name.replace(/\\/g, '/');
      if (
        normalizedPath.startsWith('__MACOSX/') ||
        normalizedPath.includes('/.DS_Store') ||
        normalizedPath.endsWith('.DS_Store') ||
        normalizedPath.includes('Thumbs.db')
      ) {
        continue;
      }

      // Validasi ekstensi gambar
      const ext = ('.' + normalizedPath.split('.').pop()).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        continue;
      }

      const parts = normalizedPath.split('/').filter(Boolean);
      if (parts.length < 2) {
        // File berada di root ZIP tanpa folder produk
        parseErrors.push(`File "${entry.name}" tidak berada di dalam folder nama produk.`);
        continue;
      }

      const fileName = parts[parts.length - 1];
      // Cari segmen path yang cocok dengan nama produk di database
      // Prioritaskan folder langsung di atas file (parts[parts.length - 2])
      let matchedProduct = null;
      let matchedFolderName = '';

      for (let i = parts.length - 2; i >= 0; i--) {
        const candidateName = parts[i].trim();
        const candidateLower = candidateName.toLowerCase();
        if (productMap.has(candidateLower)) {
          matchedProduct = productMap.get(candidateLower);
          matchedFolderName = candidateName;
          break;
        }
      }

      if (!matchedProduct) {
        // Catat folder yang tidak cocok
        const folderCandidate = parts[parts.length - 2];
        unmatchedFolders.add(folderCandidate);
        continue;
      }

      const key = matchedProduct.id;
      if (!foldersMap.has(key)) {
        foldersMap.set(key, {
          product: matchedProduct,
          folderName: matchedFolderName,
          files: [],
        });
      }

      foldersMap.get(key).files.push({
        entry,
        fileName,
        number: extractFileNumber(fileName),
      });
    }

    const results = [];
    let totalImagesSaved = 0;

    // Proses setiap produk yang cocok
    for (const [, { product, folderName, files }] of foldersMap.entries()) {
      // Urutkan file berdasarkan angka penamaan (1, 2, 3, dst)
      files.sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
      });

      const savedUrls = [];
      const fileErrors = [];

      for (const item of files) {
        try {
          const imgBuffer = await item.entry.async('nodebuffer');

          // Validasi ukuran tiap gambar (maks 10MB)
          if (imgBuffer.length > 10 * 1024 * 1024) {
            fileErrors.push(`File ${item.fileName} melebihi 10MB`);
            continue;
          }

          // Verifikasi magic bytes gambar asli
          const kind = detectImageKind(imgBuffer);
          if (!kind) {
            fileErrors.push(`File ${item.fileName} bukan format gambar yang valid`);
            continue;
          }

          const savedUrl = await saveImageBuffer(imgBuffer);
          savedUrls.push(savedUrl);
          totalImagesSaved++;
        } catch (imgErr) {
          fileErrors.push(`Gagal menyimpan ${item.fileName}: ${imgErr.message}`);
        }
      }

      if (savedUrls.length > 0) {
        // Gambar nomor 1 menjadi cover utama (image), dan seluruh gambar disimpan di images
        await prisma.product.update({
          where: { id: product.id },
          data: {
            image: savedUrls[0],
            images: savedUrls,
          },
        });

        results.push({
          productId: product.id,
          productName: product.name,
          folderName,
          imageCount: savedUrls.length,
          coverImage: savedUrls[0],
          images: savedUrls,
          warnings: fileErrors.length > 0 ? fileErrors : undefined,
        });
      } else {
        parseErrors.push(`Folder "${folderName}" tidak memiliki gambar yang valid.`);
      }
    }

    const unmatchedList = Array.from(unmatchedFolders).map((f) => ({
      folderName: f,
      reason: 'Nama folder tidak cocok dengan nama produk mana pun di database.',
    }));

    return NextResponse.json({
      success: true,
      totalMatched: results.length,
      totalUnmatched: unmatchedList.length,
      totalImagesSaved,
      results,
      unmatched: unmatchedList,
      errors: parseErrors,
    });
  } catch (error) {
    console.error('Bulk ZIP upload error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses file ZIP.' }, { status: error.status || 500 });
  }
}
