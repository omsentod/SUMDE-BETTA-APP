'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from '../users.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

export default function UserOverviewTab({ userData, onUserUpdated }) {
  const { toast } = useToast();
  const { user, summary = {} } = userData;

  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    streetAddress: user.streetAddress || '',
    rtRw: user.rtRw || '',
    province: user.province || '',
    city: user.city || '',
    district: user.district || '',
    village: user.village || '',
    postalCode: user.postalCode || '',
  });

  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingSecurity, setUpdatingSecurity] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan profil.');
        return;
      }
      toast.success('Profil pengguna berhasil diperbarui.');
      onUserUpdated(data.user);
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleVerification = async () => {
    const nextStatus = !user.emailVerified;
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailVerified: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengubah status verifikasi.');
        return;
      }
      toast.success(nextStatus ? 'Email ditandai telah terverifikasi.' : 'Status verifikasi email dicabut.');
      onUserUpdated(data.user);
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleTogglePhoneVerification = async () => {
    const nextStatus = !user.phoneVerified;
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneVerified: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengubah status verifikasi WhatsApp.');
        return;
      }
      toast.success(nextStatus ? 'Nomor WhatsApp berhasil ditandai Terverifikasi.' : 'Status verifikasi WhatsApp dicabut.');
      onUserUpdated(data.user);
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleSendVerificationOtp = async () => {
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/send-verification`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengirim email OTP.');
        return;
      }
      toast.success(data.message || 'Kode OTP berhasil dikirim ke email user.');
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleSendResetPassword = async () => {
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/send-reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengirim email reset password.');
        return;
      }
      toast.success(data.message || 'Link reset password berhasil dikirim.');
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleDirectPasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 6) {
      toast.warning('Password baru minimal harus 6 karakter.');
      return;
    }

    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengubah password.');
        return;
      }
      toast.success('Password pengguna berhasil diubah.');
      setNewPassword('');
      onUserUpdated(data.user);
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Putus tautan Google OAuth untuk akun ini? Pengguna akan diharuskan login dengan email/password.')) {
      return;
    }
    setUpdatingSecurity(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlinkGoogle: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal memutus tautan Google.');
        return;
      }
      toast.success('Tautan akun Google berhasil dilepas.');
      onUserUpdated(data.user);
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setUpdatingSecurity(false);
    }
  };

  return (
    <div>
      {/* KPI Activity Banner */}
      <div className={styles.overviewStatsBanner}>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Total Belanja</span>
          <span className={styles.statItemVal}>{formatIDR(summary.totalSpent || 0)}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Pesanan Selesai</span>
          <span className={styles.statItemVal}>
            {summary.completedOrdersCount || 0} / {summary.totalOrders || 0}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Buku Alamat</span>
          <span className={styles.statItemVal}>{summary.addressesCount || 0} Alamat</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statItemLabel}>Sesi Chat</span>
          <span className={styles.statItemVal}>{summary.conversationsCount || 0} Obrolan</span>
        </div>
      </div>

      {/* Identitas & Profil Form */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Informasi Profil & Kontak
          </h3>
        </div>

        <form onSubmit={handleProfileSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Nama Lengkap *</label>
              <input
                type="text"
                className={styles.formInput}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Alamat Email *</label>
              <input
                type="email"
                className={styles.formInput}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Nomor Telepon / WhatsApp</label>
              <input
                type="tel"
                className={styles.formInput}
                placeholder="Contoh: 081234567890"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Foto Profil (Avatar URL)</label>
              <input
                type="url"
                className={styles.formInput}
                placeholder="https://..."
                value={form.avatarUrl}
                onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              />
            </div>

            <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
              <label className={styles.inputLabel}>Alamat Jalan / Tempat Tinggal</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Jl. Nama Jalan No. XX"
                value={form.streetAddress}
                onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>RT / RW</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="001/002"
                value={form.rtRw}
                onChange={(e) => setForm({ ...form, rtRw: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Kelurahan / Desa</label>
              <input
                type="text"
                className={styles.formInput}
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Kecamatan</label>
              <input
                type="text"
                className={styles.formInput}
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Kota / Kabupaten</label>
              <input
                type="text"
                className={styles.formInput}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Provinsi</label>
              <input
                type="text"
                className={styles.formInput}
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Kode Pos (5 Digit)</label>
              <input
                type="text"
                maxLength={5}
                className={styles.formInput}
                placeholder="12345"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className={styles.btnPrimarySolid} disabled={savingProfile}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
            </button>
          </div>
        </form>
      </div>

      {/* Kontrol Otoritas & Keamanan Akun */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Kontrol Akses & Keamanan Akun
          </h3>
        </div>

        {/* 1. Status Verifikasi WhatsApp (WA) */}
        <div className={styles.securityRow}>
          <div className={styles.securityRowLeft}>
            <div className={styles.securityRowTitle}>Verifikasi WhatsApp (WA)</div>
            <div className={styles.securityRowDesc}>
              {user.phoneVerified ? (
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  ✓ Nomor WhatsApp ({user.phone}) terverifikasi & aktif sejak{' '}
                  {new Date(user.phoneVerified).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              ) : user.phone ? (
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                  Nomor ({user.phone}) belum diverifikasi
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  Pengguna belum memiliki nomor WhatsApp terdaftar
                </span>
              )}
            </div>
          </div>
          <div className={styles.securityRowRight}>
            {user.phone && (
              <button
                type="button"
                className={user.phoneVerified ? styles.btnDangerSmall : styles.btnSuccessSmall}
                onClick={handleTogglePhoneVerification}
                disabled={updatingSecurity}
              >
                {user.phoneVerified ? 'Cabut Verifikasi WA' : 'Tandai WA Terverifikasi'}
              </button>
            )}
            {user.phone && (
              <a
                href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '').startsWith('0') ? '62' + user.phone.replace(/[^0-9]/g, '').slice(1) : user.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Halo ' + user.name + ', kami dari tim SUMDE BETTA ingin mengonfirmasi terkait nomor WhatsApp Anda.')}`}
                target="_blank"
                rel="noreferrer"
                className={styles.btnSecondarySmall}
                style={{ textDecoration: 'none' }}
              >
                Chat WA
              </a>
            )}
          </div>
        </div>

        {/* 2. Status Verifikasi Email */}
        <div className={styles.securityRow}>
          <div className={styles.securityRowLeft}>
            <div className={styles.securityRowTitle}>Status Verifikasi Email</div>
            <div className={styles.securityRowDesc}>
              {user.emailVerified ? (
                <span style={{ color: '#10B981', fontWeight: 600 }}>
                  Terverifikasi sejak{' '}
                  {new Date(user.emailVerified).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              ) : (
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>
                  Belum diverifikasi (User tidak dapat login sebelum verifikasi OTP)
                </span>
              )}
            </div>
          </div>
          <div className={styles.securityRowRight}>
            <button
              type="button"
              className={styles.btnSecondarySmall}
              onClick={handleToggleVerification}
              disabled={updatingSecurity}
            >
              {user.emailVerified ? 'Cabut Verifikasi' : 'Verifikasi Manual'}
            </button>
            {!user.emailVerified && (
              <button
                type="button"
                className={styles.btnSecondarySmall}
                onClick={handleSendVerificationOtp}
                disabled={updatingSecurity}
              >
                Kirim OTP
              </button>
            )}
          </div>
        </div>

        {/* 2. Password Pengguna */}
        <div className={styles.securityRow}>
          <div className={styles.securityRowLeft}>
            <div className={styles.securityRowTitle}>Kirim Link Reset Password</div>
            <div className={styles.securityRowDesc}>
              Kirim tautan aman via email agar pengguna dapat mengatur password baru secara mandiri.
            </div>
          </div>
          <div className={styles.securityRowRight}>
            <button
              type="button"
              className={styles.btnSecondarySmall}
              onClick={handleSendResetPassword}
              disabled={updatingSecurity}
            >
              Kirim Link Reset
            </button>
          </div>
        </div>

        {/* 3. Ganti Password Langsung oleh Admin */}
        <div className={styles.securityRow}>
          <div className={styles.securityRowLeft} style={{ flex: 1 }}>
            <div className={styles.securityRowTitle}>Atur Password Baru Langsung</div>
            <div className={styles.securityRowDesc}>
              Tetapkan password baru langsung untuk akun ini (berguna jika customer lupa dan butuh bantuan CS).
            </div>
            <form
              onSubmit={handleDirectPasswordChange}
              style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', maxWidth: '340px' }}
            >
              <input
                type="password"
                placeholder="Minimal 6 karakter..."
                className={styles.formInput}
                style={{ height: '32px', fontSize: '0.75rem', flex: 1 }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="submit"
                className={styles.btnSecondarySmall}
                disabled={updatingSecurity || !newPassword}
              >
                Terapkan
              </button>
            </form>
          </div>
        </div>

        {/* 4. Google OAuth */}
        {user.isGoogleLinked && (
          <div className={styles.securityRow}>
            <div className={styles.securityRowLeft}>
              <div className={styles.securityRowTitle}>Tautan Akun Google</div>
              <div className={styles.securityRowDesc}>
                Pengguna saat ini dapat masuk menggunakan akun Google ({user.email}).
              </div>
            </div>
            <div className={styles.securityRowRight}>
              <button
                type="button"
                className={styles.btnDangerSmall}
                onClick={handleUnlinkGoogle}
                disabled={updatingSecurity}
              >
                Putus Tautan Google
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
