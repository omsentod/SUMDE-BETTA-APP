'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './label.module.css';

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

export default function BatchPrintSidebar({ orders = [], single = false }) {
  const totalOrders = orders.length;
  const [printUpdated, setPrintUpdated] = useState(false);
  const markedRef = useRef(false);

  const totalQty = orders.reduce(
    (sum, o) => sum + (o.items?.reduce((iSum, item) => iSum + (item.quantity || 1), 0) || 0),
    0
  );

  // Breakdown kurir
  const courierMap = {};
  orders.forEach((o) => {
    const courier = (o.shippingCourier || 'Lainnya').toUpperCase();
    courierMap[courier] = (courierMap[courier] || 0) + 1;
  });
  const courierList = Object.entries(courierMap);

  const markOrdersPrinted = async () => {
    if (markedRef.current) return;
    const paidIds = orders.filter((o) => o.status === 'PAID').map((o) => o.id);
    if (paidIds.length === 0) return;

    markedRef.current = true;
    try {
      const res = await fetch('/api/admin/orders/bulk/mark-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: paidIds }),
      });
      if (res.ok) {
        setPrintUpdated(true);
      }
    } catch (err) {
      console.error('Gagal memperbarui status cetak resi:', err);
      markedRef.current = false;
    }
  };

  const handlePrint = () => {
    markOrdersPrinted();
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  useEffect(() => {
    const onAfterPrint = () => {
      markOrdersPrinted();
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [orders]);

  const handleScrollToLabel = (orderId) => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`label-${orderId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <aside className={styles.controlSidebar}>
      {/* Header Panel */}
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitleRow}>
          <svg className={styles.sidebarIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <h2 className={styles.sidebarTitle}>
            {single ? 'Cetak Resi' : 'Kontrol Cetak Batch'}
          </h2>
        </div>
        <span className={styles.batchCountBadge}>
          {totalOrders} {totalOrders > 1 ? 'Pesanan' : 'Pesanan'}
        </span>
      </div>

      {/* Tombol Aksi Utama */}
      <div className={styles.actionGroup}>
        <button
          type="button"
          onClick={handlePrint}
          className={styles.mainPrintButton}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>{single ? 'Cetak Resi Ini' : `Cetak Semua (${totalOrders})`}</span>
        </button>

        {printUpdated ? (
          <div className={`${styles.printStatusIndicator} ${styles.statusSuccess}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Status diperbarui ke DIPROSES</span>
          </div>
        ) : (
          <div className={`${styles.printStatusIndicator} ${styles.statusInfo}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Mencetak resi otomatis memindahkan status ke DIPROSES</span>
          </div>
        )}

        <Link href="/admin/orders" className={styles.backOrdersLink}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Kembali ke Daftar Pesanan</span>
        </Link>
      </div>

      {/* Grid Ringkasan / Anti Human Error */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Ringkasan Batch</span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalOrders}</span>
            <span className={styles.statLabel}>Total Resi</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalQty}</span>
            <span className={styles.statLabel}>Total Ikan</span>
          </div>
        </div>
      </div>

      {/* Ekspedisi Kurir Breakdown */}
      {courierList.length > 0 && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Distribusi Kurir</span>
          </div>
          <div className={styles.courierChipsContainer}>
            {courierList.map(([name, count]) => {
              const badgeCls = getCourierBadgeClass(name);
              return (
                <span key={name} className={`${styles.courierBadge} ${badgeCls}`}>
                  {name} ({count})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Checklist / Quick Inspection Daftar Pesanan */}
      {orders.length > 1 && (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Daftar Pesanan ({totalOrders})</span>
            <span className={styles.sectionSubtitle}>Klik untuk sorot label</span>
          </div>
          <div className={styles.ordersListContainer}>
            {orders.map((o, idx) => {
              const itemCount = o.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0;
              const colorClass = styles[`colorTheme${idx % 6}`] || styles.colorTheme0;
              const courierClass = getCourierBadgeClass(o.shippingCourier);

              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleScrollToLabel(o.id)}
                  className={styles.orderListItem}
                  title={`Klik untuk melihat resi #${o.id.slice(0, 8)}`}
                >
                  <div className={styles.orderItemLeft}>
                    <span className={`${styles.orderNumberPill} ${colorClass}`}>
                      #{idx + 1}
                    </span>
                    <div className={styles.orderItemDetails}>
                      <span className={styles.orderItemRecipient}>
                        {o.shippingName || o.name || 'Pelanggan'}
                      </span>
                      <span className={styles.orderItemId}>
                        #{o.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.labelHeaderRight}>
                    <span className={`${styles.courierBadge} ${courierClass}`}>
                      {o.shippingCourier || 'Kurir'}
                    </span>
                    <span className={styles.itemCountBadge}>
                      {itemCount} ekor
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Panduan Setting Thermal Printer */}
      <div className={styles.tipsBox}>
        <div className={styles.tipsHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>Panduan Cetak Thermal</span>
        </div>
        <ul className={styles.tipsList}>
          <li>Kertas: <strong>100 × 150 mm (4×6")</strong></li>
          <li>Margin Printer: <strong>None / Minimum</strong></li>
          <li>Skala / Scale: <strong>100% (Default)</strong></li>
        </ul>
      </div>
    </aside>
  );
}
