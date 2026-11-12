'use client';

import { useState, useEffect, useCallback } from 'react';
import UserAvatar from '@/components/UserAvatar';
import UserOverviewTab from './tabs/UserOverviewTab';
import UserOrdersTab from './tabs/UserOrdersTab';
import UserAddressesTab from './tabs/UserAddressesTab';
import UserChatTab from './tabs/UserChatTab';
import UserNotificationsTab from './tabs/UserNotificationsTab';
import UserActivityTab from './tabs/UserActivityTab';
import styles from './users.module.css';

export default function UserDetailModal({ isOpen, onClose, user, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview | orders | addresses | chat | notifications | activity
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const targetUserId = user?.id;

  const loadDeepData = useCallback(async () => {
    if (!targetUserId) return;
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}`);
      if (res.ok) {
        const data = await res.json();
        setUserData(data);
      }
    } catch (err) {
      console.error('Gagal memuat detail aktivitas user:', err);
    }
  }, [targetUserId]);

  useEffect(() => {
    let ignore = false;
    if (!isOpen || !targetUserId) {
      return;
    }

    async function fetchDeep() {
      try {
        const res = await fetch(`/api/admin/users/${targetUserId}`);
        if (res.ok && !ignore) {
          const data = await res.json();
          setUserData(data);
        }
      } catch (err) {
        console.error('Gagal memuat detail aktivitas user:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchDeep();
    return () => {
      ignore = true;
    };
  }, [isOpen, targetUserId]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const currentUserObj = userData?.user || user;
  const orders = userData?.orders || [];
  const addresses = userData?.addresses || [];
  const conversations = userData?.conversations || [];
  const notifications = userData?.notifications || [];

  const handleUserSaved = (updated) => {
    setUserData((prev) => (prev ? { ...prev, user: updated } : null));
    if (onUserUpdated) onUserUpdated(updated);
  };

  const cleanPhone = currentUserObj.phone ? currentUserObj.phone.replace(/[^0-9]/g, '') : '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}`
    : null;

  return (
    <div className={styles.drawerBackdrop} onClick={onClose}>
      <div className={styles.drawerPane} onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerHeaderLeft}>
            <UserAvatar user={currentUserObj} size="lg" />
            <div className={styles.drawerHeaderInfo}>
              <div className={styles.drawerTitleRow}>
                <h2 className={styles.drawerTitle}>{currentUserObj.name}</h2>
                {currentUserObj.phoneVerified ? (
                  <span className={styles.badgeWaVerified}>✓ WA Terverifikasi</span>
                ) : currentUserObj.phone ? (
                  <span className={styles.badgeWaPending}>WA Belum Verif</span>
                ) : (
                  <span className={styles.badgeWaEmpty}>Tanpa WA</span>
                )}
                {currentUserObj.isGoogleLinked && (
                  <span className={styles.badgeGoogle}>Google</span>
                )}
              </div>
              <div className={styles.drawerSubtitle}>
                {currentUserObj.email} {currentUserObj.phone ? `• ${currentUserObj.phone}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.btnSecondarySmall}
                title="Hubungi via WhatsApp"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                WhatsApp
              </a>
            )}
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={onClose}
              aria-label="Tutup Panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer Subtabs */}
        <div className={styles.drawerTabsNav}>
          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'overview' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profil & Keamanan
          </button>

          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'orders' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Riwayat Pesanan
            <span className={styles.tabBadgeCount}>{orders.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'addresses' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('addresses')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Buku Alamat
            <span className={styles.tabBadgeCount}>{addresses.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'chat' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Sesi Chat
            <span className={styles.tabBadgeCount}>{conversations.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'notifications' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Kirim Notifikasi
            <span className={styles.tabBadgeCount}>{notifications.length}</span>
          </button>

          <button
            type="button"
            className={`${styles.drawerTabBtn} ${activeTab === 'activity' ? styles.drawerTabBtnActive : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Jejak Aktivitas
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.drawerContentArea}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              Memuat data aktivitas pengguna...
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <UserOverviewTab
                  userData={userData || { user: currentUserObj }}
                  onUserUpdated={handleUserSaved}
                />
              )}
              {activeTab === 'orders' && <UserOrdersTab orders={orders} />}
              {activeTab === 'addresses' && (
                <UserAddressesTab
                  userId={user.id}
                  addresses={addresses}
                  onAddressChanged={loadDeepData}
                />
              )}
              {activeTab === 'chat' && <UserChatTab conversations={conversations} />}
              {activeTab === 'notifications' && (
                <UserNotificationsTab
                  userId={user.id}
                  notifications={notifications}
                  onNotificationSent={loadDeepData}
                />
              )}
              {activeTab === 'activity' && (
                <UserActivityTab userData={userData || { user: currentUserObj }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
