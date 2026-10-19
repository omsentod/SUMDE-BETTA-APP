'use client';

import styles from './ToggleSwitch.module.css';

/**
 * Filament-Style Tactile Toggle Switch (Saklar ON/OFF)
 * 
 * @param {boolean} checked - Status aktif/non-aktif
 * @param {Function} onChange - Callback ketika status berubah
 * @param {boolean} [disabled=false] - Nonaktifkan interaksi
 * @param {'sm'|'md'} [size='md'] - Ukuran toggle switch
 * @param {string} [label] - Label teks opsional di samping switch
 * @param {string} [ariaLabel] - Deskripsi aksesibilitas
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  label,
  ariaLabel,
  className = '',
}) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled || !onChange) return;
    onChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (disabled || !onChange) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }
  };

  return (
    <div
      className={`${styles.switchWrapper} ${size === 'sm' ? styles.switchSm : ''} ${
        disabled ? styles.switchDisabled : ''
      } ${className}`.trim()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      tabIndex={disabled ? -1 : 0}
    >
      <div className={`${styles.switchTrack} ${checked ? styles.switchTrackActive : ''}`}>
        <div className={`${styles.switchThumb} ${checked ? styles.switchThumbActive : ''}`} />
      </div>
      {label && <span className={styles.switchLabel}>{label}</span>}
    </div>
  );
}
