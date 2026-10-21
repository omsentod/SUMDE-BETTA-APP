import React from 'react';

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Kemarin';
  if (day < 7) return `${day} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function getNotificationImage(item = {}) {
  if (item?.imageUrl && typeof item.imageUrl === 'string') {
    return item.imageUrl;
  }
  const t = (item?.type || '').toLowerCase();
  if (t.includes('order') || t.includes('paid') || t.includes('ship') || t.includes('courier') || t.includes('deliver')) {
    return '/img/betta-1.png';
  }
  if (t.includes('promo') || t.includes('event')) {
    return '/img/betta-2.png';
  }
  return '/img/logo.png';
}

export function getNotificationMeta(type = '') {
  const t = (type || '').toLowerCase();

  // 1. Pembayaran
  if (t.includes('paid') || t.includes('payment')) {
    return {
      label: 'Pembayaran',
      variant: 'payment',
      badgeColor: '#10B981',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    };
  }

  // 2. Pengiriman
  if (t.includes('ship') || t.includes('picked') || t.includes('courier')) {
    return {
      label: 'Pengiriman',
      variant: 'shipping',
      badgeColor: '#0EA5E9',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      ),
    };
  }

  // 3. Selesai
  if (t.includes('complete') || t.includes('deliver')) {
    return {
      label: 'Pesanan Selesai',
      variant: 'completed',
      badgeColor: '#22C55E',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    };
  }

  // 4. Pembatalan / Retur
  if (t.includes('cancel') || t.includes('return') || t.includes('fail')) {
    return {
      label: 'Dibatalkan',
      variant: 'cancelled',
      badgeColor: '#EF4444',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
    };
  }

  // 5. Pesanan baru / dibuat
  if (t.includes('order')) {
    return {
      label: 'Pesanan',
      variant: 'order',
      badgeColor: '#F59E0B',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    };
  }

  // 6. Promo
  if (t.includes('promo') || t.includes('event')) {
    return {
      label: 'Promo Toko',
      variant: 'promo',
      badgeColor: '#EC4899',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    };
  }

  // Default: Info / Akun
  return {
    label: 'Info',
    variant: 'info',
    badgeColor: 'var(--primary)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };
}
