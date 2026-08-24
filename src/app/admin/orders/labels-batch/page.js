import prisma from '@/lib/prisma';
import Link from 'next/link';
import BatchPrintSidebar from '../[id]/label/BatchPrintSidebar';
import LabelContent from '../[id]/label/LabelContent';
import styles from '../[id]/label/label.module.css';

function getCourierBadgeClass(courier) {
  const c = String(courier || '').toLowerCase();
  if (c.includes('jne')) return styles.badgeCourierJne;
  if (c.includes('j&t') || c.includes('jnt')) return styles.badgeCourierJnt;
  if (c.includes('sicepat')) return styles.badgeCourierSicepat;
  if (c.includes('pos')) return styles.badgeCourierPos;
  if (c.includes('anteraja')) return styles.badgeCourierAnteraja;
  if (c.includes('tiki')) return styles.badgeCourierTiki;
  if (c.includes('gosend') || c.includes('grab')) return styles.badgeCourierInstant;
  return styles.badgeCourierDefault;
}

// GET /admin/orders/labels-batch?ids=id1,id2,id3
// Render banyak label thermal berurut dengan sidebar kontrol anti-human-error.
export default async function LabelsBatchPage({ searchParams }) {
  const sp = await searchParams;
  const idsRaw = sp?.ids || '';
  const ids = String(idsRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  if (ids.length === 0) {
    return (
      <div className={styles.viewport}>
        <div className={styles.previewLayout}>
          <div className={styles.controlSidebar}>
            <h2 className={styles.sidebarTitle}>Tidak Ada Pesanan Dipilih</h2>
            <p className={styles.statLabel}>
              Silakan pilih pesanan terlebih dahulu dari daftar pesanan admin untuk mencetak resi batch.
            </p>
            <Link href="/admin/orders" className={styles.mainPrintButton}>
              Kembali ke Daftar Pesanan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: { items: { include: { product: true } } },
  });

  // Urutkan sesuai urutan query string supaya prediktif.
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const ordered = ids.map((id) => orderById.get(id)).filter(Boolean);

  if (ordered.length === 0) {
    return (
      <div className={styles.viewport}>
        <div className={styles.previewLayout}>
          <div className={styles.controlSidebar}>
            <h2 className={styles.sidebarTitle}>Pesanan Tidak Ditemukan</h2>
            <p className={styles.statLabel}>
              ID pesanan yang diberikan tidak ditemukan di database.
            </p>
            <Link href="/admin/orders" className={styles.mainPrintButton}>
              Kembali ke Daftar Pesanan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewport}>
      <div className={styles.previewLayout}>
        {/* Kolom Kiri: Aliran Label Thermal yang Siap Cetak */}
        <div className={styles.labelStream}>
          {ordered.map((order, idx) => {
            const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
            const colorClass = styles[`colorTheme${idx % 6}`] || styles.colorTheme0;
            const courierClass = getCourierBadgeClass(order.shippingCourier);

            return (
              <div
                key={order.id}
                id={`label-${order.id}`}
                className={styles.labelWrapper}
              >
                {/* Header Card Warna-warni Pembeda Antar Resi (Hanya tampil di layar, tersembunyi saat print) */}
                <div className={styles.labelScreenHeader}>
                  <div className={styles.labelHeaderLeft}>
                    <span className={`${styles.orderNumberPill} ${colorClass}`}>
                      #{idx + 1}
                    </span>
                    <div className={styles.labelHeaderDetails}>
                      <span className={styles.labelRecipientName}>
                        {order.shippingName || order.name || 'Pelanggan'}
                      </span>
                      <span className={styles.labelOrderSub}>
                        ID: #{order.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.labelHeaderRight}>
                    <span className={`${styles.courierBadge} ${courierClass}`}>
                      {order.shippingCourier || 'Kurir'}
                    </span>
                    <span className={styles.qtyBadge}>
                      {itemCount} ekor
                    </span>
                  </div>
                </div>

                <LabelContent order={order} />
              </div>
            );
          })}
        </div>

        {/* Kolom Kanan: Panel Kontrol Cetak & Ringkasan Anti-Human-Error (Sticky) */}
        <div className={styles.sidebarColumn}>
          <BatchPrintSidebar orders={ordered} />
        </div>
      </div>
    </div>
  );
}
