'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import styles from './AdminHeader.module.css';

export default function AdminHeader() {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.header}>
      <Link href="/admin/dashboard" className={styles.brandLink}>
        <Image src="/logo.png" alt="SUMDE BETTA" width={38} height={38} className={styles.brandLogo} />
        <div>
          <div className={styles.brandName}>SUMDE BETTA</div>
          <div className={styles.brandTagline}>ADMIN CONTROL CENTER</div>
        </div>
      </Link>

      <div className={styles.actions}>
        <Link href="/produk" target="_blank" className={styles.storefrontLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Lihat Toko
        </Link>

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

        <div className={styles.profileGroup}>
          <div className={styles.profileMeta}>
            <div className={styles.profileName}>
              {currentUser?.name || 'Administrator'}
            </div>
            <div className={styles.profileRole}>● System Admin</div>
          </div>

          <button onClick={logout} className={styles.logoutButton}>
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
