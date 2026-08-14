'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import styles from './MobileBottomNav.module.css';

const POLL_MS = 30_000;

// Icon set — stroke SVG, ikut currentColor supaya bisa aktif/warna primary saat active.
const IconHome = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>
);
const IconFish = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 12c0-3 3-6 8-6 3 0 5 1.5 6 3-1 1.5-3 3-6 3-5 0-8-3-8-6z" transform="translate(0 3)"/><path d="M6.5 15c-1.5.5-3 1.5-4 3 1.5 0 2.5-.5 4-1"/><circle cx="17" cy="14" r="0.6" fill="currentColor"/></svg>
);
const IconCart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const IconBell = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const IconUser = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconLogin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
);

function Badge({ count }) {
  if (!count || count <= 0) return null;
  return <span className={styles.badge}>{count > 99 ? '99+' : count}</span>;
}

export default function MobileBottomNav() {
  const pathname = usePathname() || '';
  const { itemCount, toggleCart } = useCart();
  const { currentUser } = useAuth();

  const [unread, setUnread] = useState(0);

  // Self-hide di halaman detail produk — page tsb pakai sticky action bar sendiri.
  // Return null diletakkan setelah semua hook supaya urutan hook stabil.
  const isProductDetail = pathname.startsWith('/produk/') && pathname !== '/produk';

  // Fetch unread count untuk badge — reuse endpoint yang dipakai NotificationBell
  useEffect(() => {
    if (!currentUser) { setUnread(0); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unreadCount || 0);
      } catch { /* silent */ }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [currentUser?.id]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const accountHref = currentUser
    ? (currentUser.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard')
    : '/login';
  const accountLabel = currentUser ? 'Akun' : 'Masuk';
  const AccountIcon = currentUser ? IconUser : IconLogin;

  if (isProductDetail) return null;

  return (
    <nav className={styles.bar} aria-label="Navigasi utama mobile">
      <Link
        href="/"
        className={`${styles.item} ${isActive('/') ? styles.active : ''}`.trim()}
      >
        <IconHome />
        <span className={styles.label}>Beranda</span>
      </Link>

      <Link
        href="/produk"
        className={`${styles.item} ${isActive('/produk') ? styles.active : ''}`.trim()}
      >
        <IconFish />
        <span className={styles.label}>Produk</span>
      </Link>

      <button
        type="button"
        onClick={toggleCart}
        className={styles.item}
        aria-label={`Keranjang${itemCount > 0 ? ` (${itemCount} item)` : ''}`}
      >
        <span className={styles.iconWrap}>
          <IconCart />
          <Badge count={itemCount} />
        </span>
        <span className={styles.label}>Keranjang</span>
      </button>

      {/* Notif slot — hanya kalau logged in */}
      {currentUser && (
        <Link
          href="/customer/notifications"
          className={`${styles.item} ${isActive('/customer/notifications') ? styles.active : ''}`.trim()}
        >
          <span className={styles.iconWrap}>
            <IconBell />
            <Badge count={unread} />
          </span>
          <span className={styles.label}>Notif</span>
        </Link>
      )}

      <Link
        href={accountHref}
        className={`${styles.item} ${isActive(accountHref) ? styles.active : ''}`.trim()}
      >
        <AccountIcon />
        <span className={styles.label}>{accountLabel}</span>
      </Link>
    </nav>
  );
}
