import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const VALID_SALES_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

export async function POST(request) {
  try {
    await requirePermission(request, ['products:update', 'products:manage']);

    // 1. Ambil seluruh item pesanan dari status penjualan sah (PAID, PROCESSING, SHIPPED, COMPLETED)
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: VALID_SALES_STATUSES },
        },
      },
      select: {
        productId: true,
        variantId: true,
        selectedSize: true,
        quantity: true,
      },
    });

    // 2. Akumulasi jumlah unit terjual per produk, per varian, dan per size
    const productSoldMap = new Map();
    const variantSoldMap = new Map();
    const sizeSoldMap = new Map();

    for (const item of orderItems) {
      if (!item.productId) continue;
      const qty = item.quantity || 1;

      // Akumulasi total per produk
      productSoldMap.set(item.productId, (productSoldMap.get(item.productId) || 0) + qty);

      // Akumulasi per variantId jika ada
      if (item.variantId) {
        variantSoldMap.set(item.variantId, (variantSoldMap.get(item.variantId) || 0) + qty);
      }

      // Akumulasi per productId + selectedSize jika ada
      if (item.selectedSize) {
        const key = `${item.productId}:${item.selectedSize}`;
        sizeSoldMap.set(key, (sizeSoldMap.get(key) || 0) + qty);
      }
    }

    // 3. Ambil seluruh produk beserta data varian
    const products = await prisma.product.findMany({
      include: {
        variants: true,
      },
    });

    let updatedCount = 0;
    let stockAdjustedCount = 0;
    let totalSoldUnits = 0;

    await prisma.$transaction(async (tx) => {
      for (const product of products) {
        const totalSold = productSoldMap.get(product.id) || 0;
        const currentSold = product.soldCount || 0;
        totalSoldUnits += totalSold;

        // Delta: jumlah unit yang terjual namun belum pernah dipotong stoknya
        const delta = Math.max(0, totalSold - currentSold);
        let productNeedsUpdate = false;
        const updateData = {};

        // Selalu selaraskan soldCount jika berbeda
        if (product.soldCount !== totalSold) {
          updateData.soldCount = totalSold;
          productNeedsUpdate = true;
        }

        // Jika terdapat delta > 0, kurangi sisa stok sesuai transaksi yang terjadi
        if (delta > 0) {
          stockAdjustedCount++;

          // A. Produk dengan Varian Tabel (ProductVariant)
          if (Array.isArray(product.variants) && product.variants.length > 0) {
            let newTotalQty = 0;
            for (const v of product.variants) {
              const vSold = variantSoldMap.get(v.id) || sizeSoldMap.get(`${product.id}:${v.size}`) || 0;
              const newVariantStock = Math.max(0, v.stock - vSold);
              newTotalQty += newVariantStock;

              if (newVariantStock !== v.stock) {
                await tx.productVariant.update({
                  where: { id: v.id },
                  data: { stock: newVariantStock },
                });
              }
            }
            updateData.quantity = newTotalQty;
            updateData.isSold = newTotalQty === 0;
            productNeedsUpdate = true;
          }
          // B. Produk dengan Varian JSON legacy (product.sizes)
          else if (Array.isArray(product.sizes) && product.sizes.length > 0) {
            const updatedSizes = product.sizes.map((s) => {
              const sSold = sizeSoldMap.get(`${product.id}:${s.size}`) || 0;
              return {
                ...s,
                quantity: Math.max(0, (s.quantity || 0) - sSold),
              };
            });
            const newTotalQty = updatedSizes.reduce((sum, s) => sum + s.quantity, 0);
            updateData.sizes = updatedSizes;
            updateData.quantity = newTotalQty;
            updateData.isSold = newTotalQty === 0;
            productNeedsUpdate = true;
          }
          // C. Produk Satuan Standar (ikan satuan tanpa varian)
          else {
            const newTotalQty = Math.max(0, product.quantity - delta);
            updateData.quantity = newTotalQty;
            updateData.isSold = newTotalQty === 0;
            productNeedsUpdate = true;
          }
        } else {
          // Jika stok 0 tapi belum ditandai isSold, rapikan
          if (product.quantity === 0 && !product.isSold) {
            updateData.isSold = true;
            productNeedsUpdate = true;
          }
        }

        if (productNeedsUpdate) {
          await tx.product.update({
            where: { id: product.id },
            data: updateData,
          });
          updatedCount++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi berhasil! ${updatedCount} produk diperbarui (${stockAdjustedCount} produk disesuaikan sisa stoknya).`,
      updatedCount,
      stockAdjustedCount,
      totalSoldUnits,
      totalProducts: products.length,
    });
  } catch (error) {
    console.error('Gagal menyinkronkan soldCount dan stok produk:', error.message);
    return NextResponse.json(
      { error: error.message || 'Gagal menyinkronkan data penjualan dan stok.' },
      { status: error.status || 500 }
    );
  }
}
