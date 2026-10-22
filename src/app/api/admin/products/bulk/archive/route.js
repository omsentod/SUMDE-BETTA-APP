import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export async function POST(request) {
  try {
    // Memerlukan permission products:manage atau products:delete/update
    await requirePermission(request, ['products:manage', 'products:delete', 'products:update']);

    const body = await request.json().catch(() => ({}));
    const { ids = [], archive = true } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Daftar ID produk tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maksimal 100 produk per satu kali aksi massal.' },
        { status: 400 }
      );
    }

    const isArchived = Boolean(archive);
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isArchived },
    });

    return NextResponse.json({
      ok: true,
      count: result.count,
      message: isArchived
        ? `${result.count} produk berhasil dipindahkan ke Recycle Bin.`
        : `${result.count} produk berhasil dipulihkan ke etalase toko.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memproses arsip produk massal.' },
      { status: error.status || 500 }
    );
  }
}
