'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import styles from './CustomerShell.module.css';

const IconUser = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconPin = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconLock = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconOrders = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const IconBell = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconLogout = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

function SidebarSkeleton() {
  return (
    <>
      <aside className={styles.sidebar} aria-hidden="true">
        <div className={styles.userCard}>
          <div className={`skeleton-box ${styles.skeletonAvatar}`} />
          <div className={styles.userMeta}>
            <div className={`skeleton-box ${styles.skeletonLineLg}`} />
            <div className={`skeleton-box ${styles.skeletonLineSm}`} />
          </div>
        </div>
        <div className={styles.navGroup}>
          <div className={`skeleton-box ${styles.skeletonNavItem}`} />
          <div className={`skeleton-box ${styles.skeletonNavItem}`} />
          <div className={`skeleton-box ${styles.skeletonNavItem}`} />
        </div>
      </aside>
      <div className={styles.mobileNavWrap} aria-hidden="true">
        <div className={styles.mobileUserRow}>
          <div className={styles.mobileUserLeft}>
            <div className={`skeleton-box ${styles.skeletonAvatar}`} />
            <div className={styles.userMeta}>
              <div className={`skeleton-box ${styles.skeletonLineLg}`} />
              <div className={`skeleton-box ${styles.skeletonLineSm}`} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CustomerShell({ children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { currentUser, isLoading: authLoading, logout } = useAuth();

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.canAccessAdmin ||
    (Array.isArray(currentUser?.permissions) && currentUser.permissions.length > 0);

  const accountItems = [
    { href: '/customer/dashboard', label: 'Profil Saya', mobileLabel: 'Profil', icon: <IconUser /> },
    { href: '/customer/addresses', label: 'Alamat Saya', mobileLabel: 'Alamat', icon: <IconPin /> },
    ...(currentUser?.hasPassword !== false
      ? [{ href: '/customer/settings/password', label: 'Ubah Password', mobileLabel: 'Password', icon: <IconLock /> }]
      : []),
  ];

  const activityItems = [
    { href: '/customer/orders', label: 'Pesanan Saya', mobileLabel: 'Pesanan', icon: <IconOrders /> },
    { href: '/customer/notifications', label: 'Notifikasi', mobileLabel: 'Notifikasi', icon: <IconBell /> },
  ];

  const allMobileItems = [
    accountItems[0],
    activityItems[0],
    accountItems[1],
    activityItems[1],
    ...(accountItems[2] ? [accountItems[2]] : []),
  ];

  const handleLogout = async () => {
    await logout();
    router.replace('/');
    router.refresh();
  };

  return (
    <div className={styles.shell}>
      <div className={styles.container}>
        <div className={styles.grid}>
          {authLoading || !currentUser ? (
            <SidebarSkeleton />
          ) : (
            <>
              {/* Desktop Left Sidebar */}
              <aside className={styles.sidebar} aria-label="Menu akun pengguna">
                <div className={styles.userCard}>
                  <UserAvatar user={currentUser} size="lg" />
                  <div className={styles.userMeta}>
                    <div className={styles.userName}>{currentUser.name}</div>
                    <div className={styles.userEmail}>{currentUser.email}</div>
                  </div>
                </div>

                {isAdmin && (
                  <Link href="/admin/dashboard" className={styles.adminLink}>
                    <span>Admin Control Center</span>
                    <IconGrid />
                  </Link>
                )}

                <nav className={styles.navGroup} aria-label="Akun Saya">
                  <div className={styles.navGroupLabel}>Akun Saya</div>
                  {accountItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`.trim()}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>

                <nav className={styles.navGroup} aria-label="Aktivitas">
                  <div className={styles.navGroupLabel}>Aktivitas</div>
                  {activityItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`.trim()}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>

                <div className={styles.sidebarFooter}>
                  <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
                    <IconLogout />
                    <span>Keluar</span>
                  </button>
                </div>
              </aside>

              {/* Mobile Compact Header + Scrollable Pill Tabs */}
              <div className={styles.mobileNavWrap}>
                <div className={styles.mobileUserRow}>
                  <div className={styles.mobileUserLeft}>
                    <UserAvatar user={currentUser} size="lg" />
                    <div className={styles.userMeta}>
                      <div className={styles.userName}>{currentUser.name}</div>
                      <div className={styles.userEmail}>{currentUser.email}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <Link href="/admin/dashboard" className={styles.mobileAdminPill}>
                      Admin Panel
                    </Link>
                  )}
                </div>

                <nav className={styles.mobileTabs} aria-label="Navigasi akun mobile">
                  {allMobileItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.mobileTab} ${isActive(item.href) ? styles.mobileTabActive : ''}`.trim()}
                    >
                      {item.icon}
                      <span>{item.mobileLabel}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </>
          )}

          {/* Main Content Area */}
          <div className={styles.main}>{children}</div>
        </div>
      </div>
    </div>
  );
}

