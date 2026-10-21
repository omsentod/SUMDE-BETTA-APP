'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getNotificationMeta, formatRelativeTime } from '@/lib/notificationHelpers';
import styles from './notifications.module.css';

const TRANSACTION_TYPES = [
  'order.new',
  'order.created',
  'order.paid',
  'order.processing',
  'order.shipped',
  'order.completed',
  'order.cancelled',
  'shipment.picked',
  'shipment.dropping_off',
  'shipment.delivered',
  'shipment.returned',
];

export default function NotificationsPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'transaction' | 'system'

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login?next=/customer/notifications');
    }
  }, [authLoading, currentUser, router]);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    load();
  }, [currentUser?.id]);

  const unreadCount = useMemo(() => {
    return items.filter((n) => !n.readAt).length;
  }, [items]);

  const hasReadItems = useMemo(() => {
    return items.some((n) => n.readAt);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter((n) => !n.readAt);
    }
    if (activeTab === 'transaction') {
      return items.filter((n) => TRANSACTION_TYPES.some((t) => (n.type || '').toLowerCase().includes(t.replace('order.', '').replace('shipment.', ''))));
    }
    if (activeTab === 'system') {
      return items.filter((n) => !TRANSACTION_TYPES.some((t) => (n.type || '').toLowerCase().includes(t.replace('order.', '').replace('shipment.', ''))));
    }
    return items;
  }, [items, activeTab]);

  const handleItemClick = async (item, e) => {
    e.preventDefault();
    if (!item.readAt) {
      try {
        await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      } catch {
        // silent
      }
    }
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleMarkAsRead = async (item, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      toast.success('Notifikasi ditandai dibaca.');
    } catch {
      toast.error('Gagal memperbarui status notifikasi.');
    }
  };

  const handleDeleteItem = async (item, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => n.id !== item.id));
        toast.success('Notifikasi berhasil dihapus.');
      } else {
        toast.error('Gagal menghapus notifikasi.');
      }
    } catch {
      toast.error('Gagal menghapus notifikasi.');
    }
  };

  const handleReadAll = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
      toast.success('Semua notifikasi ditandai dibaca.');
    } catch {
      toast.error('Gagal menandai notifikasi.');
    }
  };

  const handleClearRead = async () => {
    try {
      const res = await fetch('/api/notifications?clear=read', { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => !n.readAt));
        toast.success('Notifikasi yang sudah dibaca berhasil dibersihkan.');
      }
    } catch {
      toast.error('Gagal membersihkan notifikasi.');
    }
  };

  if (authLoading || !currentUser) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <span className={styles.pageBadge}>Pusat Pesan</span>
          <h1 className={styles.title}>Kotak Notifikasi</h1>
        </div>
        <div className={styles.headerActions}>
          {hasReadItems && (
            <button
              type="button"
              onClick={handleClearRead}
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Bersihkan yang Dibaca
            </button>
          )}
          <button
            type="button"
            onClick={handleReadAll}
            disabled={unreadCount === 0}
            className={styles.actionBtn}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Tandai Semua Dibaca
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          className={`${styles.tab} ${activeTab === 'all' ? styles.tabActive : ''}`}
        >
          Semua
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'unread'}
          onClick={() => setActiveTab('unread')}
          className={`${styles.tab} ${activeTab === 'unread' ? styles.tabActive : ''}`}
        >
          Belum Dibaca
          {unreadCount > 0 && <span className={styles.pillCount}>{unreadCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'transaction'}
          onClick={() => setActiveTab('transaction')}
          className={`${styles.tab} ${activeTab === 'transaction' ? styles.tabActive : ''}`}
        >
          Transaksi & Pengiriman
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'system'}
          onClick={() => setActiveTab('system')}
          className={`${styles.tab} ${activeTab === 'system' ? styles.tabActive : ''}`}
        >
          Promo & Info
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>Memuat notifikasi...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            {activeTab === 'unread' ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : activeTab === 'transaction' ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            )}
          </div>
          <p className={styles.emptyTitle}>
            {activeTab === 'unread'
              ? 'Semua notifikasi sudah Anda baca'
              : activeTab === 'transaction'
              ? 'Belum ada notifikasi transaksi'
              : activeTab === 'system'
              ? 'Belum ada notifikasi promo atau info'
              : 'Belum ada notifikasi'}
          </p>
          <p className={styles.emptyDesc}>
            {activeTab === 'unread'
              ? 'Pesan baru akan otomatis muncul saat ada pembaruan status transaksi atau pesanan.'
              : activeTab === 'transaction'
              ? 'Riwayat konfirmasi pembayaran, resi kurir, dan pengiriman paket akan tercatat di sini.'
              : 'Pemberitahuan terkini terkait akun dan promo eksklusif SUMDE BETTA akan tampil di sini.'}
          </p>
        </div>
      ) : (
        <ul className={styles.list}>
          {filteredItems.map((item) => {
            const meta = getNotificationMeta(item.type);
            return (
              <li key={item.id}>
                <div
                  onClick={(e) => handleItemClick(item, e)}
                  className={`${styles.itemCard} ${!item.readAt ? styles.itemUnread : ''}`}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`${styles.typeBadge} ${styles['variant_' + meta.variant]}`}>
                    {meta.icon}
                  </div>
                  <div className={styles.itemBody}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemTitle}>{item.title || 'Notifikasi'}</span>
                      <div className={styles.itemMeta}>
                        <span className={styles.itemTime}>{formatRelativeTime(item.createdAt)}</span>
                        {!item.readAt && <span className={styles.unreadDot} aria-hidden="true" />}
                      </div>
                    </div>
                    {item.body && <div className={styles.itemMessage}>{item.body}</div>}
                    <div className={styles.itemActions}>
                      {!item.readAt && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item, e)}
                          className={styles.itemActionBtn}
                          title="Tandai sudah dibaca"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Tandai Dibaca
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item, e)}
                        className={`${styles.itemActionBtn} ${styles.itemActionBtnDanger}`}
                        title="Hapus notifikasi"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
