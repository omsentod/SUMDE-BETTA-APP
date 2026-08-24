import React from 'react';
import styles from './PaymentLogo.module.css';

// Map payment method keys to downloaded assets in /img/payment
const PAYMENT_LOGO_MAP = {
  QRIS: '/img/payment/qris.png',
  VA_BCA: '/img/payment/bca.png',
  VA_BNI: '/img/payment/bni.png',
  VA_BRI: '/img/payment/bri.png',
  VA_MANDIRI: '/img/payment/mandiri.png',
  VA_BSI: '/img/payment/bsi.png',
  VA_PERMATA: '/img/payment/permata.png',
  VA_CIMB: '/img/payment/cimb-niaga.png',
  VA_DANAMON: '/img/payment/danamon.svg',
  VA_MAYBANK: '/img/payment/maybank.png',
  VA_BTN: '/img/payment/btn.png',
  VA_BJB: '/img/payment/bjb.png',
  VA_SINARMAS: '/img/payment/sinarmas.png',
  VA_DOKU: '/img/payment/doku.png',
  EWALLET_DOKU: '/img/payment/doku.png',
  PAYLATER_AKULAKU: '/img/payment/akulaku.png',
  RETAIL_ALFA: '/img/payment/alfamart.png',
  RETAIL_INDOMARET: '/img/payment/indomaret.png',
};

/**
 * Standardized Payment Logo component using official assets from /img/payment
 */
export default function PaymentLogo({ methodKey, size = 'md', className = '' }) {
  const logoSrc = PAYMENT_LOGO_MAP[methodKey];
  const sizeClass = size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd;

  if (!logoSrc) {
    return (
      <span className={`${styles.logoWrapper} ${sizeClass} ${className}`.trim()} aria-hidden="true">
        <span className={styles.fallbackBadge}>{methodKey?.replace(/_/g, ' ') || 'PAY'}</span>
      </span>
    );
  }

  return (
    <span className={`${styles.logoWrapper} ${sizeClass} ${className}`.trim()} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt={methodKey}
        className={styles.logoImg}
        loading="lazy"
      />
    </span>
  );
}
