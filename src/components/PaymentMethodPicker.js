'use client';

import React, { useState, useMemo, useEffect } from 'react';
import PaymentLogo from './PaymentLogo';
import {
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  getSelectableMethods,
} from '@/lib/paymentFee';
import styles from './PaymentMethodPicker.module.css';

const CATEGORY_SUBTITLES = {
  QRIS: 'GoPay, OVO, DANA, BCA, Mandiri, & Seluruh M-Banking',
  VA: '13 Bank (BCA, Mandiri, BRI, BNI, Permata, BSI, dll)',
  'E-Wallet': 'Pembayaran Instan via Saldo DOKU',
  Paylater: 'Bayar Nanti dengan Cicilan Ringan',
  Retail: 'Bayar Tunai di Kasir Alfamart / Indomaret',
};

export default function PaymentMethodPicker({ value, onChange }) {
  // Accordion state: default null (all dropdowns closed by default)
  const [openCategory, setOpenCategory] = useState(null);

  // Fetch available channels from server (includes runtime auto-detection).
  // Falls back to hardcoded list if API is unavailable.
  const [selectable, setSelectable] = useState(() => getSelectableMethods());

  useEffect(() => {
    let cancelled = false;
    async function fetchChannels() {
      try {
        const res = await fetch('/api/payment/channels');
        if (!res.ok) return; // keep hardcoded fallback
        const data = await res.json();
        if (!cancelled && Array.isArray(data.methods) && data.methods.length > 0) {
          setSelectable(data.methods);
        }
      } catch {
        // Network error — keep hardcoded fallback silently
      }
    }
    fetchChannels();
    return () => { cancelled = true; };
  }, []);

  // If the currently selected method became inactive/hidden, reset selection
  useEffect(() => {
    if (value && selectable.length > 0 && !selectable.some((m) => m.key === value)) {
      onChange?.(null);
    }
  }, [selectable, value, onChange]);

  // Auto-select when only 1 method is available or if value is not set yet
  useEffect(() => {
    if (!value && selectable.length > 0) {
      onChange?.(selectable[0].key);
    }
  }, [selectable, value, onChange]);

  // Group methods by category
  const grouped = useMemo(() => {
    const out = {};
    for (const cat of CATEGORY_ORDER) out[cat] = [];
    for (const m of selectable) {
      if (!out[m.category]) out[m.category] = [];
      out[m.category].push(m);
    }
    return out;
  }, [selectable]);

  const toggleCategory = (cat) => {
    setOpenCategory((prev) => (prev === cat ? null : cat));
  };

  // Render category icon SVG
  const renderCategoryIcon = (cat) => {
    switch (cat) {
      case 'VA':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
          </svg>
        );
      case 'E-Wallet':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 10h20" />
          </svg>
        );
      case 'Paylater':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
        );
      case 'Retail':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        );
    }
  };

  // Semua channel mati di merchant account — jangan render picker kosong yang
  // menyesatkan; beri tahu user supaya menghubungi admin.
  if (selectable.length === 0) {
    return (
      <div className={styles.pickerContainer}>
        <p className={styles.emptyChannels}>
          Belum ada metode pembayaran yang aktif. Silakan hubungi admin untuk mengaktifkan channel pembayaran.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.pickerContainer}>
      {CATEGORY_ORDER.map((cat) => {
        const allItems = grouped[cat] || [];
        if (allItems.length === 0) return null;

        const isMulti = allItems.length > 1;
        const isOpen = openCategory === cat;
        const selectedMethod = allItems.find((m) => m.key === value);

        // Single Option Category (e.g. QRIS, E-Wallet, Paylater)
        if (!isMulti) {
          const singleItem = allItems[0];
          const isSelected = value === singleItem.key;

          return (
            <div
              key={cat}
              className={`${styles.categoryCard} ${styles.singleCard} ${isSelected ? styles.singleCardSelected : ''}`}
              onClick={() => onChange(singleItem.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(singleItem.key);
                }
              }}
            >
              <div className={styles.categoryHeader}>
                <div className={styles.categoryLeft}>
                  <div className={`${styles.radioCircle} ${isSelected ? styles.radioCircleActive : ''}`}>
                    <div className={styles.radioDot} />
                  </div>

                  <PaymentLogo methodKey={singleItem.key} size="md" />

                  <div className={styles.categoryTitleBlock}>
                    <h4 className={styles.categoryTitle}>{singleItem.label}</h4>
                    <p className={styles.categorySubtitle}>{CATEGORY_SUBTITLES[cat] || singleItem.label}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // Multi-Option Accordion (Virtual Account, Retail)
        return (
          <div
            key={cat}
            className={`${styles.categoryCard} ${selectedMethod ? styles.categoryCardActive : ''}`}
          >
            {/* Clickable Accordion Header */}
            <button
              type="button"
              className={styles.categoryHeader}
              onClick={() => toggleCategory(cat)}
              aria-expanded={isOpen}
            >
              <div className={styles.categoryLeft}>
                <div className={styles.categoryIconWrap}>
                  {renderCategoryIcon(cat)}
                </div>

                <div className={styles.categoryTitleBlock}>
                  <h4 className={styles.categoryTitle}>{CATEGORY_LABEL[cat] || cat}</h4>
                  <p className={styles.categorySubtitle}>
                    {selectedMethod ? (
                      <span className={styles.selectedBadgeText}>Terpilih: {selectedMethod.label}</span>
                    ) : (
                      CATEGORY_SUBTITLES[cat] || `${allItems.length} Opsi Tersedia`
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.categoryRight}>
                {/* Mini preview logos when closed */}
                {!isOpen && (
                  <div className={styles.previewLogos}>
                    {allItems.slice(0, 4).map((m) => (
                      <PaymentLogo key={m.key} methodKey={m.key} size="sm" />
                    ))}
                    {allItems.length > 4 && (
                      <span className={styles.previewMore}>+{allItems.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Chevron icon */}
                <svg
                  className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {/* Collapsible Accordion Body */}
            <div className={`${styles.accordionBody} ${isOpen ? styles.accordionBodyOpen : ''}`}>
              <div className={styles.optionsGrid}>
                {allItems.map((m) => {
                  const isSelected = value === m.key;

                  return (
                    <div
                      key={m.key}
                      className={`${styles.optionItem} ${isSelected ? styles.optionItemSelected : ''}`}
                      onClick={() => onChange(m.key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onChange(m.key);
                        }
                      }}
                    >
                      <div className={`${styles.radioCircle} ${isSelected ? styles.radioCircleActive : ''}`}>
                        <div className={styles.radioDot} />
                      </div>

                      <PaymentLogo methodKey={m.key} size="md" />

                      <div className={styles.optionDetails}>
                        <span className={styles.optionName}>{m.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
