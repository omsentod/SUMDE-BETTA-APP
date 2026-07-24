import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
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

    console.log(`\nDitemukan ${pendingOrders.length} pesanan PENDING. Jalankan script ini dengan menambahkan ID pesanan:`);
    console.log("\nContoh penggunaan: node scratch/simulate_payment.js <ORDER_ID>");
    console.log("\nDaftar Pesanan PENDING:");
    pendingOrders.forEach(order => {
      console.log(`- ID: ${order.id} | Nama: ${order.name} | Total: Rp ${order.total.toLocaleString('id-ID')} | Tanggal: ${order.createdAt.toLocaleString()}`);
      order.items.forEach(item => {
        console.log(`   * ${item.product.name} (Qty: ${item.quantity}${item.selectedSize ? `, Size: ${item.selectedSize}` : ''})`);
      });
    });
    return;
  }

  console.log(`\nMemproses simulasi pembayaran sukses untuk Order ID: ${orderId}...`);

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
    return;
  }

  if (order.status !== 'PENDING') {
    console.error(`Error: Pesanan ini sudah memiliki status "${order.status}". Hanya pesanan "PENDING" yang bisa disimulasikan pembayarannya.`);
    return;
  }

  console.log("\nDetail Pesanan:");
  console.log(`- Nama Pembeli: ${order.name}`);
  console.log(`- Total Tagihan: Rp ${order.total.toLocaleString('id-ID')}`);
  console.log("- Produk yang dibeli:");
  order.items.forEach(item => {
    console.log(`  * ${item.product.name} (Qty: ${item.quantity}${item.selectedSize ? `, Size: ${item.selectedSize}` : ''}) - Stok Awal: ${item.product.quantity}`);
  });

  console.log("\n[!] Menjalankan transaksi pengurangan stok & mengubah status menjadi PROCESSING...");

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

    console.log("\n✓ SIMULASI SUKSES!");
    console.log(`Status Order "${orderId}" sekarang: PROCESSING.`);
    console.log("Stok produk telah berhasil dikurangi di database.");
  } catch (error) {
    console.error("\nGagal memproses simulasi pembayaran:", error);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
