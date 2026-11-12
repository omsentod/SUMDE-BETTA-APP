'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './orders.module.css';

const DOT_TONE_CLASS = {
  pending: styles.dotPending,
  paid: styles.dotPaid,
  processing: styles.dotProcessing,
  shipped: styles.dotShipped,
  completed: styles.dotCompleted,
  cancelled: styles.dotCancelled,
  returned: styles.dotReturned,
  tiktok: styles.dotTiktok,
  telegram: styles.dotTelegram,
  web: styles.dotWeb,
};

export default function OrderSelect({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Pilih opsi',
  ariaLabel,
  disabled = false,
  fullWidth = false,
  isFiltered = false,
  leadingIcon = null,
  menuAlign = 'left',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;

  const selectedIndex = useMemo(
    () => options.findIndex((opt) => opt.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
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

  const openMenu = () => {
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      openMenu();
    }
  };

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
        return;
      }
      if (options.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setHighlightedIndex((prev) => {
        const start = prev >= 0 ? prev : 0;
        return (start + delta + options.length) % options.length;
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
        event.preventDefault();
        handleSelect(options[highlightedIndex].value);
      }
    } else if (event.key === 'Tab' && isOpen) {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.selectRoot} ${fullWidth ? styles.selectRootFull : ''}`}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={`${styles.selectTrigger} ${isOpen ? styles.selectTriggerOpen : ''} ${
          isFiltered ? styles.selectTriggerActive : ''
        } ${!selectedOption ? styles.selectTriggerPlaceholder : ''}`}
      >
        <span className={styles.selectTriggerContent}>
          {selectedOption?.dotTone && DOT_TONE_CLASS[selectedOption.dotTone] ? (
            <span
              className={`${styles.selectDot} ${DOT_TONE_CLASS[selectedOption.dotTone]}`}
              aria-hidden="true"
            />
          ) : (
            leadingIcon && (
              <span className={styles.selectLeadingIcon} aria-hidden="true">
                {leadingIcon}
              </span>
            )
          )}
          <span className={styles.selectTriggerText}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <svg
          className={`${styles.selectChevron} ${isOpen ? styles.selectChevronOpen : ''}`}
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
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`${styles.selectMenu} ${fullWidth ? styles.selectMenuFull : ''} ${
            menuAlign === 'right' ? styles.selectMenuAlignRight : ''
          }`}
        >
          <div className={styles.selectList}>
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                  className={`${styles.selectOption} ${
                    isSelected ? styles.selectOptionSelected : ''
                  } ${isHighlighted ? styles.selectOptionHighlighted : ''}`}
                >
                  <span className={styles.selectOptionLeft}>
                    {opt.dotTone && DOT_TONE_CLASS[opt.dotTone] && (
                      <span
                        className={`${styles.selectDot} ${DOT_TONE_CLASS[opt.dotTone]}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className={styles.selectOptionLabel}>{opt.label}</span>
                  </span>
                  {isSelected && (
                    <svg
                      className={styles.selectCheck}
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}
