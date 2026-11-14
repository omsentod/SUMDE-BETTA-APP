'use client';

import styles from './AdminCheckbox.module.css';

export default function AdminCheckbox({
  checked = false,
  onChange,
  ariaLabel,
  id,
  disabled = false,
  className = '',
  title,
}) {
  return (
    <label
      className={`${styles.checkboxWrapper} ${disabled ? styles.disabled : ''} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      title={title}
    >
      <input
        type="checkbox"
        id={id}
        checked={!!checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.checkboxInput}
        aria-label={ariaLabel}
      />
      <span className={styles.customCheckbox} aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </label>
  );
}
