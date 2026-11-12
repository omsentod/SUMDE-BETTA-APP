'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from '../users.module.css';

export default function UserNotificationsTab({ userId, notifications = [], onNotificationSent }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState('admin.announcement');
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.warning('Judul dan isi notifikasi wajib diisi.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          link,
          type,
          sendEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengirim notifikasi.');
        return;
      }

      toast.success('Notifikasi berhasil dikirimkan ke pengguna.');
      setTitle('');
      setBody('');
      setLink('');
      setSendEmail(false);
      if (onNotificationSent) onNotificationSent();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {/* Form Kirim Pesan / Notifikasi Baru */}
      <div className={styles.sectionCard} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Kirim Pesan & Notifikasi Khusus
          </h4>
        </div>

        <form onSubmit={handleSend}>
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Judul Pesan *</label>
              <input
                type="text"
                placeholder="Contoh: Pembaruan Pengiriman Pesanan"
                className={styles.formInput}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Kategori / Tipe Notifikasi</label>
              <select
                className={styles.formInput}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="admin.announcement">Pengumuman & Info Khusus</option>
                <option value="order.update">Pembaruan Pesanan</option>
                <option value="promo.special">Penawaran Eksklusif</option>
                <option value="account.security">Keamanan & Verifikasi</option>
              </select>
            </div>

            <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
              <label className={styles.inputLabel}>Isi Pesan Notifikasi *</label>
              <textarea
                rows={3}
                placeholder="Tulis pesan yang akan muncul di notification bell dan push notification pengguna..."
                className={styles.formTextarea}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Tautan Tujuan (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: /customer/orders atau /produk"
                className={styles.formInput}
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup} style={{ justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-main)' }}>
                  Kirim salinan pesan ini ke email pengguna
                </span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className={styles.btnPrimarySolid} disabled={sending}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {sending ? 'Mengirim...' : 'Kirim Notifikasi'}
            </button>
          </div>
        </form>
      </div>

      {/* Riwayat Notifikasi */}
      <h4 style={{ margin: '0 0 0.875rem', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
        Riwayat Notifikasi Terkirim ({notifications.length})
      </h4>

      {notifications.length === 0 ? (
        <div className={styles.tabEmptyState}>
          <svg className={styles.tabEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <h4 className={styles.tabEmptyTitle}>Belum Ada Riwayat Notifikasi</h4>
          <p className={styles.tabEmptyDesc}>Pengguna belum pernah menerima notifikasi sistem.</p>
        </div>
      ) : (
        <div className={styles.notifHistoryList}>
          {notifications.map((notif) => (
            <div key={notif.id} className={styles.notifItem}>
              <div className={styles.notifItemHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span className={styles.notifItemTitle}>{notif.title}</span>
                  {notif.readAt ? (
                    <span style={{ fontSize: '0.6875rem', color: '#10B981', fontWeight: 600 }}>
                      ✓ Dibaca
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.6875rem', color: '#F59E0B', fontWeight: 600 }}>
                      Belum Dibaca
                    </span>
                  )}
                </div>
                <span className={styles.notifItemDate}>
                  {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </span>
              </div>
              <div className={styles.notifItemBody}>{notif.body}</div>
              {notif.link && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.725rem' }}>
                  <a
                    href={notif.link}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Tautan: {notif.link} →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
