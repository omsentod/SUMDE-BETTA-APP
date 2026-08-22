'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ kind: 'idle', message: '' });

    if (password.length < 8) {
      setStatus({ kind: 'error', message: 'Password minimal 8 karakter.' });
      return;
    }
    if (password !== confirm) {
      setStatus({ kind: 'error', message: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setStatus({ kind: 'loading', message: '' });
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal reset password.');

      setStatus({
        kind: 'success',
        message: 'Password berhasil di-reset. Login dengan password baru dalam 3 detik...',
      });
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  };

  if (!token) {
    return (
      <div className="pageContainer auth-page-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Link Tidak Valid</h1>
          </div>
          <div className="auth-alert-error">
            Link reset password tidak lengkap. Pastikan kamu klik link dari email dengan benar.
          </div>
          <div className="auth-footer">
            <Link href="/forgot-password" className="auth-link">Minta ulang link reset</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageContainer auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-subtitle">SET PASSWORD BARU</span>
          <h1 className="auth-title">Reset Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Buat password baru untuk akun kamu.
          </p>
        </div>

        {status.kind === 'error' && (
          <div className="auth-alert-error">{status.message}</div>
        )}
        {status.kind === 'success' && (
          <div style={{
            background: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            border: '1px solid color-mix(in oklab, var(--status-success) 20%, transparent)',
          }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="auth-label" htmlFor="password">Password Baru</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="search-input auth-input-full"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={status.kind === 'loading' || status.kind === 'success'}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Minimal 8 karakter.
            </div>
          </div>

          <div>
            <label className="auth-label" htmlFor="confirm">Konfirmasi Password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="search-input auth-input-full"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={status.kind === 'loading' || status.kind === 'success'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={status.kind === 'loading' || status.kind === 'success'}
          >
            {status.kind === 'loading' ? 'Menyimpan...' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-footer">
          <Link href="/login" className="auth-link">Kembali ke Login</Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="pageContainer auth-page-container">
        <div className="auth-card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Memuat...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
