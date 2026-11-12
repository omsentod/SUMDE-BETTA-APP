'use client';

import styles from '../users.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

export default function UserActivityTab({ userData }) {
  const { user, orders = [], passwordResets = [] } = userData;

  // Bangun timeline events
  const events = [];

  // 1. Akun Dibuat
  if (user.createdAt) {
    events.push({
      date: new Date(user.createdAt),
      type: 'ACCOUNT_CREATED',
      dotClass: styles.timelineDotInfo,
      title: 'Akun Pengguna Terdaftar',
      desc: `Pengguna mendaftar dengan email ${user.email} ${
        user.isGoogleLinked ? 'melalui Google OAuth' : 'menggunakan form pendaftaran'
      }.`,
    });
  }

  // 2. Status Verifikasi WhatsApp & Email
  if (user.phoneVerified) {
    events.push({
      date: new Date(user.phoneVerified),
      type: 'PHONE_VERIFIED',
      dotClass: styles.timelineDotSuccess,
      title: 'WhatsApp Terverifikasi',
      desc: `Nomor WhatsApp ${user.phone} telah terverifikasi dan aktif.`,
    });
  }

  if (user.emailVerified) {
    events.push({
      date: new Date(user.emailVerified),
      type: 'EMAIL_VERIFIED',
      dotClass: styles.timelineDotSuccess,
      title: 'Email Terverifikasi',
      desc: `Alamat email ${user.email} berhasil diverifikasi.`,
    });
  }

  // 3. Password Resets
  if (passwordResets && passwordResets.length > 0) {
    passwordResets.forEach((pr) => {
      events.push({
        date: new Date(pr.createdAt),
        type: 'PASSWORD_RESET',
        dotClass: styles.timelineDotWarning,
        title: 'Permintaan Reset Password',
        desc: pr.usedAt
          ? `Token reset password digunakan pada ${new Date(pr.usedAt).toLocaleTimeString('id-ID')}.`
          : 'Tautan reset password dibuat namun belum digunakan.',
      });
    });
  }

  // 4. Orders
  if (orders && orders.length > 0) {
    orders.forEach((order) => {
      const isPaid = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(order.status);
      events.push({
        date: new Date(order.createdAt),
        type: 'ORDER_PLACED',
        dotClass: isPaid ? styles.timelineDotSuccess : styles.timelineDot,
        title: `Pemesanan #${order.id.slice(0, 8)} (${order.status})`,
        desc: `Pesanan senilai ${formatIDR(order.total)} (${order.items?.length || 0} item) via ${order.orderSource || 'WEB'}.`,
      });
    });
  }

  // Urutkan timeline dari yang paling baru
  events.sort((a, b) => b.date - a.date);

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Jejak Aktivitas & Keamanan Akun
        </h4>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          Rekap kronologis seluruh aktivitas penting pengguna sejak pendaftaran hingga saat ini.
        </p>
      </div>

      <div className={styles.timeline}>
        {events.map((evt, idx) => (
          <div key={idx} className={styles.timelineItem}>
            <span className={`${styles.timelineDot} ${evt.dotClass || ''}`} />
            <div className={styles.timelineTitle}>{evt.title}</div>
            <div className={styles.timelineTime}>
              {evt.date.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              WIB
            </div>
            <div className={styles.timelineDesc}>{evt.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
