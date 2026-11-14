/**
 * Order Expiration Helper (24-Hour Payment Window)
 *
 * Sesuai aturan bisnis e-commerce & SUMDE-BETTA:
 * Pesanan yang berstatus PENDING (belum bayar) memiliki kurun waktu 24 jam.
 * Jika dalam 24 jam tidak ada perlakuan pembayaran / konfirmasi, pesanan otomatis berstatus CANCELLED.
 * Pada status PENDING, stok belum dikurangi (deferred stock reduction), sehingga
 * pembatalan pesanan kadaluwarsa tidak memerlukan restock balik.
 */

export const ORDER_PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam

/**
 * Cek apakah pesanan PENDING sudah melampaui kurun waktu 24 jam.
 */
export function isOrderExpired(order) {
  if (!order || order.status !== 'PENDING' || !order.createdAt) return false;
  const createdAtMs = new Date(order.createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs > ORDER_PAYMENT_EXPIRY_MS;
}

/**
 * Menghitung waktu kadaluwarsa pasti (createdAt + 24 jam).
 */
export function getOrderExpiryDate(createdAt) {
  const createdAtMs = new Date(createdAt || Date.now()).getTime();
  return new Date(createdAtMs + ORDER_PAYMENT_EXPIRY_MS);
}

/**
 * Lazy / Scheduled Auto-Cancel:
 * Menyapu pesanan PENDING yang berumur > 24 jam dan memutasi statusnya ke CANCELLED.
 */
export async function sweepExpiredPendingOrders(prismaClient) {
  if (!prismaClient?.order) return 0;
  const threshold = new Date(Date.now() - ORDER_PAYMENT_EXPIRY_MS);
  try {
    const result = await prismaClient.order.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: threshold },
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count > 0) {
      console.log(`[OrderExpiry] Otomatis membatalkan ${result.count} pesanan PENDING yang kadaluwarsa (>24 jam).`);
    }
    return result.count;
  } catch (err) {
    console.error('[OrderExpiry] Gagal menyapu pesanan kadaluwarsa:', err.message);
    return 0;
  }
}
