'use client';

import CourierLogo from '@/components/CourierLogo';
import styles from './label.module.css';

// Isi 1 label (100mm x 150mm thermal) dengan layout rapi ala Biteship & branding SUMDE BETTA.
// Digunakan oleh:
// - /admin/orders/[id]/label/page.js — single label print
// - /admin/orders/labels-batch/page.js — multi label print (page-break per label)
export default function LabelContent({ order }) {
  const waybill = order.trackingNumber || null;
  const totalQty = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Perkiran berat paket (default 10 ekor ikan = 1 kg)
  const weightKg = Math.max(1, Math.ceil(totalQty / 10));
  const shippingCostFormatted = order.shippingCost
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(order.shippingCost)
    : 'Rp. 0';

  return (
    <div className={styles.label}>
      
      {/* 1. Header: Courier Logo (Left) vs Store Branding (Right) */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={`/img/courier/${(order.shippingCourier || 'default').toLowerCase()}.png`}
            alt={order.shippingCourier || 'Courier'}
            className={styles.courierImageLogo}
            onError={(e) => {
              e.target.style.display = 'none';
              if (e.target.nextSibling) {
                e.target.nextSibling.style.display = 'inline-block';
              }
            }}
          />
          {/* Fallback component jika logo tidak ada */}
          <div style={{ display: 'none' }}>
            <CourierLogo code={order.shippingCourier || ''} size="lg" />
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.brandLogoContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/img/logo.png" 
              alt="SUMDE BETTA" 
              className={styles.brandImageLogo} 
            />
            <div className={styles.brandSubtext}>SUMDE BETTA</div>
          </div>
        </div>
      </div>

      {/* 2. Main Barcode AWB */}
      <div className={styles.waybillRow}>
        {waybill ? (
          <div className={styles.barcodeWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(waybill)}&scale=2.5&height=18`}
              alt="Barcode Resi AWB"
              className={styles.barcodeImg}
            />
          </div>
        ) : (
          <div className={styles.pendingAwbBadge}>MENUNGGU NOMOR RESI (PENDING)</div>
        )}
        <div className={styles.waybillNumber}>
          {waybill ? `Nomor Resi - ${waybill}` : `Nomor Resi - PENDING`}
        </div>
      </div>

      {/* 3. Ongkir & Layanan Info Bar */}
      <div className={styles.infoBar}>
        <div>Ongkos Kirim: {shippingCostFormatted}</div>
        <div>Jenis Layanan - {(order.shippingService || 'Reguler')}</div>
      </div>

      {/* 4. Reference Barcode & Package Stats (2 Kolom) */}
      <div className={styles.refGrid}>
        <div className={styles.refLeft}>
          <div className={styles.refTitle}>Reference Number</div>
          <div className={styles.miniBarcodeWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(order.id.slice(0, 18))}&scale=2&height=10`}
              alt="Barcode Reference"
              className={styles.miniBarcodeImg}
            />
          </div>
          <div className={styles.refIdText}>{order.id}</div>
        </div>
        <div className={styles.refRight}>
          <div>Quantity: {totalQty} Pcs</div>
          <div>Weight: {weightKg} Kg</div>
          <div>Asuransi: Non-Asuransi</div>
        </div>
      </div>

      {/* 5. Address Grid (Penerima vs Pengirim) */}
      <div className={styles.addressGrid}>
        <div className={styles.addressLeft}>
          <div className={styles.addressTitle}>Alamat Penerima:</div>
          <div>{order.name}</div>
          <div>{order.phone}</div>
          <div>
            {order.streetAddress}{order.rtRw ? `, ${order.rtRw}` : ''}, Kel. {order.village}, Kec. {order.district}, {order.city}, {order.province}, {order.postalCode || ''}
          </div>
        </div>

        <div className={styles.addressRight}>
          <div className={styles.addressTitle}>Alamat Pengirim:</div>
          <div>SUMDE BETTA</div>
          <div>081234567890</div>
          <div>
            Markas Sumde Betta, Kab. Tulungagung, Jawa Timur, 66218
          </div>
        </div>
      </div>

      {/* 6. Item List Section (Jenis Barang) */}
      <div className={styles.itemsSection}>
        <div className={styles.itemsRow}>
          <div className={styles.itemsLabel}>Jenis Barang :</div>
          <div className={styles.itemsList}>
            {order.items?.map((item, idx) => (
              <div key={item.id || idx}>
                [{item.product?.sku || 'BETTA'}] {item.quantity}x {item.product?.name || 'Ikan Betta Hias'} {item.selectedSize ? `- Size ${item.selectedSize}` : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7. Handling Warning / Catatan */}
      <div className={styles.notesSection}>
        <div className={styles.notesRow}>
          <div className={styles.notesLabel}>Catatan :</div>
          <div className={styles.notesBody}>
            [IKAN HIAS HIDUP] Please handle with care. Fragile items inside. Jangan dibanting/ditindih benda berat!
          </div>
        </div>
      </div>

      {/* 8. Footer */}
      <div className={styles.footerBox}>
        <div>Pengiriman Resmi via SUMDE BETTA Logistics</div>
        <div>sumdebetta.com</div>
      </div>
    </div>
  );
}

