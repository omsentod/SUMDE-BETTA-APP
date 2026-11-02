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

  const parts = str.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
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

function cleanStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function normalizeKey(str) {
  return cleanStr(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findDepartment(rawDept, depts) {
  if (!rawDept || !Array.isArray(depts)) return null;
  const target = normalizeKey(rawDept);
  if (!target) return null;

  // 1. Exact match by name or slug
  let found = depts.find((d) => normalizeKey(d.name) === target || normalizeKey(d.slug) === target);
  if (found) return found;

  // 2. Substring match
  found = depts.find((d) => {
    const dNorm = normalizeKey(d.name);
    return dNorm.includes(target) || target.includes(dNorm);
  });
  return found || null;
}

function findSubCategory(rawSub, subCategories) {
  if (!rawSub || !Array.isArray(subCategories) || subCategories.length === 0) return null;
  const target = normalizeKey(rawSub);
  if (!target) return null;

  // 1. Exact match by name or slug
  let found = subCategories.find((s) => normalizeKey(s.name) === target || normalizeKey(s.slug) === target);
  if (found) return found;

  // 2. Substring match
  found = subCategories.find((s) => {
    const sNorm = normalizeKey(s.name);
    return sNorm.includes(target) || target.includes(sNorm);
  });
  return found || null;
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
      return NextResponse.json({ error: 'Sheet "Data Produk" kosong atau tidak ditemukan dalam file Excel.' }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'File Excel tidak memiliki baris data.' }, { status: 400 });
    }

    // Pre-fetch all departments and their subcategories for fast, safe in-memory validation
    const allDepartments = await prisma.department.findMany({
      include: {
        subCategories: true,
      },
    });

    const results = { created: [], updated: [], errors: [] };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;

      const name = cleanStr(getField(row, ['Nama Produk', 'Nama', 'name', 'Title', 'Product Name']));
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

      // 1. Departemen & Sub-Kategori Matching
      const rawDept = cleanStr(getField(row, ['Departemen', 'departemen', 'Department', 'department', 'Tingkat 1']));
      const rawSubCat = cleanStr(getField(row, ['Sub-Kategori', 'Sub Kategori', 'subCategory', 'sub_category', 'Subcategory', 'Sub Kategori (Tingkat 2)', 'Tingkat 2', 'Jenis']));

      let matchedDept = null;
      if (rawDept) {
        matchedDept = findDepartment(rawDept, allDepartments);
        if (!matchedDept) {
          results.errors.push({
            rowNumber,
            productName: name,
            error: `Departemen "${rawDept}" tidak ditemukan di database. Silakan gunakan nama departemen yang terdaftar di sheet "Daftar Departemen & Kategori".`,
          });
          continue;
        }
      }

      // Jika Departemen tidak diisi tetapi Sub-Kategori terisi, coba inferensikan dari Sub-Kategori
      if (!matchedDept && rawSubCat) {
        for (const dept of allDepartments) {
          const subMatch = findSubCategory(rawSubCat, dept.subCategories);
          if (subMatch) {
            matchedDept = dept;
            break;
          }
        }
      }

      // Jika tetap belum ada departemen, fallback ke departemen live fish atau yang pertama
      if (!matchedDept && allDepartments.length > 0) {
        matchedDept = allDepartments.find((d) => d.isLiveFish) || allDepartments[0];
      }

      // Validasi Sub-Kategori di bawah Departemen terpilih
      let matchedSub = null;
      if (matchedDept && rawSubCat) {
        matchedSub = findSubCategory(rawSubCat, matchedDept.subCategories);
        if (!matchedSub) {
          // Deteksi apakah sub-kategori ini sebenarnya milik departemen lain
          let wrongDept = null;
          for (const other of allDepartments) {
            if (other.id === matchedDept.id) continue;
            if (findSubCategory(rawSubCat, other.subCategories)) {
              wrongDept = other;
              break;
            }
          }

          if (wrongDept) {
            results.errors.push({
              rowNumber,
              productName: name,
              error: `Sub-kategori "${rawSubCat}" terdaftar di bawah departemen "${wrongDept.name}", bukan "${matchedDept.name}". Silakan sesuaikan departemennya.`,
            });
            continue;
          } else {
            results.errors.push({
              rowNumber,
              productName: name,
              error: `Sub-kategori "${rawSubCat}" tidak terdaftar di departemen "${matchedDept.name}". Silakan gunakan sub-kategori dari sheet "Daftar Departemen & Kategori".`,
            });
            continue;
          }
        }
      }

      const isLiveFish = matchedDept ? Boolean(matchedDept.isLiveFish) : true;

      // 2. Atribut Fisik Alat / Pakan
      const rawBrand = cleanStr(getField(row, ['Merk / Brand', 'Brand', 'brand', 'Merk', 'merek', 'Merek']));
      const brand = rawBrand || null;

      const rawWeight = getField(row, ['Berat (Gram)', 'Berat', 'berat', 'weight', 'Weight', 'Berat(gr)']);
      const parsedWeight = parseInt(rawWeight);
      const weight = Number.isFinite(parsedWeight) && parsedWeight >= 50 ? parsedWeight : 1000;

      // 3. Link Video (Flaring / Demo)
      const videoUrl = cleanStr(getField(row, ['Link Video', 'videoUrl', 'Video', 'Video URL', 'Link Flaring', 'video'])) || null;

      // 4. Kategori, Form, Corak Warna, Umur, Grade
      const rawCategory = cleanStr(getField(row, ['Kategori Form', 'Kategori', 'category', 'form']));
      const rawColoration = cleanStr(getField(row, ['Corak Warna', 'coloration', 'Warna']));
      const rawStatsForm = cleanStr(getField(row, ['Grade Bentuk', 'statsForm', 'Grade']));
      const rawAge = cleanStr(getField(row, ['Umur', 'age', 'Age']));
      const description = cleanStr(getField(row, ['Deskripsi', 'description', 'Keterangan']));

      let category = rawCategory;
      let form = rawCategory;
      let coloration = rawColoration;
      let statsForm = rawStatsForm;
      let statsSpirit = 'Aktif';
      let age = rawAge;

      if (isLiveFish) {
        category = category || (matchedSub ? matchedSub.name : 'Plakat');
        form = form || category;
        coloration = coloration || 'Multicolor';
        statsForm = statsForm || 'COMP';
        statsSpirit = 'Aktif';
        age = age || '4 Month';
      } else {
        // Barang kering (Peralatan & Pakan)
        category = category && category !== '-' ? category : (matchedSub ? matchedSub.name : (matchedDept ? matchedDept.name : 'Peralatan'));
        form = form && form !== '-' ? form : category;
        coloration = coloration && coloration !== '-' ? coloration : '-';
        statsForm = statsForm && statsForm !== '-' ? statsForm : '-';
        statsSpirit = '-';
        age = age && age !== '-' ? age : '-';
      }

      // 5. Varian & Stok
      const rawVariants = getField(row, ['Varian', 'varian', 'Varian / Ukuran', 'Ukuran', 'sizes', 'Sizes', 'Variants']);
      const variants = parseVariants(rawVariants);

      let quantity = 1;
      if (variants.length > 0) {
        quantity = variants.reduce((sum, v) => sum + v.stock, 0);
      } else {
        const rawQty = getField(row, ['Stok', 'quantity', 'Qty', 'Stock'], 1);
        const parsedQty = parseInt(rawQty);
        quantity = Number.isFinite(parsedQty) && parsedQty >= 0 ? parsedQty : 1;

        const rawGender = cleanStr(getField(row, ['Gender', 'gender', 'Jenis Kelamin']));
        if (rawGender) {
          variants.push({ size: rawGender, stock: quantity, price: null });
        }
      }

      const rawSold = getField(row, ['Terjual', 'soldCount', 'Sold'], 0);
      const parsedSold = parseInt(rawSold);
      const soldCount = Number.isFinite(parsedSold) && parsedSold >= 0 ? parsedSold : 0;

      const rawPrem = cleanStr(getField(row, ['Premium', 'isPremium'], 'Tidak')).toLowerCase();
      const isPremium = ['ya', 'yes', 'true', '1'].includes(rawPrem);

      try {
        const existing = await prisma.product.findFirst({
          where: { name: { equals: name } },
          include: { variants: true },
        });

        const departmentId = matchedDept ? matchedDept.id : null;
        const subCategoryId = matchedSub ? matchedSub.id : null;

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
                statsSpirit,
                quantity,
                isSold: quantity === 0,
                soldCount: soldCount > 0 ? soldCount : existing.soldCount,
                isPremium,
                departmentId: departmentId || existing.departmentId,
                subCategoryId: subCategoryId !== null ? subCategoryId : (rawSubCat ? null : existing.subCategoryId),
                brand: brand !== null ? brand : existing.brand,
                weight,
                videoUrl: videoUrl || existing.videoUrl,
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
              description: description || `Produk ${name} kualitas pilihan SUMDE BETTA.`,
              image: '',
              images: [],
              videoUrl,
              statsForm,
              age,
              statsSpirit,
              quantity,
              isSold: quantity === 0,
              soldCount,
              isPremium,
              departmentId,
              subCategoryId,
              brand,
              weight,
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
