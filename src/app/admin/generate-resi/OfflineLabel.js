'use client';

import Barcode128 from './Barcode128';
import styles from './offlineLabel.module.css';

function normalizeCourierCode(raw) {
  const c = String(raw || '').toLowerCase().trim();
  if (c.includes('j&t') || c.includes('jnt')) return 'jnt';
  if (c.includes('pos')) return 'pos';
  if (c.includes('jne')) return 'jne';
  if (c.includes('sicepat')) return 'sicepat';
  if (c.includes('anteraja')) return 'anteraja';
  if (c.includes('tiki')) return 'tiki';
  return 'other';
}

const COURIER_LOGOS = {
  jnt: '/courier/jnt.png',
  pos: '/courier/pos.png',
  jne: '/courier/jne.png',
  sicepat: '/courier/sicepat.png',
  anteraja: '/courier/anteraja.webp',
  tiki: '/courier/tiki.webp',
};

export default function OfflineLabel({ item }) {
  if (!item) return null;

  const refId = (item.id || item.referenceNumber || 'REF-OFFLINE').trim();
  const courierKey = normalizeCourierCode(item.courier);
  const courierLabel = (item.courier || 'J&T Express').toUpperCase();
  const courierLogoSrc = COURIER_LOGOS[courierKey] || null;

  return (
    <div className={styles.label}>
      {/* 1. Header: Headline SUMDE BETTA (Kiri) & Logo Kurir Polos Tanpa Border/Shadow/Background (Kanan) */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo.png"
              alt="SUMDE BETTA"
              className={styles.brandLogoImg}
            />
            <div className={styles.brandTextWrap}>
              <div className={styles.brandTitle}>
                <span>SUMDE</span> <span className={styles.brandAccent}>BETTA</span>
              </div>
              <div className={styles.brandSubtitle}>TULUNGAGUNG, JAWA TIMUR</div>
              <div className={styles.labelTagline}>LABEL PENGIRIMAN</div>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.courierBox}>
            {courierLogoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={courierLogoSrc}
                alt={courierLabel}
                className={styles.courierBareImg}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) {
                    e.target.nextSibling.style.display = 'block';
                  }
                }}
              />
            ) : null}
            <div
              className={styles.courierBareText}
              style={{ display: courierLogoSrc ? 'none' : 'block' }}
            >
              {courierLabel}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barcode Utama: Reference ID */}
      <div className={styles.barcodeRow}>
        <div className={styles.barcodeWrap}>
          <Barcode128 text={refId} height={52} className={styles.barcodeImg} />
        </div>
        <div className={styles.referenceIdText}>
          REFERENCE ID: {refId}
        </div>
      </div>

      {/* 3. Baris Layanan & Dokumen */}
      <div className={styles.infoBar}>
        <div>KURIR: {courierLabel}</div>
        <div>LAYANAN: REGULER</div>
        <div>STATUS: LUNAS (NON-COD)</div>
        <div>ASURANSI: NON-ASURANSI</div>
      </div>

      {/* 4. Detail Alamat: Penerima (Dominan & Lega) vs Pengirim */}
      <div className={styles.addressGrid}>
        <div className={styles.addressLeft}>
          <div className={styles.addressBadge}>PENERIMA</div>
          <div className={styles.recipientName}>{item.name || 'Nama Pelanggan'}</div>
          <div className={styles.recipientPhone}>Telp: {item.phone || '-'}</div>
          <div className={styles.recipientAddress}>
            {item.address || 'Alamat lengkap belum diisi'}
          </div>
        </div>

        <div className={styles.addressRight}>
          <div className={styles.senderBadge}>PENGIRIM</div>
          <div className={styles.senderName}>SUMDE BETTA</div>
          <div className={styles.senderPhone}>Telp: 081234567890</div>
          <div className={styles.senderAddress}>
            Markas Sumde Betta, Kab. Tulungagung, Jawa Timur, 66218
          </div>
        </div>
      </div>

      {/* 5. Catatan Penanganan Khusus & Ketentuan Garansi D.O.A */}
      <div className={styles.handlingSection}>
        <div className={styles.handleRow}>
          <span className={styles.handleBadge}>⚠️ HANDLE WITH CARE</span>
          <span className={styles.handleText}>
            [IKAN HIAS HIDUP] Jangan dibanting, hindari terik matahari langsung, & jangan ditindih benda berat!
          </span>
        </div>
        <div className={styles.doaRow}>
          <span className={styles.doaBadge}>🛡️ GARANSI 100% D.O.A (DEATH ON ARRIVAL)</span>
          <span className={styles.doaText}>
            Klaim garansi wajib sertakan video unboxing utuh tanpa jeda/cut sejak paket tersegel dibuka pertama kali.
          </span>
        </div>
      </div>

      {/* 6. Footer Thermal */}
      <div className={styles.footerBox}>
        <div className={styles.footerMain}>SUMDE BETTA • FARM & CURATORIAL STUDIO</div>
        <div className={styles.footerSub}>Dokumen Pengiriman Resmi • sumdebetta.com</div>
      </div>
    </div>
  );
}
