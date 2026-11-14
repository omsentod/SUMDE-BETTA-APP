'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import styles from './dashboard.module.css';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function validateName(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Nama lengkap wajib diisi.';
  if (trimmed.length < 2) return 'Nama lengkap minimal 2 karakter.';
  return '';
}

function validatePhone(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^[0-9+\-\s()]+$/.test(trimmed)) {
    return 'Nomor telepon hanya boleh berisi angka dan tanda + atau -.';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return 'Nomor telepon harus terdiri dari 8–15 digit.';
  }
  return '';
}

function DashboardSkeleton() {
  return (
    <div className={styles.panel} aria-busy="true" aria-label="Memuat profil akun">
      <div className={styles.panelHeader}>
        <div className={`skeleton-box ${styles.skeletonTitle}`} />
        <div className={`skeleton-box ${styles.skeletonSubtitle}`} />
      </div>

      <div className={styles.overviewGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.overviewCard}>
            <div className={`skeleton-box ${styles.skeletonStatLabel}`} />
            <div className={`skeleton-box ${styles.skeletonStatVal}`} />
            <div className={`skeleton-box ${styles.skeletonStatMeta}`} />
          </div>
        ))}
      </div>

      <div className={styles.profileCard}>
        <div className={styles.cardHeader}>
          <div className={`skeleton-box ${styles.skeletonCardTitle}`} />
        </div>
        <div className={styles.formGroup}>
          <div>
            <div className={`skeleton-box ${styles.skeletonLabel}`} />
            <div className={`skeleton-box ${styles.skeletonInput}`} />
          </div>
          <div className={styles.formRow}>
            <div>
              <div className={`skeleton-box ${styles.skeletonLabel}`} />
              <div className={`skeleton-box ${styles.skeletonInput}`} />
            </div>
            <div>
              <div className={`skeleton-box ${styles.skeletonLabel}`} />
              <div className={`skeleton-box ${styles.skeletonInput}`} />
            </div>
          </div>
          <div className={styles.formActions}>
            <div className={`skeleton-box ${styles.skeletonBtn}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const {
    currentUser,
    isLoading: authLoading,
    updateUserProfile,
    uploadAvatar,
    removeAvatar,
    fetchMyOrders,
    fetchMyAddresses,
  } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({ name: '', phone: '' });
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [stats, setStats] = useState({ orders: null, addresses: null });
  const successTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate form with user profile when loaded
      setForm({ name: currentUser.name || '', phone: currentUser.phone || '' });
    } else if (!authLoading) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    Promise.all([fetchMyOrders(), fetchMyAddresses()])
      .then(([ordersList, addressesList]) => {
        if (cancelled) return;
        setStats({
          orders: Array.isArray(ordersList) ? ordersList.length : 0,
          addresses: Array.isArray(addressesList) ? addressesList.length : 0,
        });
      })
      .catch(() => {
        if (!cancelled) setStats({ orders: 0, addresses: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, fetchMyOrders, fetchMyAddresses]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleNameChange = (e) => {
    const value = e.target.value;
    setForm((p) => ({ ...p, name: value }));
    if (fieldErrors.name) {
      setFieldErrors((p) => ({ ...p, name: validateName(value) }));
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setForm((p) => ({ ...p, phone: value }));
    if (fieldErrors.phone) {
      setFieldErrors((p) => ({ ...p, phone: validatePhone(value) }));
    }
  };

  const handleBlur = (field) => {
    if (field === 'name') {
      setFieldErrors((p) => ({ ...p, name: validateName(form.name) }));
    } else if (field === 'phone') {
      setFieldErrors((p) => ({ ...p, phone: validatePhone(form.phone) }));
    }
  };

  const showSuccess = (message) => {
    setSuccessMsg(message);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setSuccessMsg('');

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError('Format foto harus JPG, PNG, atau WEBP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Ukuran foto maksimal 2 MB.');
      return;
    }

    setAvatarBusy(true);
    try {
      await uploadAvatar(file);
      showSuccess('Foto profil berhasil diperbarui.');
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      } else {
        setError(err?.message || 'Gagal mengunggah foto profil.');
      }
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setError('');
    setSuccessMsg('');
    setAvatarBusy(true);
    try {
      await removeAvatar();
      showSuccess('Foto profil dihapus.');
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      } else {
        setError(err?.message || 'Gagal menghapus foto profil.');
      }
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nameErr = validateName(form.name);
    const phoneErr = validatePhone(form.phone);
    if (nameErr || phoneErr) {
      setFieldErrors({ name: nameErr, phone: phoneErr });
      return;
    }

    setSuccessMsg('');
    setError('');
    setSaving(true);
    try {
      await updateUserProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      showSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
      } else {
        setError(err?.message || 'Gagal menyimpan profil. Silakan coba lagi.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading && !currentUser) {
    return <DashboardSkeleton />;
  }
  if (!currentUser) return null;

  const isVerified = Boolean(currentUser.emailVerified);
  const authMethod =
    currentUser.hasGoogle && currentUser.hasPassword
      ? 'Email & Google'
      : currentUser.hasGoogle
        ? 'Akun Google'
        : 'Email & Password';

  return (
    <div className={styles.panel}>
      {/* Panel Header */}
      <div className={styles.panelHeader}>
        <h1 className={styles.pageTitle}>Profil Saya</h1>
        <p className={styles.pageSubtitle}>
          Kelola informasi akun dan kontak pengiriman Anda.
        </p>
      </div>

      {/* Ringkasan Akun */}
      <div className={styles.overviewGrid}>
        <Link href="/customer/orders" className={`${styles.overviewCard} ${styles.overviewCardInteractive}`}>
          <div className={styles.overviewTop}>
            <span className={styles.overviewLabel}>Pesanan Saya</span>
            <span className={styles.overviewIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </span>
          </div>
          <div className={styles.overviewValue}>
            {stats.orders === null ? '—' : `${stats.orders} Pesanan`}
          </div>
          <span className={styles.overviewMeta}>Lihat riwayat →</span>
        </Link>

        <Link href="/customer/addresses" className={`${styles.overviewCard} ${styles.overviewCardInteractive}`}>
          <div className={styles.overviewTop}>
            <span className={styles.overviewLabel}>Alamat Tersimpan</span>
            <span className={styles.overviewIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
          </div>
          <div className={styles.overviewValue}>
            {stats.addresses === null ? '—' : `${stats.addresses} Alamat`}
          </div>
          <span className={styles.overviewMeta}>Kelola alamat →</span>
        </Link>

        <div className={styles.overviewCard}>
          <div className={styles.overviewTop}>
            <span className={styles.overviewLabel}>Keamanan Akun</span>
            <span className={styles.overviewIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
          </div>
          <div className={styles.overviewValue}>
            {isVerified && (
              <span className={styles.verifiedIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
            <span>{isVerified ? 'Terverifikasi' : 'Belum Verifikasi'}</span>
          </div>
          <span className={styles.overviewMeta}>Masuk via {authMethod}</span>
        </div>
      </div>

      {/* Edit Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>Informasi Pribadi</h2>
            <p className={styles.cardSubtitle}>Data ini digunakan sebagai informasi penerima pada transaksi.</p>
          </div>
          <div className={styles.badgeWrapper}>
            <span className={isVerified ? styles.verifiedBadge : styles.unverifiedBadge}>
              {isVerified ? 'Email Terverifikasi' : 'Belum Terverifikasi'}
            </span>
            {!isVerified && currentUser?.email && (
              <Link
                href={`/verify-email?email=${encodeURIComponent(currentUser.email)}`}
                className={styles.verifyEmailLink}
              >
                Verifikasi Email
              </Link>
            )}
          </div>
        </div>

        {successMsg && (
          <div className={styles.successAlert} role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className={styles.errorAlert} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Foto Profil Section */}
        <div className={styles.avatarSection}>
          <UserAvatar user={currentUser} size="xl" />
          <div className={styles.avatarDetails}>
            <h3 className={styles.avatarTitle}>Foto Profil</h3>
            <p className={styles.avatarHint}>Format JPG, PNG, atau WEBP. Maksimal 2 MB.</p>
            <div className={styles.avatarActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.avatarInput}
                onChange={handleAvatarFileChange}
              />
              <button
                type="button"
                className={styles.avatarUploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy || saving}
              >
                {avatarBusy ? (
                  <span className={styles.btnSpinner} aria-hidden="true" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
                <span>{avatarBusy ? 'Memproses...' : currentUser.avatarUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
              </button>

              {currentUser.avatarUrl && (
                <button
                  type="button"
                  className={styles.avatarRemoveBtn}
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy || saving}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.formGroup} noValidate>
          <div className={styles.field}>
            <label htmlFor="profile-email" className={styles.label}>Email</label>
            <input
              id="profile-email"
              type="email"
              className={`${styles.input} ${styles.inputReadOnly}`}
              value={currentUser.email || ''}
              readOnly
              aria-describedby="profile-email-hint"
            />
            <span id="profile-email-hint" className={styles.hintText}>Email akun tidak dapat diubah</span>
          </div>

          <div className={styles.formRow}>
            <div className={styles.field}>
              <label htmlFor="profile-name" className={styles.label}>Nama Lengkap</label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                className={`${styles.input} ${fieldErrors.name ? styles.inputError : ''}`.trim()}
                value={form.name}
                onChange={handleNameChange}
                onBlur={() => handleBlur('name')}
                required
                placeholder="Nama lengkap kamu"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'profile-name-error' : undefined}
              />
              {fieldErrors.name && (
                <span id="profile-name-error" className={styles.fieldError} role="alert">
                  {fieldErrors.name}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-phone" className={styles.label}>Nomor Telepon</label>
              <input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={`${styles.input} ${fieldErrors.phone ? styles.inputError : ''}`.trim()}
                value={form.phone}
                onChange={handlePhoneChange}
                onBlur={() => handleBlur('phone')}
                placeholder="08xxxxxxxxxx"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'profile-phone-error' : 'profile-phone-hint'}
              />
              {fieldErrors.phone ? (
                <span id="profile-phone-error" className={styles.fieldError} role="alert">
                  {fieldErrors.phone}
                </span>
              ) : (
                <span id="profile-phone-hint" className={styles.hintText}>Opsional, digunakan untuk kontak pengiriman</span>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={saving}>
              {saving && <span className={styles.btnSpinner} aria-hidden="true" />}
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
