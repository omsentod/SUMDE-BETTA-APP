import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
    console.log("=== RESET STATUS PESANAN KE PROCESSING ===");
    console.log("Penggunaan: node scratch/reset_order_status.js <ORDER_ID>");
    
    const shippedOrders = await prisma.order.findMany({
      where: { status: 'SHIPPED' },
      orderBy: { createdAt: 'desc' }
    });

    if (shippedOrders.length === 0) {
      console.log("\nTidak ada pesanan dengan status 'SHIPPED'.");
    } else {
      console.log("\nDaftar Pesanan Berstatus SHIPPED:");
      shippedOrders.forEach(o => {
        console.log(`- ID: ${o.id} | Nama: ${o.name} | Resi: ${o.trackingNumber}`);
      });
    }
    return;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: 'PROCESSING',
      biteshipShipmentId: null,
      trackingNumber: null,
      biteshipStatus: null
    }
  });

  console.log(`✓ Pesanan ${orderId} berhasil dikembalikan ke status PROCESSING (Lunas) & resi di-reset!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
