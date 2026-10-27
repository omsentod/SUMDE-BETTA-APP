import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const VALID_SALES_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

export async function POST(request) {
  try {
    await requirePermission(request, ['products:update', 'products:manage']);

    // 1. Ambil seluruh item pesanan dari status penjualan sah
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: VALID_SALES_STATUSES },
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
    });

    // 2. Akumulasi jumlah unit terjual per productId
    const soldMap = new Map();
    for (const item of orderItems) {
      if (!item.productId) continue;
      const current = soldMap.get(item.productId) || 0;
      soldMap.set(item.productId, current + (item.quantity || 1));
    }

    // 3. Ambil seluruh produk untuk dibandingkan
    const products = await prisma.product.findMany({
      select: { id: true, name: true, soldCount: true },
    });

    let updatedCount = 0;
    let totalSoldUnits = 0;

    const updates = [];
    for (const product of products) {
      const computedSold = soldMap.get(product.id) || 0;
      totalSoldUnits += computedSold;

      if (product.soldCount !== computedSold) {
        updates.push(
          prisma.product.update({
            where: { id: product.id },
            data: { soldCount: computedSold },
          })
        );
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan data penjualan. ${updatedCount} produk diperbarui.`,
      updatedCount,
      totalSoldUnits,
      totalProducts: products.length,
    });
  } catch (error) {
    console.error('Gagal menyinkronkan soldCount produk:', error.message);
    return NextResponse.json(
      { error: error.message || 'Gagal menyinkronkan data penjualan.' },
      { status: error.status || 500 }
    );
  }
}
