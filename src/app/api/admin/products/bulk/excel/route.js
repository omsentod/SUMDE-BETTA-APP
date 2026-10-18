import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper parsing varian ukuran dari format "S:2, M:5, L:1" atau JSON string
function parseSizes(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  const str = String(input).trim();
  if (!str) return [];

  // Jika formatnya JSON array
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && item.size)
          .map((item) => ({
            size: String(item.size).trim(),
            quantity: Math.max(0, parseInt(item.quantity) || 0),
          }));
      }
    } catch {
      // Fallback ke string splitting
    }
  }

  // Format "S:2, M:5, L:1" atau "S: 2; M: 5"
  const parts = str.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const [sizePart, qtyPart] = part.split(':').map((s) => s.trim());
    if (sizePart) {
      const qty = parseInt(qtyPart) || 1;
      result.push({ size: sizePart, quantity: Math.max(0, qty) });
    }
  }
  return result;
}

// Helper ekstraksi nilai dari baris dengan variasi nama kolom
function getField(row, keys, fallback = '') {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return fallback;
}

export async function POST(request) {
  try {
    await requireAdmin(request);

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'File Excel tidak ditemukan dalam unggahan.' }, { status: 400 });
    }

    const filename = file.name || 'products.xlsx';
    const ext = filename.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json({ error: 'Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas maksimal 10MB.' }, { status: 400 });
    }

    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      return NextResponse.json({ error: 'File Excel rusak atau tidak dapat dibaca.' }, { status: 400 });
    }

    // Pilih sheet "Data Produk" jika ada, jika tidak pilih sheet pertama
    const sheetName = workbook.SheetNames.includes('Data Produk')
      ? 'Data Produk'
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: 'Sheet kosong atau tidak ditemukan dalam file Excel.' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'File Excel tidak memiliki baris data.' }, { status: 400 });
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // +2 karena index 0 = baris kedua di Excel (baris 1 header)

      const name = String(getField(row, ['Nama Produk', 'Nama', 'name', 'Title', 'Product Name'])).trim();
      const rawPrice = getField(row, ['Harga', 'price', 'Price', 'Harga (Rp)']);

      if (!name) {
        results.errors.push({ rowNumber, error: 'Kolom "Nama Produk" wajib diisi.' });
        continue;
      }

      // Bersihkan karakter selain angka pada harga (misal "Rp 250.000" -> 250000)
      const cleanPrice = typeof rawPrice === 'number'
        ? rawPrice
        : parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));

      if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
        results.errors.push({ rowNumber, productName: name, error: `Harga "${rawPrice}" tidak valid.` });
        continue;
      }

      const category = String(getField(row, ['Kategori', 'category', 'Kategori Form', 'form'], 'Plakat')).trim() || 'Plakat';
      const form = category;
      const gender = String(getField(row, ['Gender', 'gender', 'Jenis Kelamin'], 'Male')).trim() || 'Male';
      const coloration = String(getField(row, ['Corak Warna', 'coloration', 'Warna'], 'Multicolor')).trim() || 'Multicolor';
      const description = String(getField(row, ['Deskripsi', 'description', 'Keterangan'], '')).trim();
      const statsForm = String(getField(row, ['Grade Bentuk', 'statsForm', 'Grade'], 'COMP')).trim() || 'COMP';
      const age = String(getField(row, ['Umur', 'age', 'Age'], '4 Month')).trim() || '4 Month';
      const statsSpirit = 'Aktif';

      // Parse varian ukuran
      const rawSizes = getField(row, ['Ukuran', 'sizes', 'Sizes', 'Varian']);
      const sizes = parseSizes(rawSizes);

      // Hitung stok: jika ada sizes, total = sum of sizes. Jika tidak, ambil dari kolom Stok.
      let quantity = 1;
      if (sizes.length > 0) {
        quantity = sizes.reduce((sum, s) => sum + s.quantity, 0);
      } else {
        const rawQty = getField(row, ['Stok', 'quantity', 'Qty', 'Stock'], 1);
        const parsedQty = parseInt(rawQty);
        quantity = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 1;
      }

      // Parse sold count
      const rawSold = getField(row, ['Terjual', 'soldCount', 'Sold'], 0);
      const parsedSold = parseInt(rawSold);
      const soldCount = Number.isFinite(parsedSold) && parsedSold >= 0 ? parsedSold : 0;

      // Parse isPremium
      const rawPrem = String(getField(row, ['Premium', 'isPremium'], 'Tidak')).toLowerCase();
      const isPremium = ['ya', 'yes', 'true', '1'].includes(rawPrem);

      try {
        // Cari produk berdasarkan nama (case-insensitive)
        const existing = await prisma.product.findFirst({
          where: { name: { equals: name } },
        });

        if (existing) {
          const updated = await prisma.product.update({
            where: { id: existing.id },
            data: {
              price: cleanPrice,
              category,
              form,
              gender,
              coloration,
              description: description || existing.description,
              statsForm,
              age,
              statsSpirit,
              sizes: sizes.length > 0 ? sizes : (existing.sizes ?? []),
              quantity,
              isSold: quantity === 0,
              soldCount: soldCount > 0 ? soldCount : existing.soldCount,
              isPremium,
            },
          });
          results.updated.push({ rowNumber, id: updated.id, name: updated.name });
        } else {
          // Buat produk baru tanpa gambar terlebih dahulu (akan diisi saat upload ZIP foto)
          const created = await prisma.product.create({
            data: {
              name,
              price: cleanPrice,
              category,
              form,
              gender,
              coloration,
              description: description || `Ikan Cupang ${name} kualitas pilihan SUMDE BETTA.`,
              image: '',
              images: [],
              statsForm,
              age,
              statsSpirit,
              sizes,
              quantity,
              isSold: quantity === 0,
              soldCount,
              isPremium,
            },
          });
          results.created.push({ rowNumber, id: created.id, name: created.name });
        }
      } catch (rowErr) {
        console.error(`Error saving product row ${rowNumber}:`, rowErr);
        results.errors.push({ rowNumber, productName: name, error: rowErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      createdCount: results.created.length,
      updatedCount: results.updated.length,
      errorCount: results.errors.length,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Bulk Excel upload error:', error);
    return NextResponse.json({ error: error.message || 'Gagal memproses file Excel.' }, { status: error.status || 500 });
  }
}
