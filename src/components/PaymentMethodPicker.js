'use client';

import React, { useState, useMemo } from 'react';
import PaymentLogo from './PaymentLogo';
import {
  PAYMENT_METHODS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  calcPaymentFee,
  getSelectableMethods,
} from '@/lib/paymentFee';
import styles from './PaymentMethodPicker.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

function formatFeeHint(method, methodKey, base) {
  if (method.fee.flat != null) {
    return method.fee.flat === 0 ? 'Gratis Biaya Admin' : `Biaya ${formatIDR(method.fee.flat)}`;
  }
  if (method.fee.percent != null) {
    const percent = (method.fee.percent * 100).toFixed(method.fee.percent < 0.01 ? 2 : 1);
    if (base > 0) {
      const calcFee = calcPaymentFee(methodKey, base);
      return `Biaya ${percent}% (${formatIDR(calcFee)})`;
    }
    return `Biaya ${percent}%`;
  }
  return 'Gratis Biaya Admin';
}

const CATEGORY_SUBTITLES = {
  QRIS: 'GoPay, OVO, DANA, BCA, Mandiri, & Seluruh M-Banking',
  VA: '13 Bank (BCA, Mandiri, BRI, BNI, Permata, BSI, dll)',
  'E-Wallet': 'Pembayaran Instan via Saldo DOKU',
  Paylater: 'Bayar Nanti dengan Cicilan Ringan',
  Retail: 'Bayar Tunai di Kasir Alfamart / Indomaret',
};

export default function PaymentMethodPicker({ value, onChange, base = 0 }) {
  // Accordion state: default null (all dropdowns closed by default)
  const [openCategory, setOpenCategory] = useState(null);

  // Channel yang benar-benar hidup di merchant account. Channel `inactive`
  // sengaja tidak ditawarkan — DOKU akan menolaknya dengan
  // "PAYMENT CHANNEL IS INACTIVE" saat user menekan bayar.
  const selectable = useMemo(() => getSelectableMethods(), []);

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

  // Compute fees for all selectable methods to find the dynamically cheapest
  const { cheapestMethodKey, minFee } = useMemo(() => {
    let min = Infinity;
    let cheapestKey = selectable[0]?.key ?? null;

    for (const { key } of selectable) {
      try {
        const fee = calcPaymentFee(key, base);
        if (fee < min) {
          min = fee;
          cheapestKey = key;
        }
      } catch {
        // fallback
      }
    }

    return { cheapestMethodKey: cheapestKey, minFee: min };
  }, [base, selectable]);

  const toggleCategory = (cat) => {
    setOpenCategory((prev) => (prev === cat ? null : cat));
  };

  const recommendedMethod = PAYMENT_METHODS[cheapestMethodKey] || selectable[0];
  const isRecommendedSelected = value === cheapestMethodKey;

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
  if (!recommendedMethod) {
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

      {/* ================= 1. FEATURED RECOMMENDATION COVER CARD ================= */}
      <div className={styles.recommendedWrapper}>
        <h4 className={styles.sectionLabel}>Metode Direkomendasikan</h4>

        <div
          className={`${styles.recommendedCoverCard} ${isRecommendedSelected ? styles.recommendedCoverCardSelected : ''}`}
          onClick={() => onChange(cheapestMethodKey)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(cheapestMethodKey);
            }
          }}
        >
          {/* Top Banner Ribbon */}
          <div className={styles.coverRibbon}>
            <div className={styles.coverRibbonLeft}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Rekomendasi • Biaya Paling Hemat</span>
            </div>
            <span className={styles.coverRibbonNote}>Proses Otomatis</span>
          </div>

          {/* Card Body */}
          <div className={styles.coverBody}>
            <div className={styles.coverLeft}>
              <div className={`${styles.radioCircle} ${isRecommendedSelected ? styles.radioCircleActive : ''}`}>
                <div className={styles.radioDot} />
              </div>

              <PaymentLogo methodKey={cheapestMethodKey} size="md" />

              <div className={styles.coverTitleBlock}>
                <h4 className={styles.coverTitle}>{recommendedMethod.label}</h4>
                <p className={styles.coverSubtitle}>
                  {CATEGORY_SUBTITLES[recommendedMethod.category] || 'Pilihan utama pembeli'}
                </p>
              </div>
            </div>

            <div className={styles.coverRight}>
              <span className={styles.coverFee}>
                {minFee === 0 ? 'Gratis Biaya Admin' : formatIDR(minFee)}
              </span>
              <span className={styles.coverFeeSub}>Biaya Terendah</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 2. OTHER PAYMENT METHODS ================= */}
      <div className={styles.otherMethodsGroup}>
        <h4 className={styles.sectionLabel}>Metode Pembayaran Lainnya</h4>

        {CATEGORY_ORDER.map((cat) => {
          // If this category only had the recommended item (e.g. QRIS), skip duplicating it
          const allItems = grouped[cat] || [];
          if (allItems.length === 0) return null;

          // If the single item in this category is already the top recommendation, skip
          if (allItems.length === 1 && allItems[0].key === cheapestMethodKey) {
            return null;
          }

          const isMulti = allItems.length > 1;
          const isOpen = openCategory === cat;
          const selectedMethod = allItems.find((m) => m.key === value);

          // Single Option Category (e.g. E-Wallet, Paylater)
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

                  <div className={styles.categoryRight}>
                    <span className={styles.optionFee}>
                      {formatFeeHint(singleItem, singleItem.key, base)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // Multi-Option Accordion (Virtual Account 13 Banks, Retail 2 Gerai)
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
                          <span className={styles.optionFee}>{formatFeeHint(m, m.key, base)}</span>
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
    </div>
  );
}
