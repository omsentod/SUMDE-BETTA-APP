'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './NotificationBell.module.css';

const POLL_MS = 30_000; // fallback polling — Ably subscribe akan short-circuit

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

function relativeTime(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pushStatus, setPushStatus] = useState('unknown'); // 'enabled' | 'blocked' | 'unsupported' | 'unknown'

  const load = async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch { /* silent */ }
  };

  // Initial load + polling fallback.
  useEffect(() => {
    if (!currentUser) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [currentUser?.id]);

  // Ably real-time subscribe — kalau env ABLY_ENABLED signal ada dari server.
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

        // Swallow async connection errors (HMR teardown, failed handshake).
        // Ably throws these as unhandled rejections during dev restarts.
        client.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {
          // silent — fallback to polling remains active
        });

        if (cancelled) {
          try { client.close(); } catch { /* ignore */ }
          return;
        }

        ablyClient = client;
        channel = ablyClient.channels.get(`user:${currentUser.id}`);
        channel.subscribe('notification', () => {
          load();
        });
      } catch (err) {
        console.warn('Ably subscribe failed, fallback to polling:', err.message);
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

  // Cek status push subscription (untuk toggle UI).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    /* eslint-disable react-hooks/set-state-in-effect -- push status probe on mount */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Tutup dropdown saat klik di luar (backdrop handle sebagian).
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open]);

  const handleItemClick = async (item, e) => {
    e.preventDefault();
    if (!item.readAt) {
      try {
        await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' });
      } catch { /* silent */ }
    }
    setOpen(false);
    if (item.link) router.push(item.link);
    load();
  };

  const handleReadAll = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      load();
    } catch { /* silent */ }
  };

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
    } catch (err) {
      alert('Gagal enable push: ' + err.message);
    }
  };

  if (!currentUser) return null;

  return (
    <div className={styles.wrap}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        title="Notifikasi"
      >
        <BellIcon />
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownTitle}>Notifikasi</span>
              <button
                className={styles.readAllBtn}
                onClick={handleReadAll}
                disabled={unread === 0}
              >
                Baca semua
              </button>
            </div>

            <div className={styles.list}>
              {items.length === 0 ? (
                <div className={styles.empty}>Belum ada notifikasi.</div>
              ) : (
                items.map((item) => (
                  <a
                    key={item.id}
                    href={item.link || '#'}
                    onClick={(e) => handleItemClick(item, e)}
                    className={`${styles.item} ${!item.readAt ? styles.itemUnread : ''}`}
                  >
                    <div className={styles.itemTitle}>
                      <span>{item.title}</span>
                      {!item.readAt && <span className={styles.unreadDot} />}
                    </div>
                    <div className={styles.itemBody}>{item.body}</div>
                    <div className={styles.itemTime}>{relativeTime(item.createdAt)}</div>
                  </a>
                ))
              )}
            </div>

            {pushStatus !== 'unsupported' && pushStatus !== 'enabled' && pushStatus !== 'blocked' && (
              <div className={styles.pushToggle}>
                <span>Aktifkan notifikasi browser untuk update instan.</span>
                <button className={styles.pushToggleBtn} onClick={handleEnablePush}>
                  Aktifkan
                </button>
              </div>
            )}
            {pushStatus === 'enabled' && (
              <div className={styles.pushToggle}>
                <span>Notifikasi browser aktif ✓</span>
              </div>
            )}
            {pushStatus === 'blocked' && (
              <div className={styles.pushToggle}>
                <span>Notifikasi browser diblokir. Aktifkan di setting browser.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Helper untuk konversi VAPID public key ke Uint8Array (format subscribe).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
