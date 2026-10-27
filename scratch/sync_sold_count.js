import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Status transaksi yang sah mewakili penjualan sukses
// Sesuai AGENTS.md §8: PAID, PROCESSING, SHIPPED, COMPLETED
const VALID_SALES_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

async function main() {
  console.log('[SYNC] Memulai sinkronisasi data terjual (soldCount) dan sisa stok produk...');

  // 1. Ambil semua item pesanan dari status penjualan sah
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
      order: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  console.log(`[SYNC] Ditemukan ${orderItems.length} order items dari pesanan berstatus: ${VALID_SALES_STATUSES.join(', ')}`);

  // 2. Akumulasi jumlah unit terjual per produk, per varian, dan per size
  const productSoldMap = new Map();
  const variantSoldMap = new Map();
  const sizeSoldMap = new Map();

  for (const item of orderItems) {
    if (!item.productId) continue;
    const qty = item.quantity || 1;

    productSoldMap.set(item.productId, (productSoldMap.get(item.productId) || 0) + qty);

    if (item.variantId) {
      variantSoldMap.set(item.variantId, (variantSoldMap.get(item.variantId) || 0) + qty);
    }

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

  console.log(`[SYNC] Total produk di database: ${products.length}`);

  let updatedCount = 0;
  let stockAdjustedCount = 0;
  let totalSoldUnits = 0;

  await prisma.$transaction(async (tx) => {
    for (const product of products) {
      const totalSold = productSoldMap.get(product.id) || 0;
      const currentSold = product.soldCount || 0;
      totalSoldUnits += totalSold;

      const delta = Math.max(0, totalSold - currentSold);
      let productNeedsUpdate = false;
      const updateData = {};

      if (product.soldCount !== totalSold) {
        updateData.soldCount = totalSold;
        productNeedsUpdate = true;
      }

      if (delta > 0) {
        stockAdjustedCount++;

        // A. Produk dengan Varian Tabel
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
              console.log(`   [VARIANT] "${product.name}" size ${v.size}: stok ${v.stock} -> ${newVariantStock}`);
            }
          }
          updateData.quantity = newTotalQty;
          updateData.isSold = newTotalQty === 0;
          productNeedsUpdate = true;
          console.log(`   [STOCK] "${product.name}": total stok varian -> ${newTotalQty} (terjual: ${totalSold})`);
        }
        // B. Produk dengan Varian JSON legacy
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
          console.log(`   [STOCK] "${product.name}": total stok sizes -> ${newTotalQty} (terjual: ${totalSold})`);
        }
        // C. Produk Satuan Standar (ikan satuan tanpa varian)
        else {
          const newTotalQty = Math.max(0, product.quantity - delta);
          updateData.quantity = newTotalQty;
          updateData.isSold = newTotalQty === 0;
          productNeedsUpdate = true;
          console.log(`   [STOCK] "${product.name}": stok ${product.quantity} -> ${newTotalQty} (terjual: ${totalSold})`);
        }
      } else {
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

  console.log('\n[SELESAI] Hasil sinkronisasi:');
  console.log(`- Jumlah produk diperbarui: ${updatedCount}`);
  console.log(`- Jumlah produk disesuaikan sisa stoknya: ${stockAdjustedCount}`);
  console.log(`- Total unit barang terjual tercatat: ${totalSoldUnits}`);
}

main()
  .catch((err) => {
    console.error('[ERROR] Sinkronisasi gagal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
