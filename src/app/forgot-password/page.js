'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ kind: 'loading', message: '' });
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses permintaan.');
      setStatus({ kind: 'success', message: data.message });
      setEmail('');
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  };

  return (
    <div className="pageContainer auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-subtitle">RESET AKSES</span>
          <h1 className="auth-title">Lupa Password</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Masukkan email akun kamu. Kami kirim link reset ke inbox.
          </p>
        </div>

        {status.kind === 'error' && (
          <div className="auth-alert-error">{status.message}</div>
        )}
        {status.kind === 'success' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10B981',
            padding: '0.75rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}>
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="search-input auth-input-full"
              placeholder="email@sumdebetta.com"
              autoComplete="email"
              required
              disabled={status.kind === 'loading' || status.kind === 'success'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={status.kind === 'loading' || status.kind === 'success'}
          >
            {status.kind === 'loading' ? 'Mengirim...' : 'Kirim Link Reset'}
          </button>
        </form>

        <div className="auth-footer">
          Ingat password lagi?{' '}
          <Link href="/login" className="auth-link">Kembali ke Login</Link>
        </div>
      </div>
    </div>
  );
}
