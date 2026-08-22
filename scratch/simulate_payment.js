import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function processOrder(orderId) {
  console.log(`\n----------------------------------------`);
  console.log(`Memproses simulasi pembayaran untuk Order ID: ${orderId}...`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true }
      }
    }
  });

  if (!order) {
    console.error(`Error: Pesanan dengan ID "${orderId}" tidak ditemukan.`);
    return false;
  }

  if (order.status !== 'PENDING') {
    console.error(`Error: Pesanan ini memiliki status "${order.status}". Hanya pesanan "PENDING" yang bisa disimulasikan.`);
    return false;
  }

  console.log(`- Nama Pembeli: ${order.name}`);
  console.log(`- Total Tagihan: Rp ${order.total.toLocaleString('id-ID')}`);
  console.log("- Produk yang dibeli:");
  order.items.forEach(item => {
    console.log(`  * ${item.product.name} (Qty: ${item.quantity}${item.selectedSize ? `, Size: ${item.selectedSize}` : ''}) - Stok Awal: ${item.product.quantity}`);
  });

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Decrement stock
      for (const item of order.items) {
        const product = item.product;
        if (!product) continue;

        let updatedSizes = null;
        let newTotalQty;

        if (Array.isArray(product.sizes) && item.selectedSize) {
          updatedSizes = product.sizes.map((s) =>
            s.size === item.selectedSize
              ? { ...s, quantity: Math.max(0, s.quantity - item.quantity) }
              : s
          );
          newTotalQty = updatedSizes.reduce((sum, s) => sum + s.quantity, 0);
        } else {
          newTotalQty = Math.max(0, product.quantity - item.quantity);
        }

        console.log(`    -> Mengurangi stok "${product.name}" ke ${newTotalQty}`);

        await tx.product.update({
          where: { id: product.id },
          data: {
            sizes: updatedSizes ?? undefined,
            quantity: newTotalQty,
            isSold: newTotalQty === 0,
          },
        });
      }

      // 2. Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PROCESSING' }
      });
    });

    console.log(`✓ SUKSES! Status Order "${orderId}" sekarang: PROCESSING.`);
    return true;
  } catch (error) {
    console.error(`Gagal memproses simulasi pembayaran untuk "${orderId}":`, error);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("=== SIMULASI PEMBAYARAN DOKU ===");
    console.log("Mencari pesanan dengan status 'PENDING' di database...");
    
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (pendingOrders.length === 0) {
      console.log("\nTidak ada pesanan dengan status 'PENDING'.");
      console.log("Silakan buat pesanan baru terlebih dahulu melalui checkout di aplikasi web.");
      return;
    }

    console.log(`\nDitemukan ${pendingOrders.length} pesanan PENDING.`);
    console.log("\nCara penggunaan:");
    console.log("1. Memproses 1 pesanan   : node scratch/simulate_payment.js <ORDER_ID>");
    console.log("2. Memproses beberapa ID : node scratch/simulate_payment.js <ID_1> <ID_2> ...");
    console.log("3. Memproses SEMUA ID    : node scratch/simulate_payment.js all");
    console.log("\nDaftar Pesanan PENDING:");
    pendingOrders.forEach(order => {
      console.log(`- ID: ${order.id} | Nama: ${order.name} | Total: Rp ${order.total.toLocaleString('id-ID')} | Tanggal: ${order.createdAt.toLocaleString()}`);
      order.items.forEach(item => {
        console.log(`   * ${item.product.name} (Qty: ${item.quantity}${item.selectedSize ? `, Size: ${item.selectedSize}` : ''})`);
      });
    });
    return;
  }

  let targetIds = [];

  if (args[0].toLowerCase() === 'all') {
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      select: { id: true }
    });
    if (pendingOrders.length === 0) {
      console.log("Tidak ada pesanan PENDING untuk diproses.");
      return;
    }
    targetIds = pendingOrders.map(o => o.id);
  } else {
    targetIds = args;
  }

  console.log(`\nAkan memproses ${targetIds.length} pesanan...`);
  let successCount = 0;
  for (const id of targetIds) {
    const ok = await processOrder(id);
    if (ok) successCount++;
  }

  console.log(`\n========================================`);
  console.log(`Selesai! Berhasil memproses ${successCount} dari ${targetIds.length} pesanan.`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

