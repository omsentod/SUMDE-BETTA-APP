'use client';

import { useState } from 'react';
import styles from './CourierLogo.module.css';

// Normalize freeform courier codes to standard keys
const ALIAS = {
  'jnt': 'jnt',
  'j&t': 'jnt',
  'jne': 'jne',
  'sicepat': 'sicepat',
  'si cepat': 'sicepat',
  'anteraja': 'anteraja',
  'tiki': 'tiki',
  'gojek': 'gojek',
  'gosend': 'gojek',
  'grab': 'grab',
  'grabexpress': 'grab',
  'pos': 'pos',
};

// Couriers with image logos in /public/courier/
const COURIER_FILE_MAP = {
  jnt: '/courier/jnt.png',
  pos: '/courier/pos.png',
  jne: '/courier/jne.png',
  sicepat: '/courier/sicepat.png',
  anteraja: '/courier/anteraja.webp',
  tiki: '/courier/tiki.webp',
};

// Display label per courier (falls back to the code itself)
const LABEL = {
  jnt: 'J&T',
  jne: 'JNE',
  sicepat: 'SICEPAT',
  anteraja: 'ANTERAJA',
  tiki: 'TIKI',
  gojek: 'GOJEK',
  grab: 'GRAB',
  pos: 'POS',
};

export default function CourierLogo({ code, size = 'md' }) {
  const [failedKeys, setFailedKeys] = useState(() => new Set());
  const key = ALIAS[(code || '').toLowerCase().trim()] || null;
  const label = key ? LABEL[key] : (code || 'KURIR').toUpperCase();
  const sizeClass = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : '';
  const hasError = key ? failedKeys.has(key) : false;
  const imgSrc = key ? COURIER_FILE_MAP[key] : null;

  // Render official logo from /public/courier/ if available
  if (imgSrc && !hasError) {
    return (
      <span className={`${styles.logoWrapper} ${sizeClass}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={label}
          className={styles.logoImg}
          onError={() => {
            setFailedKeys((prev) => new Set(prev).add(key));
          }}
        />
      </span>
    );
  }

  // Fallback to stylized brand badge
  const colorClass = key ? styles[key] : styles.default;
  return (
    <span className={`${styles.badge} ${colorClass} ${sizeClass}`.trim()}>
      {label}
    </span>
  );
}
