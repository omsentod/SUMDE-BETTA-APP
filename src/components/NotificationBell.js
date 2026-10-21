'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getNotificationMeta, formatRelativeTime, getNotificationImage } from '@/lib/notificationHelpers';
import { playNotificationChime, isChimeMuted, setChimeMuted } from '@/lib/notificationSound';
import styles from './NotificationBell.module.css';

const POLL_MS = 30_000;

const BellSvg = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const VolumeIcon = ({ muted }) => (
  muted ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
);

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [isRinging, setIsRinging] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [floatingAlert, setFloatingAlert] = useState(null);
  const [pushStatus, setPushStatus] = useState('unknown'); // 'enabled' | 'blocked' | 'unsupported' | 'unknown'

  const prevUnreadRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  // Load sound preference on mount
  useEffect(() => {
    setSoundMuted(isChimeMuted());
  }, []);

  const toggleSound = (e) => {
    e.stopPropagation();
    const next = !soundMuted;
    setSoundMuted(next);
    setChimeMuted(next);
    if (!next) {
      playNotificationChime();
      toast.info('Suara notifikasi diaktifkan.');
    } else {
      toast.info('Suara notifikasi dibisukan.');
    }
  };

  const loadNotifications = async (isBackgroundPoll = false) => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications?limit=30');
      if (!res.ok) return;
      const data = await res.json();
      const newItems = data.notifications || [];
      const newUnread = data.unreadCount || 0;

      // Cek apakah ada notifikasi baru yang masuk saat user aktif
      if (!isFirstLoadRef.current && isBackgroundPoll && newUnread > prevUnreadRef.current) {
        // Trigger bell wiggle & chime
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 1400);
        playNotificationChime();

        // Tampilkan in-app floating banner untuk notifikasi paling baru
        const latest = newItems[0];
        if (latest && !latest.readAt) {
          setFloatingAlert(latest);
          setTimeout(() => {
            setFloatingAlert((cur) => (cur?.id === latest.id ? null : cur));
          }, 4500);
        }
      }

      setItems(newItems);
      setUnread(newUnread);
      prevUnreadRef.current = newUnread;
      isFirstLoadRef.current = false;
    } catch {
      // silent
    }
  };

  // Initial load + Polling fallback
  useEffect(() => {
    if (!currentUser?.id) return;
    loadNotifications(false);
    const interval = setInterval(() => loadNotifications(true), POLL_MS);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  // Ably real-time subscription
  useEffect(() => {
    if (!currentUser?.id) return;
    let ablyClient = null;
    let channel = null;
    let cancelled = false;

    const setupAbly = async () => {
      try {
        const statusRes = await fetch('/api/ably/status');
        if (!statusRes.ok || cancelled) return;
        const { enabled } = await statusRes.json();
        if (!enabled || cancelled) return;

        const Ably = await import('ably');
        if (cancelled) return;

        const client = new Ably.Realtime({
          authUrl: '/api/ably/auth',
          authMethod: 'GET',
        });

        client.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {
          // silent fallback
        });

        if (cancelled) {
          try { client.close(); } catch { /* ignore */ }
          return;
        }

        ablyClient = client;
        channel = ablyClient.channels.get(`user:${currentUser.id}`);
        channel.subscribe('notification', (msg) => {
          // Realtime incoming payload
          loadNotifications(true);
          if (msg.data) {
            setIsRinging(true);
            setTimeout(() => setIsRinging(false), 1400);
            playNotificationChime();
            setFloatingAlert(msg.data);
            setTimeout(() => setFloatingAlert((cur) => (cur?.id === msg.data?.id ? null : cur)), 4500);
          }
        });
      } catch (err) {
        console.warn('Ably fallback to polling:', err.message);
      }
    };

    setupAbly();

    return () => {
      cancelled = true;
      try { if (channel) channel.unsubscribe(); } catch { /* ignore */ }
      try { if (ablyClient) ablyClient.close(); } catch { /* ignore */ }
      channel = null;
      ablyClient = null;
    };
  }, [currentUser?.id]);

  // Web Push status probe
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushStatus('blocked');
      return;
    }
    navigator.serviceWorker.getRegistration('/sw.js').then((reg) => {
      if (!reg) { setPushStatus('unknown'); return; }
      reg.pushManager.getSubscription().then((sub) => {
        setPushStatus(sub ? 'enabled' : 'unknown');
      });
    }).catch(() => setPushStatus('unknown'));
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open]);

  // Filtered items based on active tab
  const displayedItems = useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter((n) => !n.readAt);
    }
    return items;
  }, [items, activeTab]);

  const hasReadItems = useMemo(() => {
    return items.some((n) => n.readAt);
  }, [items]);

  // Item click -> mark read and navigate
  const handleItemClick = async (item, e) => {
    e.preventDefault();
    if (!item.readAt) {
      try {
        await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
        setUnread((prev) => Math.max(0, prev - 1));
      } catch { /* silent */ }
    }
    setOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  // Mark single as read without navigation
  const handleMarkAsRead = async (item, e) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  // Delete single notification
  const handleDeleteItem = async (item, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => n.id !== item.id));
        if (!item.readAt) {
          setUnread((prev) => Math.max(0, prev - 1));
        }
      }
    } catch { /* silent */ }
  };

  // Mark all as read
  const handleReadAll = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
      setUnread(0);
      toast.success('Semua notifikasi ditandai sudah dibaca.');
    } catch { /* silent */ }
  };

  // Clear read notifications
  const handleClearRead = async () => {
    try {
      const res = await fetch('/api/notifications?clear=read', { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((n) => !n.readAt));
        toast.success('Notifikasi yang sudah dibaca berhasil dibersihkan.');
      }
    } catch { /* silent */ }
  };

  // Request browser push permission
  const handleEnablePush = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setPushStatus('blocked'); return; }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const keyRes = await fetch('/api/push/vapid-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error('VAPID key belum di-set');

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushStatus('enabled');
      toast.success('Notifikasi push browser berhasil diaktifkan.');
    } catch (err) {
      toast.error('Gagal mengaktifkan push: ' + err.message);
    }
  };

  if (!currentUser) return null;

  return (
    <div className={styles.wrap}>
      {/* Trigger Button */}
      <button
        className={`${styles.trigger} ${isRinging ? styles.bellRinging : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Pemberitahuan Notifikasi"
        title="Notifikasi"
        type="button"
      >
        <BellSvg />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {/* Floating Alert Banner (realtime popup) */}
      {floatingAlert && (
        <div className={styles.floatingAlert} role="status">
          <div className={styles.floatingThumbWrapper}>
            <img
              src={getNotificationImage(floatingAlert)}
              alt=""
              className={styles.floatingThumbImage}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/img/betta-1.png';
              }}
            />
            <span
              className={styles.cornerBadge}
              style={{ backgroundColor: getNotificationMeta(floatingAlert.type).badgeColor }}
            >
              {getNotificationMeta(floatingAlert.type).icon}
            </span>
          </div>
          <div className={styles.floatingAlertContent}>
            <div className={styles.floatingAlertCategory}>
              {getNotificationMeta(floatingAlert.type).label} • Baru saja
            </div>
            <div className={styles.floatingAlertTitle}>{floatingAlert.title || 'Notifikasi Baru'}</div>
            {floatingAlert.body && <div className={styles.floatingAlertBody}>{floatingAlert.body}</div>}
            {floatingAlert.link && (
              <button
                type="button"
                className={styles.floatingAlertLink}
                onClick={() => {
                  setFloatingAlert(null);
                  router.push(floatingAlert.link);
                }}
              >
                Lihat Detail →
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.floatingAlertClose}
            onClick={() => setFloatingAlert(null)}
            aria-label="Tutup alert"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Dropdown Card */}
      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            {/* Header */}
            <div className={styles.dropdownHeader}>
              <div className={styles.headerLeft}>
                <span className={styles.dropdownTitle}>Notifikasi</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={toggleSound}
                  title={soundMuted ? 'Aktifkan suara notifikasi' : 'Bisukan suara notifikasi'}
                  aria-label="Toggle suara notifikasi"
                >
                  <VolumeIcon muted={soundMuted} />
                </button>
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.readAllBtn}
                  onClick={handleReadAll}
                  disabled={unread === 0}
                >
                  Tandai semua dibaca
                </button>
              </div>
            </div>

            {/* Tabs Filter Bar */}
            <div className={styles.tabsBar}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('all')}
              >
                Semua
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'unread' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('unread')}
              >
                Belum Dibaca
                {unread > 0 && <span className={styles.tabPill}>{unread}</span>}
              </button>
            </div>

            {/* List Body */}
            <div className={styles.list}>
              {displayedItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    {activeTab === 'unread' ? (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    ) : (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    )}
                  </div>
                  <p className={styles.emptyTitle}>
                    {activeTab === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi'}
                  </p>
                  <p className={styles.emptyDesc}>
                    {activeTab === 'unread'
                      ? 'Tidak ada pesan yang terlewat saat ini.'
                      : 'Pembaruan pesanan, pembayaran, dan promo toko akan muncul di sini.'}
                  </p>
                </div>
              ) : (
                displayedItems.map((item) => {
                  const meta = getNotificationMeta(item.type);
                  const imageSrc = getNotificationImage(item);
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => handleItemClick(item, e)}
                      className={`${styles.item} ${!item.readAt ? styles.itemUnread : ''}`}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.thumbWrapper}>
                        <img
                          src={imageSrc}
                          alt=""
                          className={styles.thumbImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/img/betta-1.png';
                          }}
                        />
                        <span
                          className={styles.cornerBadge}
                          style={{ backgroundColor: meta.badgeColor }}
                          title={meta.label}
                        >
                          {meta.icon}
                        </span>
                      </div>
                      <div className={styles.itemContent}>
                        <div className={styles.itemMetaRow}>
                          <span className={styles.itemCategory}>{meta.label}</span>
                          <span className={styles.itemSeparator}>•</span>
                          <span className={styles.itemTime}>{formatRelativeTime(item.createdAt)}</span>
                          {!item.readAt && <span className={styles.unreadDot} />}
                        </div>
                        <div className={styles.itemTitleText}>{item.title}</div>
                        {item.body && <div className={styles.itemBody}>{item.body}</div>}

                        {/* Quick Action Buttons */}
                        <div className={styles.itemActions}>
                          {!item.readAt && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={(e) => handleMarkAsRead(item, e)}
                              title="Tandai sudah dibaca"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Dibaca
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={(e) => handleDeleteItem(item, e)}
                            title="Hapus notifikasi ini"
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
                  );
                })
              )}
            </div>

            {/* Web Push Banner (User-initiated opt-in) */}
            {pushStatus !== 'unsupported' && pushStatus !== 'enabled' && pushStatus !== 'blocked' && (
              <div className={styles.pushPrompt}>
                <span>Terima notifikasi instan di browser ini?</span>
                <button type="button" className={styles.pushPromptBtn} onClick={handleEnablePush}>
                  Aktifkan
                </button>
              </div>
            )}

            {/* Footer */}
            <div className={styles.dropdownFooter}>
              {hasReadItems ? (
                <button
                  type="button"
                  className={styles.clearReadBtn}
                  onClick={handleClearRead}
                >
                  Bersihkan yang dibaca
                </button>
              ) : (
                <span />
              )}
              <Link
                href="/customer/notifications"
                className={styles.footerLink}
                onClick={() => setOpen(false)}
              >
                Lihat Semua Halaman →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
