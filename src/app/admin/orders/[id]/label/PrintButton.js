'use client';

import styles from './label.module.css';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className={styles.printButton}>
      Cetak Resi
    </button>
  );
}
