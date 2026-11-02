import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { restoreRecycleItem, permanentlyDeleteRecycleItem } from '@/lib/recycleBin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, ['products:view', 'products:manage']);

    const { searchParams } = new URL(request.url);
    const filterType = (searchParams.get('type') || 'ALL').toUpperCase();
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    // 1. Ambil data produk terarsip (Product.isArchived = true)
    let archivedProducts = [];
    try {
      archivedProducts = await prisma.product.findMany({
        where: { isArchived: true },
        include: {
          department: true,
          subCategory: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (e) {
      console.error('[RecycleBin API] Gagal memuat produk terarsip:', e.message);
    }

    // 2. Ambil data entitas lain dari RecycleBinItem
    let otherItems = [];
    try {
      otherItems = await prisma.recycleBinItem.findMany({
        orderBy: { deletedAt: 'desc' },
      });
    } catch (e) {
      console.warn('[RecycleBin API] Tabel RecycleBinItem belum ada atau kosong:', e.message);
    }

    // Normalisasi Produk ke bentuk seragam RecycleBinRow
    const productRows = archivedProducts.map((p) => ({
      id: p.id,
      entityType: 'PRODUCT',
      entityGroup: 'PRODUCT',
      name: p.name,
      summary: `Stok: ${p.quantity} • Rp ${new Intl.NumberFormat('id-ID').format(p.price || 0)} • ${p.form || p.category || 'Standard'}`,
      image: p.image || null,
      deletedAt: p.updatedAt,
      deletedBy: null,
      meta: {
        price: p.price,
        quantity: p.quantity,
        soldCount: p.soldCount,
        category: p.form || p.category,
      },
    }));

    // Normalisasi Entitas Lain
    const otherRows = otherItems.map((item) => {
      let group = 'OTHER';
      if (item.entityType === 'DEPARTMENT' || item.entityType === 'SUBCATEGORY') group = 'CATEGORY';
      else if (item.entityType === 'EVENT') group = 'EVENT';
      else if (item.entityType === 'USER') group = 'USER';
      else if (item.entityType === 'ROLE') group = 'ROLE';
      else if (item.entityType === 'TELEGRAM_EVENT') group = 'TELEGRAM';

      const data = item.data || {};
      let img = null;
      if (data.image) img = data.image;
      if (data.icon) img = data.icon;

      return {
        id: item.id,
        entityType: item.entityType,
        entityGroup: group,
        name: item.name,
        summary: item.summary,
        image: img,
        deletedAt: item.deletedAt,
        deletedBy: item.deletedBy,
        meta: data,
      };
    });

    const allRows = [...productRows, ...otherRows].sort((a, b) => {
      return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
    });

    // Hitung counts per tab
    const counts = {
      all: allRows.length,
      product: productRows.length,
      category: otherRows.filter((r) => r.entityGroup === 'CATEGORY').length,
      event: otherRows.filter((r) => r.entityGroup === 'EVENT').length,
      user: otherRows.filter((r) => r.entityGroup === 'USER').length,
      role: otherRows.filter((r) => r.entityGroup === 'ROLE').length,
      telegram: otherRows.filter((r) => r.entityGroup === 'TELEGRAM').length,
    };

    // Filter berdasarkan tab aktif
    let filtered = allRows;
    if (filterType !== 'ALL') {
      filtered = filtered.filter((r) => r.entityGroup === filterType);
    }

    // Filter berdasarkan pencarian
    if (search) {
      filtered = filtered.filter((r) => {
        const matchName = (r.name || '').toLowerCase().includes(search);
        const matchSummary = (r.summary || '').toLowerCase().includes(search);
        const matchType = (r.entityType || '').toLowerCase().includes(search);
        return matchName || matchSummary || matchType;
      });
    }

    return NextResponse.json({
      items: filtered,
      counts,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requirePermission(request, ['products:manage', 'products:delete']);

    const body = await request.json().catch(() => ({}));
    const { action, ids = [] } = body;

    if (!action || !['restore', 'permanent-delete'].includes(action)) {
      return NextResponse.json({ error: 'Aksi tidak valid (hanya restore atau permanent-delete).' }, { status: 400 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Daftar ID tidak boleh kosong.' }, { status: 400 });
    }

    const results = [];
    for (const id of ids) {
      try {
        if (action === 'restore') {
          const res = await restoreRecycleItem(id);
          results.push({ id, ok: true, name: res.name, entityType: res.entityType });
        } else {
          const res = await permanentlyDeleteRecycleItem(id);
          results.push({ id, ok: true, name: res.name, entityType: res.entityType });
        }
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failedCount = results.filter((r) => !r.ok).length;
    const errors = results.filter((r) => !r.ok).map((r) => r.error);

    return NextResponse.json({
      ok: true,
      action,
      successCount,
      failedCount,
      errors,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
