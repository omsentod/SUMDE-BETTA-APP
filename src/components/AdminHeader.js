'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { playNotificationChime } from '@/lib/notificationSound';
import { startTabTitleFlash } from '@/lib/tabFlashing';
// import { useTheme } from '@/context/ThemeContext'; // theme toggle dinonaktifkan sementara
import NotificationBell from '@/components/NotificationBell';
import UserAvatar from '@/components/UserAvatar';
import styles from './AdminHeader.module.css';

export default function AdminHeader({ onToggleSidebar, isSidebarOpen = false }) {
  const { currentUser, logout, isLoading } = useAuth();
  const { toast } = useToast();
  // const { theme, toggleTheme } = useTheme(); // theme toggle dinonaktifkan sementara
  const router = useRouter();
  const pathname = usePathname();

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!profileOpen) return;
    const handleOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [profileOpen]);

  // Heartbeat presence untuk status online otomatis
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        await fetch('/api/chat/heartbeat', { method: 'POST' });
      } catch {
        // Silent fail jika jaringan sementara offline
      }
    };

    // Ping pertama saat admin membuka website
    sendHeartbeat();

    // Ping berkala tiap 40 detik selama tab aktif
    const timer = setInterval(() => {
      if (!cancelled) sendHeartbeat();
    }, 40 * 1000);

    // Ping instan saat admin kembali fokus ke tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser?.role]);

  // Ref stabil untuk callback realtime agar useEffect tidak reconnect setiap navigasi rute
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  const toastRef = useRef(toast);

  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
    toastRef.current = toast;
  }, [pathname, router, toast]);

  // Listener notifikasi chat masuk saat admin sedang membuka halaman lain (dashboard, orders, dll)
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;

    let cancelled = false;
    let ablyClient = null;
    let adminChannel = null;

    // Minta izin notifikasi browser secara pasif jika belum diputuskan
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const askPermission = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener('click', askPermission);
      };
      window.addEventListener('click', askPermission, { once: true });
    }

    async function initAdminChatListener() {
      try {
        const Ably = await import('ably');
        if (cancelled) return;

        ablyClient = new Ably.Realtime({
          authUrl: '/api/chat/auth',
          authMethod: 'GET',
        });
        ablyClient.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {});

        adminChannel = ablyClient.channels.get('admin:chat');
        adminChannel.subscribe('new-inbound-chat', (msgEvent) => {
          if (cancelled) return;
          const data = msgEvent?.data;
          if (!data) return;

          const isHidden = typeof document !== 'undefined' && document.hidden;
          const currentPath = pathnameRef.current;
          const isNotOnChatPage = currentPath !== '/admin/chat';

          // Bunyikan chime notifikasi audio jika admin di halaman lain atau tab sedang tertutup/hidden
          if (isNotOnChatPage || isHidden) {
            playNotificationChime();
          }

          // Jika tab sedang di-minimize / buka tab lain, jalankan tab title flash & desktop notification
          if (isHidden) {
            startTabTitleFlash(`💬 (1) Pesan dari ${data.senderName || 'Pelanggan'}!`);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                const notif = new Notification(`💬 Pesan dari ${data.senderName || 'Pelanggan'}`, {
                  body: data.preview || 'Pelanggan mengirimkan pesan baru.',
                  icon: '/img/betta-1.png',
                  tag: `chat-${data.conversationId}`,
                });
                notif.onclick = () => {
                  window.focus();
                  routerRef.current?.push(`/admin/chat?select=${data.conversationId}`);
                };
              } catch {
                // Silent catch jika platform membatasi desktop notification
              }
            }
          }

          // Munculkan toast jika admin sedang membuka halaman admin selain /admin/chat
          if (isNotOnChatPage && !isHidden) {
            toastRef.current?.info(`💬 Pesan Baru dari ${data.senderName || 'Pelanggan'}: "${data.preview || '...'}"`);
          }
        }).catch(() => {});
      } catch (err) {
        console.warn('Admin chat listener fallback:', err.message);
      }
    }

    initAdminChatListener();

    return () => {
      cancelled = true;
      try { adminChannel?.unsubscribe(); } catch {}
      try { ablyClient?.close(); } catch {}
    };
  }, [currentUser?.role]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    router.replace('/');
    router.refresh();
  };

  const roleLabel = currentUser?.role === 'admin' ? 'System Admin' : (currentUser?.role || 'Admin');

  return (
    <header className={styles.header}>
      <div className={styles.leftGroup}>
        <button
          type="button"
          className={styles.hamburgerBtn}
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-expanded={Boolean(isSidebarOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="14" y2="18" />
          </svg>
        </button>

        <Link href="/admin/dashboard" className={styles.brandLink}>
          <Image src="/img/logo.png" alt="SUMDE BETTA" width={38} height={38} className={styles.brandLogo} />
          <div>
            <div className={styles.brandName}>SUMDE BETTA</div>
            <div className={styles.brandTagline}>ADMIN CONTROL CENTER</div>
          </div>
        </Link>
      </div>

      <div className={styles.actions}>
        <Link href="/produk" target="_blank" className={styles.storefrontLink} title="Lihat Toko">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>Lihat Toko</span>
        </Link>

        <NotificationBell />

        {/* Theme toggle (admin) DINONAKTIFKAN SEMENTARA — app dikunci mode terang.
            Uncomment blok di bawah (+ import/binding di atas) untuk mengaktifkan lagi.
        <button
          onClick={toggleTheme}
          className={styles.themeButton}
          title="Ganti Mode Tampilan"
          aria-label="Ganti Mode Tampilan"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        */}

        <div className={styles.profileMenuWrapper} ref={profileRef}>
          {isLoading && !currentUser ? (
            <div className={`skeleton-box ${styles.avatarSkeleton}`} aria-busy="true" />
          ) : (
            <button
              type="button"
              className={styles.profileAvatarBtn}
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Menu profil"
              aria-expanded={profileOpen}
              title={currentUser?.name || 'Profil Admin'}
            >
              <UserAvatar user={currentUser} size="fill" fallback="AD" />
            </button>
          )}

          <div className={`${styles.profileDropdown} ${profileOpen ? styles.profileDropdownOpen : ''}`.trim()}>
            <div className={styles.profileDropdownHeader}>
              <div className={styles.profileDropdownName}>{currentUser?.name || 'Administrator'}</div>
              <div className={styles.profileDropdownRole}>{roleLabel}</div>
            </div>

            <Link
              href="/customer/dashboard"
              className={styles.profileDropdownItem}
              onClick={() => setProfileOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Edit Profil
            </Link>

            {currentUser?.hasPassword !== false && (
              <Link
                href="/customer/settings/password"
                className={styles.profileDropdownItem}
                onClick={() => setProfileOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Ubah Password
              </Link>
            )}

            <div className={styles.profileDropdownDivider} />

            <button
              type="button"
              onClick={handleLogout}
              className={`${styles.profileDropdownItem} ${styles.profileDropdownLogout}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Keluar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
