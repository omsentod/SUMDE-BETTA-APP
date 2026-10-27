import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Status transaksi yang sah mewakili penjualan sukses
// Sesuai AGENTS.md §8: PAID, PROCESSING, SHIPPED, COMPLETED
const VALID_SALES_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

async function main() {
  console.log('[SYNC] Memulai sinkronisasi data soldCount produk dari pesanan riil...');

  // 1. Ambil semua item dari order dengan status sah
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        status: { in: VALID_SALES_STATUSES },
      },
    },
    select: {
      productId: true,
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

  // 2. Akumulasi jumlah terjual per productId
  const soldMap = new Map();
  for (const item of orderItems) {
    if (!item.productId) continue;
    const current = soldMap.get(item.productId) || 0;
    soldMap.set(item.productId, current + (item.quantity || 1));
  }

  // 3. Ambil seluruh produk
  const products = await prisma.product.findMany({
    select: { id: true, name: true, soldCount: true },
  });

  console.log(`[SYNC] Total produk di database: ${products.length}`);

  let updatedCount = 0;
  let totalSoldUnits = 0;

  for (const product of products) {
    const computedSold = soldMap.get(product.id) || 0;
    totalSoldUnits += computedSold;

    if (product.soldCount !== computedSold) {
      await prisma.product.update({
        where: { id: product.id },
        data: { soldCount: computedSold },
      });
      console.log(`[UPDATE] "${product.name}" (${product.id.slice(0, 8)}): soldCount ${product.soldCount} -> ${computedSold}`);
      updatedCount++;
    }
  }

  console.log('\n[SELESAI] Hasil sinkronisasi:');
  console.log(`- Jumlah produk yang diperbarui: ${updatedCount}`);
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
