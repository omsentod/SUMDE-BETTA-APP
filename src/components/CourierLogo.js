import styles from './CourierLogo.module.css';

// Normalize freeform courier codes to the CSS class keys.
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

// Display label per courier (falls back to the code itself).
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
  const key = ALIAS[(code || '').toLowerCase().trim()] || null;
  const sizeClass = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : '';
  const colorClass = key ? styles[key] : styles.default;
  return (
    <span className={`${styles.badge} ${colorClass} ${sizeClass}`.trim()}>
      {key ? LABEL[key] : (code || 'KURIR').toUpperCase()}
    </span>
  );
}
