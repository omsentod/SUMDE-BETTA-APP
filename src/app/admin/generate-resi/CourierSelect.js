'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './courierSelect.module.css';

export const COURIER_OPTIONS = [
  {
    value: 'J&T Express',
    label: 'J&T Express',
    logo: '/courier/jnt.png',
  },
  {
    value: 'POS Indonesia',
    label: 'POS Indonesia',
    logo: '/courier/pos.png',
  },
  {
    value: 'SiCepat',
    label: 'SiCepat',
    logo: '/courier/sicepat.png',
  },
  {
    value: 'JNE Express',
    label: 'JNE Express',
    logo: '/courier/jne.png',
  },
  {
    value: 'AnterAja',
    label: 'AnterAja',
    logo: '/courier/anteraja.webp',
  },
  {
    value: 'TIKI',
    label: 'TIKI',
    logo: '/courier/tiki.webp',
  },
  {
    value: 'Kurir Toko / Travel',
    label: 'Kurir Toko / Travel / Bus',
    icon: 'travel',
  },
  {
    value: 'Lainnya',
    label: 'Lainnya / Manual',
    icon: 'other',
  },
];

/**
 * Normalisasi pencarian opsi kurir
 */
export function getCourierOption(raw) {
  const text = String(raw || '').trim();
  const lower = text.toLowerCase();

  const exact = COURIER_OPTIONS.find(
    (opt) => opt.value.toLowerCase() === lower || opt.label.toLowerCase() === lower
  );
  if (exact) return exact;

  if (lower.includes('j&t') || lower.includes('jnt')) return COURIER_OPTIONS[0];
  if (lower.includes('pos')) return COURIER_OPTIONS[1];
  if (lower.includes('sicepat')) return COURIER_OPTIONS[2];
  if (lower.includes('jne')) return COURIER_OPTIONS[3];
  if (lower.includes('anteraja')) return COURIER_OPTIONS[4];
  if (lower.includes('tiki')) return COURIER_OPTIONS[5];
  if (lower.includes('travel') || lower.includes('toko') || lower.includes('bus')) {
    return COURIER_OPTIONS[6];
  }

  return {
    value: text || 'Lainnya',
    label: text || 'Lainnya / Manual',
    icon: 'other',
  };
}

/**
 * Thumbnail logo kurir atau ikon netral
 */
export function CourierThumbnail({ option, size = 'md' }) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(option?.logo) && !imgError;
  const sizeClass = size === 'sm' ? styles.sm : '';

  if (showImage) {
    return (
      <span className={`${styles.logoThumb} ${sizeClass}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={option.logo}
          alt={option.label || 'Logo'}
          className={styles.logoImg}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  if (option?.icon === 'travel') {
    return (
      <span className={`${styles.iconThumb} ${sizeClass}`.trim()} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${styles.iconThumb} ${sizeClass}`.trim()} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    </span>
  );
}

/**
 * Custom Dropdown Ekspedisi Kurir
 */
export default function CourierSelect({
  id = 'field-courier',
  value,
  onChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const listboxId = useId();

  const selectedOption = useMemo(() => getCourierOption(value), [value]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
      >
        <div className={styles.triggerContent}>
          <CourierThumbnail option={selectedOption} size="md" />
          <span className={styles.triggerLabel}>{selectedOption.label}</span>
        </div>

        <svg
          className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ''}`}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id={listboxId}
          role="listbox"
          aria-label="Pilih Ekspedisi Kurir"
          className={styles.popover}
        >
          {COURIER_OPTIONS.map((opt) => {
            const isSelected = selectedOption.value === opt.value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ''}`}
              >
                <div className={styles.optionContent}>
                  <CourierThumbnail option={opt} size="md" />
                  <span className={styles.optionLabel}>{opt.label}</span>
                </div>

                {isSelected && (
                  <svg
                    className={styles.checkIcon}
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
