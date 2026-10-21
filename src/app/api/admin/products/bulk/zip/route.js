import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { saveImageBuffer, detectImageKind } from '@/lib/imageStorage';

export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function extractFileNumber(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const match = base.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

function matchVariantForFile(fileName, subFolderName, variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const fLower = fileName.toLowerCase();
  const subLower = (subFolderName || '').toLowerCase();

  for (const v of variants) {
    if (!v.size) continue;
    const sLower = v.size.trim().toLowerCase();
    if (subLower && (subLower === sLower || subLower.startsWith(sLower + '-') || subLower.startsWith(sLower + '_'))) {
      return v;
    }
    const escaped = sLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i');
    if (regex.test(fLower)) {
      return v;
    }
  }
  return null;
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

    const allProducts = await prisma.product.findMany({
      include: { variants: true },
    });
    const productMap = new Map();
    for (const p of allProducts) {
      productMap.set(p.name.trim().toLowerCase(), p);
    }

    const foldersMap = new Map();
    const unmatchedFolders = new Set();
    const parseErrors = [];

    const entries = Object.values(zip.files);

    for (const entry of entries) {
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

      const ext = ('.' + normalizedPath.split('.').pop()).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
        continue;
      }

      const parts = normalizedPath.split('/').filter(Boolean);
      if (parts.length < 2) {
        parseErrors.push(`File "${entry.name}" tidak berada di dalam folder nama produk.`);
        continue;
      }

      const fileName = parts[parts.length - 1];
      let matchedProduct = null;
      let matchedFolderName = '';
      let productFolderIndex = -1;

      for (let i = parts.length - 2; i >= 0; i--) {
        const candidateName = parts[i].trim();
        const candidateLower = candidateName.toLowerCase();
        if (productMap.has(candidateLower)) {
          matchedProduct = productMap.get(candidateLower);
          matchedFolderName = candidateName;
          productFolderIndex = i;
          break;
        }
      }

      if (!matchedProduct) {
        const folderCandidate = parts[parts.length - 2];
        unmatchedFolders.add(folderCandidate);
        continue;
      }

      const subFolderName = (parts.length - 1 > productFolderIndex + 1)
        ? parts[parts.length - 2]
        : '';

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
        subFolderName,
        number: extractFileNumber(fileName),
      });
    }

    const results = [];
    let totalImagesSaved = 0;

    for (const [, { product, folderName, files }] of foldersMap.entries()) {
      files.sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
      });

      const savedUrls = [];
      const fileErrors = [];
      const variantImageMap = new Map();

      for (const item of files) {
        try {
          const imgBuffer = await item.entry.async('nodebuffer');

          if (imgBuffer.length > 10 * 1024 * 1024) {
            fileErrors.push(`File ${item.fileName} melebihi 10MB`);
            continue;
          }

          const kind = detectImageKind(imgBuffer);
          if (!kind) {
            fileErrors.push(`File ${item.fileName} bukan format gambar yang valid`);
            continue;
          }

          const savedUrl = await saveImageBuffer(imgBuffer);
          savedUrls.push(savedUrl);
          totalImagesSaved++;

          const matchedVar = matchVariantForFile(item.fileName, item.subFolderName, product.variants);
          if (matchedVar && !variantImageMap.has(matchedVar.id)) {
            variantImageMap.set(matchedVar.id, savedUrl);
          }
        } catch (imgErr) {
          fileErrors.push(`Gagal menyimpan ${item.fileName}: ${imgErr.message}`);
        }
      }

      if (savedUrls.length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            image: savedUrls[0],
            images: savedUrls,
          },
        });

        for (const [vId, vUrl] of variantImageMap.entries()) {
          await prisma.productVariant.update({
            where: { id: vId },
            data: { imageUrl: vUrl },
          });
        }

        results.push({
          productId: product.id,
          productName: product.name,
          folderName,
          imageCount: savedUrls.length,
          coverImage: savedUrls[0],
          images: savedUrls,
          variantsMatched: variantImageMap.size,
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
