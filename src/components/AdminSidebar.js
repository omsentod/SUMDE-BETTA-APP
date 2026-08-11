'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import styles from './AdminSidebar.module.css';

const REFRESH_MS = 30_000;

// Ikon SVG stroke — sederhana, tanpa dep icon library.
const Icon = ({ path, extra }) => (
  <svg className={styles.linkIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
    {extra}
  </svg>
);

const iconDashboard = <Icon path={<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>} />;
const iconOrders = <Icon path={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>} />;
const iconProducts = <Icon path={<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>} />;
const iconUsers = <Icon path={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />;
const iconEvents = <Icon path={<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>} />;
const iconReports = <Icon path={<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>} />;
const iconMenu = <Icon path={<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>} />;
const iconClose = <Icon path={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />;

// Badge: merah kalau count > 0, hilangkan kalau 0. Optional variant "muted".
function Badge({ count, muted }) {
  if (!count) return null;
  return (
    <span className={`${styles.badge} ${muted ? styles.badgeMuted : ''}`.trim()}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function AdminSidebarInner() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get('status');

  const [counts, setCounts] = useState({ pendingOrders: 0, needsPickup: 0, awaitingWaybill: 0, returned: 0 });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/admin/counts')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data && !cancelled) setCounts(data); })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Tutup drawer setiap navigate di mobile.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close drawer on nav
    setOpen(false);
  }, [pathname, searchParams]);

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');
  const isOrdersStatus = (status) => pathname.startsWith('/admin/orders') && activeStatus === status;
  const isOrdersAll = () => pathname.startsWith('/admin/orders') && !activeStatus;

  const orderStatusItems = [
    { label: 'Semua', href: '/admin/orders', active: isOrdersAll() },
    { label: 'Pesanan Baru', href: '/admin/orders?status=PENDING', active: isOrdersStatus('PENDING'), badge: counts.pendingOrders },
    { label: 'Diproses', href: '/admin/orders?status=PROCESSING', active: isOrdersStatus('PROCESSING'), badge: counts.needsPickup },
    { label: 'Dikirim', href: '/admin/orders?status=SHIPPED', active: isOrdersStatus('SHIPPED') },
    { label: 'Selesai', href: '/admin/orders?status=COMPLETED', active: isOrdersStatus('COMPLETED') },
    { label: 'Dibatalkan', href: '/admin/orders?status=CANCELLED', active: isOrdersStatus('CANCELLED') },
    { label: 'Retur', href: '/admin/orders?status=RETURNED', active: isOrdersStatus('RETURNED'), badge: counts.returned },
  ];

  return (
    <>
      <button className={styles.mobileToggle} onClick={() => setOpen(true)} aria-label="Buka menu">
        {iconMenu}
      </button>

      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`.trim()}>
        <button
          className={`${styles.link} ${styles.mobileToggle}`}
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
          style={{ justifyContent: 'flex-end' }}
        >
          {iconClose}
        </button>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Ringkasan</div>
          <Link href="/admin/dashboard" className={`${styles.link} ${isActive('/admin/dashboard') ? styles.linkActive : ''}`.trim()}>
            <span className={styles.linkContent}>{iconDashboard}<span className={styles.linkLabel}>Dashboard</span></span>
          </Link>
          <Link href="/admin/reports" className={`${styles.link} ${isActive('/admin/reports') ? styles.linkActive : ''}`.trim()}>
            <span className={styles.linkContent}>{iconReports}<span className={styles.linkLabel}>Laporan Penjualan</span></span>
          </Link>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Operasional</div>
          <Link href="/admin/orders" className={`${styles.link} ${isActive('/admin/orders') && !activeStatus ? styles.linkActive : ''}`.trim()}>
            <span className={styles.linkContent}>{iconOrders}<span className={styles.linkLabel}>Pesanan</span></span>
            {counts.awaitingWaybill > 0 && <Badge count={counts.awaitingWaybill} muted />}
          </Link>
          {orderStatusItems.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`${styles.link} ${styles.subLink} ${it.active ? styles.linkActive : ''}`.trim()}
            >
              <span className={styles.linkContent}>
                <span className={styles.linkLabel}>{it.label}</span>
              </span>
              <Badge count={it.badge} />
            </Link>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Master Data</div>
          <Link href="/admin/dashboard" className={styles.link}>
            <span className={styles.linkContent}>{iconProducts}<span className={styles.linkLabel}>Produk</span></span>
          </Link>
          <Link href="/admin/dashboard" className={styles.link}>
            <span className={styles.linkContent}>{iconUsers}<span className={styles.linkLabel}>User</span></span>
          </Link>
          <Link href="/admin/dashboard" className={styles.link}>
            <span className={styles.linkContent}>{iconEvents}<span className={styles.linkLabel}>Event</span></span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export default function AdminSidebar() {
  return (
    <Suspense fallback={null}>
      <AdminSidebarInner />
    </Suspense>
  );
}
