'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canUser } from '@/lib/permission-utils';
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
const iconTrash = (
  <Icon
    path={
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    }
  />
);
const iconMenu = <Icon path={<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>} />;
const iconClose = <Icon path={<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>} />;
const iconChevron = (
  <svg className={styles.chevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

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
  const { currentUser } = useAuth();

  const [counts, setCounts] = useState({ pendingOrders: 0, processing: 0, awaitingWaybill: 0, returned: 0, archivedProducts: 0 });
  const [open, setOpen] = useState(false);
  const isOnOrdersRoute = pathname.startsWith('/admin/orders');
  const [ordersOpen, setOrdersOpen] = useState(false);

  const can = (perm) => canUser(currentUser, perm);

  useEffect(() => {
    if (!currentUser) return;
    if (!can('orders:view') && !can('products:view')) return;
    let cancelled = false;
    let inFlight = false;
    let lastLoaded = Date.now();

    const load = (force = false) => {
      if (cancelled || inFlight) return;
      // Jangan bebani server / database jika tab sedang di latar belakang (background tab)
      if (!force && typeof document !== 'undefined' && document.hidden) return;

      inFlight = true;
      fetch('/api/admin/counts')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && !cancelled) {
            setCounts(data);
            lastLoaded = Date.now();
          }
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };

    load(true);
    const timer = setInterval(() => load(false), REFRESH_MS);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && Date.now() - lastLoaded >= REFRESH_MS) {
        load(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentUser]);

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
    // "NEW" pseudo-status di halaman /admin/orders di-map ke PENDING + PAID
    // (belum bayar + sudah bayar tapi belum panggil kurir).
    { label: 'Pesanan Baru', href: '/admin/orders?status=NEW', active: isOrdersStatus('NEW'), badge: counts.pendingOrders },
    { label: 'Diproses', href: '/admin/orders?status=PROCESSING', active: isOrdersStatus('PROCESSING'), badge: counts.processing },
    { label: 'Dikirim', href: '/admin/orders?status=SHIPPED', active: isOrdersStatus('SHIPPED') },
    { label: 'Selesai', href: '/admin/orders?status=COMPLETED', active: isOrdersStatus('COMPLETED') },
    { label: 'Dibatalkan', href: '/admin/orders?status=CANCELLED', active: isOrdersStatus('CANCELLED') },
    { label: 'Retur', href: '/admin/orders?status=RETURNED', active: isOrdersStatus('RETURNED'), badge: counts.returned },
  ];

  const showMasterData = can('products:view') || can('users:view') || can('roles:view') || can('events:view');

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

        {(can('dashboard:view') || can('reports:view')) && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Ringkasan</div>
            {can('dashboard:view') && (
              <Link href="/admin/dashboard" className={`${styles.link} ${isActive('/admin/dashboard') ? styles.linkActive : ''}`.trim()}>
                <span className={styles.linkContent}>{iconDashboard}<span className={styles.linkLabel}>Dashboard</span></span>
              </Link>
            )}
            {can('reports:view') && (
              <Link href="/admin/reports" className={`${styles.link} ${isActive('/admin/reports') ? styles.linkActive : ''}`.trim()}>
                <span className={styles.linkContent}>{iconReports}<span className={styles.linkLabel}>Laporan Penjualan</span></span>
              </Link>
            )}
          </div>
        )}

        {can('orders:view') && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Operasional</div>
            <button
              type="button"
              className={`${styles.link} ${styles.groupToggle} ${isOnOrdersRoute ? styles.linkActive : ''}`.trim()}
              onClick={() => setOrdersOpen((v) => !v)}
              aria-expanded={ordersOpen}
              aria-controls="admin-orders-submenu"
            >
              <span className={styles.linkContent}>{iconOrders}<span className={styles.linkLabel}>Pesanan</span></span>
              <span className={styles.groupToggleRight}>
                {counts.awaitingWaybill > 0 && <Badge count={counts.awaitingWaybill} muted />}
                <span className={`${styles.chevronWrap} ${ordersOpen ? styles.chevronOpen : ''}`.trim()}>
                  {iconChevron}
                </span>
              </span>
            </button>
            {ordersOpen && (
              <div id="admin-orders-submenu" className={styles.submenu}>
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
            )}
          </div>
        )}

        {showMasterData && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Master Data</div>
            {can('products:view') && (
              <Link href="/admin/products" className={`${styles.link} ${isActive('/admin/products') ? styles.linkActive : ''}`.trim()}>
                <span className={styles.linkContent}>{iconProducts}<span className={styles.linkLabel}>Produk</span></span>
              </Link>
            )}
            {(can('users:view') || can('roles:view')) && (
              <Link href="/admin/users" className={`${styles.link} ${isActive('/admin/users') ? styles.linkActive : ''}`.trim()}>
                <span className={styles.linkContent}>{iconUsers}<span className={styles.linkLabel}>User & Role</span></span>
              </Link>
            )}
            {can('events:view') && (
              <Link href="/admin/events" className={`${styles.link} ${isActive('/admin/events') ? styles.linkActive : ''}`.trim()}>
                <span className={styles.linkContent}>{iconEvents}<span className={styles.linkLabel}>Event</span></span>
              </Link>
            )}
          </div>
        )}

        {can('products:view') && (
          <div className={styles.bottomSection}>
            <Link
              href="/admin/recycle-bin"
              className={`${styles.link} ${isActive('/admin/recycle-bin') ? styles.linkActive : ''}`.trim()}
            >
              <span className={styles.linkContent}>
                {iconTrash}
                <span className={styles.linkLabel}>Recycle Bin</span>
              </span>
              {counts.archivedProducts > 0 && <Badge count={counts.archivedProducts} muted />}
            </Link>
          </div>
        )}
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
