'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './password.module.css';

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

export default function ChangePasswordPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (form.newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('Password baru harus berbeda dari password lama.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah password.');

      setSuccess('Password berhasil diubah.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !currentUser) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Memverifikasi akun...</p>
      </div>
    );
  }

  // User yang daftar via Google tidak punya password di sistem kita.
  // Suruh mereka manage password lewat Google Account, bukan di sini.
  if (currentUser.hasPassword === false) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Ubah Password</h1>
          <p className={styles.subtitle}>
            Akun kamu login lewat Google. Kelola password di{' '}
            <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
              Google Account Settings
            </a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Ubah Password</h1>
        <p className={styles.subtitle}>Untuk keamanan akun, ganti password secara berkala.</p>
      </div>

      <form className={styles.card} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="currentPassword">Password Saat Ini</label>
          <div className={styles.inputWrap}>
            <input
              id="currentPassword"
              className={styles.input}
              type={show.current ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              onClick={() => setShow({ ...show, current: !show.current })}
              aria-label={show.current ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              <EyeIcon open={show.current} />
            </button>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="newPassword">Password Baru</label>
          <div className={styles.inputWrap}>
            <input
              id="newPassword"
              className={styles.input}
              type={show.next ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              autoComplete="new-password"
              required
              minLength={8}
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              onClick={() => setShow({ ...show, next: !show.next })}
              aria-label={show.next ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              <EyeIcon open={show.next} />
            </button>
          </div>
          <div className={styles.hint}>Minimal 8 karakter. Gunakan kombinasi huruf besar, kecil, angka.</div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="confirmPassword">Konfirmasi Password Baru</label>
          <div className={styles.inputWrap}>
            <input
              id="confirmPassword"
              className={styles.input}
              type={show.confirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              autoComplete="new-password"
              required
              minLength={8}
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              onClick={() => setShow({ ...show, confirm: !show.confirm })}
              aria-label={show.confirm ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              <EyeIcon open={show.confirm} />
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/customer/dashboard" className={styles.cancel}>Batal</Link>
          <button type="submit" className={styles.submit} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Ubah Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
