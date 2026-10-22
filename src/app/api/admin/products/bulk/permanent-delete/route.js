import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function POST(request) {
  try {
    await requirePermission(request, ['products:manage', 'products:delete']);

    const body = await request.json().catch(() => ({}));
    const { ids = [] } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Daftar ID produk tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maksimal 100 produk per satu kali penghapusan permanen.' },
        { status: 400 }
      );
    }

    // Periksa produk mana saja yang memiliki riwayat pesanan (invoice)
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: { in: ids } },
      select: { productId: true },
      distinct: ['productId'],
    });

    const blockedIds = new Set(orderItems.map((o) => o.productId));
    const deletableIds = ids.filter((id) => !blockedIds.has(id));

    let deletedCount = 0;
    if (deletableIds.length > 0) {
      const res = await prisma.product.deleteMany({
        where: { id: { in: deletableIds } },
      });
      deletedCount = res.count;
    }

    const blockedCount = blockedIds.size;
    let message = `${deletedCount} produk berhasil dihapus secara permanen.`;
    if (blockedCount > 0) {
      message += ` (${blockedCount} produk dilewati karena memiliki riwayat pesanan dan tetap berada di Recycle Bin).`;
    }

    return NextResponse.json({
      ok: true,
      deletedCount,
      blockedCount,
      message,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus produk permanen.' },
      { status: error.status || 500 }
    );
  }
}
