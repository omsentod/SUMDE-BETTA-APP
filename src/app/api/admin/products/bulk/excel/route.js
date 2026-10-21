import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function parseVariants(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  const str = String(input).trim();
  if (!str) return [];

  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => v && v.size).map((v) => ({
          size: String(v.size).trim(),
          stock: Math.max(0, parseInt(v.stock) || 0),
          price: v.price !== undefined && v.price !== '' ? parseFloat(v.price) || null : null,
        }));
      }
    } catch { }
  }

  const parts = str.split(/[,;\\n]+/).map((p) => p.trim()).filter(Boolean);
  const result = [];
  for (const part of parts) {
    const segments = part.split(':').map((s) => s.trim());
    const size = segments[0];
    if (!size) continue;
    const stock = Math.max(0, parseInt(segments[1]) || 1);
    const price = segments[2] !== undefined && segments[2] !== '' ? parseFloat(segments[2]) || null : null;
    result.push({ size, stock, price });
  }
  return result;
}

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
    await requirePermission(request, 'products:manage');

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

    const results = { created: [], updated: [], errors: [] };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;

      const name = String(getField(row, ['Nama Produk', 'Nama', 'name', 'Title', 'Product Name'])).trim();
      const rawPrice = getField(row, ['Harga', 'price', 'Price', 'Harga (Rp)']);

      if (!name) {
        results.errors.push({ rowNumber, error: 'Kolom "Nama Produk" wajib diisi.' });
        continue;
      }

      const cleanPrice = typeof rawPrice === 'number'
        ? rawPrice
        : parseFloat(String(rawPrice).replace(/[^0-9.]/g, ''));

      if (!Number.isFinite(cleanPrice) || cleanPrice < 0) {
        results.errors.push({ rowNumber, productName: name, error: `Harga "${rawPrice}" tidak valid.` });
        continue;
      }

      const category = String(getField(row, ['Kategori', 'category', 'Kategori Form', 'form'], 'Plakat')).trim() || 'Plakat';
      const form = category;
      const coloration = String(getField(row, ['Corak Warna', 'coloration', 'Warna'], 'Multicolor')).trim() || 'Multicolor';
      const description = String(getField(row, ['Deskripsi', 'description', 'Keterangan'], '')).trim();
      const statsForm = String(getField(row, ['Grade Bentuk', 'statsForm', 'Grade'], 'COMP')).trim() || 'COMP';
      const age = String(getField(row, ['Umur', 'age', 'Age'], '4 Month')).trim() || '4 Month';

      const rawVariants = getField(row, ['Varian', 'varian', 'Varian / Ukuran', 'Ukuran', 'sizes', 'Sizes', 'Variants']);
      const variants = parseVariants(rawVariants);

      let quantity = 1;
      if (variants.length > 0) {
        quantity = variants.reduce((sum, v) => sum + v.stock, 0);
      } else {
        const rawQty = getField(row, ['Stok', 'quantity', 'Qty', 'Stock'], 1);
        const parsedQty = parseInt(rawQty);
        quantity = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 1;

        const rawGender = String(getField(row, ['Gender', 'gender', 'Jenis Kelamin'], '')).trim();
        if (rawGender) {
          variants.push({ size: rawGender, stock: quantity, price: null });
        }
      }

      const rawSold = getField(row, ['Terjual', 'soldCount', 'Sold'], 0);
      const parsedSold = parseInt(rawSold);
      const soldCount = Number.isFinite(parsedSold) && parsedSold >= 0 ? parsedSold : 0;

      const rawPrem = String(getField(row, ['Premium', 'isPremium'], 'Tidak')).toLowerCase();
      const isPremium = ['ya', 'yes', 'true', '1'].includes(rawPrem);

      try {
        const existing = await prisma.product.findFirst({
          where: { name: { equals: name } },
          include: { variants: true },
        });

        if (existing) {
          await prisma.$transaction(async (tx) => {
            await tx.product.update({
              where: { id: existing.id },
              data: {
                price: cleanPrice,
                category,
                form,
                coloration,
                description: description || existing.description,
                statsForm,
                age,
                statsSpirit: 'Aktif',
                quantity,
                isSold: quantity === 0,
                soldCount: soldCount > 0 ? soldCount : existing.soldCount,
                isPremium,
              },
            });

            if (variants.length > 0) {
              await tx.productVariant.deleteMany({ where: { productId: existing.id } });
              await tx.productVariant.createMany({
                data: variants.map((v, idx) => ({
                  productId: existing.id,
                  size: v.size,
                  stock: v.stock,
                  price: v.price ?? null,
                  imageUrl: null,
                  displayOrder: idx,
                })),
              });
            }
          });
          results.updated.push({ rowNumber, id: existing.id, name });
        } else {
          const created = await prisma.product.create({
            data: {
              name,
              price: cleanPrice,
              category,
              form,
              coloration,
              description: description || `Ikan Cupang ${name} kualitas pilihan SUMDE BETTA.`,
              image: '',
              images: [],
              statsForm,
              age,
              statsSpirit: 'Aktif',
              quantity,
              isSold: quantity === 0,
              soldCount,
              isPremium,
              variants: variants.length > 0
                ? {
                    create: variants.map((v, idx) => ({
                      size: v.size,
                      stock: v.stock,
                      price: v.price ?? null,
                      imageUrl: null,
                      displayOrder: idx,
                    })),
                  }
                : undefined,
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
