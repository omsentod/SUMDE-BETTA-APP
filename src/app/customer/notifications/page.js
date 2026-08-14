'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './notifications.module.css';

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

export default function NotificationsPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) router.push('/login?next=/customer/notifications');
  }, [authLoading, currentUser, router]);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (!res.ok) return;
      const data = await res.json();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch result
      setItems(data.notifications || []);
    } catch { /* silent */ } finally {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    load();
  }, [currentUser?.id]);

  const handleClick = async (item, e) => {
    e.preventDefault();
    if (!item.readAt) {
      try { await fetch(`/api/notifications/${item.id}/read`, { method: 'POST' }); } catch { /* silent */ }
    }
    if (item.link) router.push(item.link);
    else load();
  };

  const handleReadAll = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      load();
    } catch { /* silent */ }
  };

  if (authLoading || !currentUser) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.muted}>Memuat...</p>
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notifikasi</h1>
        <button
          type="button"
          onClick={handleReadAll}
          disabled={unreadCount === 0}
          className={styles.readAllBtn}
        >
          Baca semua
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>Memuat notifikasi...</p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>Belum ada notifikasi.</div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.link || '#'}
                onClick={(e) => handleClick(item, e)}
                className={`${styles.item} ${!item.readAt ? styles.itemUnread : ''}`.trim()}
              >
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{item.title || 'Notifikasi'}</div>
                  {item.body && <div className={styles.itemMessage}>{item.body}</div>}
                  <div className={styles.itemTime}>{relativeTime(item.createdAt)}</div>
                </div>
                {!item.readAt && <span className={styles.unreadDot} aria-hidden="true" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
