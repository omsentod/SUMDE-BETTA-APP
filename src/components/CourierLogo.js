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
  'gojek': 'gojek',
  'gosend': 'gojek',
  'grab': 'grab',
  'grabexpress': 'grab',
  'pos': 'pos',
};

// Couriers with image logos in /public/courier/
const IMAGE_COURIERS = new Set(['jnt', 'pos']);

// Display label per courier (falls back to the code itself)
const LABEL = {
  jnt: 'J&T',
  jne: 'JNE',
  sicepat: 'SICEPAT',
  anteraja: 'ANTERAJA',
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

  // Render official PNG logo from /public/courier/ if available
  if (key && IMAGE_COURIERS.has(key) && !hasError) {
    return (
      <span className={`${styles.logoWrapper} ${sizeClass}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/courier/${key}.png`}
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
