'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './tiktokLive.module.css';

export default function LiveSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih opsi...',
  searchable = false,
  searchPlaceholder = 'Cari...',
  disabled = false,
  size = 'md',
  ariaLabel,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const inLabel = String(opt.label || '').toLowerCase().includes(q);
      const inSub = String(opt.sublabel || '').toLowerCase().includes(q);
      return inLabel || inSub;
    });
  }, [options, search]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) setSearch('');
      return next;
    });
  };

  const handlePick = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={rootRef} className={styles.customSelectRoot}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={handleToggle}
        className={`${styles.customSelectTrigger} ${
          size === 'sm' ? styles.customSelectTriggerSm : ''
        } ${isOpen ? styles.customSelectTriggerOpen : ''} ${
          !selectedOption ? styles.customSelectPlaceholder : ''
        }`}
      >
        <span className={styles.customSelectValue}>
          <span className={styles.customSelectValueMain}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.sublabel && (
            <span className={styles.customSelectValueSub}>{selectedOption.sublabel}</span>
          )}
        </span>
        <svg
          className={`${styles.customSelectChevron} ${isOpen ? styles.customSelectChevronOpen : ''}`}
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
        <div className={styles.customSelectMenu} role="listbox">
          {searchable && (
            <div className={styles.customSelectSearchWrap}>
              <svg
                className={styles.customSelectSearchIcon}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                autoFocus
                className={styles.customSelectSearchInput}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          <div className={styles.customSelectList}>
            {filteredOptions.length === 0 ? (
              <div className={styles.customSelectEmpty}>Tidak ada pilihan cocok</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.customSelectOption} ${
                      isSelected ? styles.customSelectOptionActive : ''
                    }`}
                    onClick={() => handlePick(opt.value)}
                  >
                    <span className={styles.customSelectOptionText}>
                      <span className={styles.customSelectOptionLabel}>{opt.label}</span>
                      {opt.sublabel && (
                        <span className={styles.customSelectOptionSub}>{opt.sublabel}</span>
                      )}
                    </span>
                    {isSelected && (
                      <svg
                        className={styles.customSelectCheck}
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
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
