'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './manifest.module.css';

export default function PrintControls({ count, totalItems, autoPrint, stageLabel = 'Pesanan' }) {
  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className={styles.noPrintBar}>
      <div className={styles.barContainer}>
        <div className={styles.barLeft}>
          <Link href="/admin/packing" className={styles.backBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Kembali ke Meja Packing</span>
          </Link>
          <div className={styles.barStats}>
            <span className={styles.statsBadge}>{count} {stageLabel}</span>
            <span className={styles.statsSeparator}>•</span>
            <span className={styles.statsText}>
              {totalItems} Total {stageLabel === 'Baris Bungkus' ? 'Ekor Ikan' : 'Produk'}
            </span>
          </div>
        </div>

        <div className={styles.barRight}>
          <button
            type="button"
            onClick={() => window.print()}
            className={styles.printActionBtn}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
