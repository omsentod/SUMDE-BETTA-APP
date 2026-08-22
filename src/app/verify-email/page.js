'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './verify-email.module.css';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const { setCurrentUser } = useAuth();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [status, setStatus] = useState({ kind: 'idle', message: '' });
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef([]);

  // Countdown 30 detik untuk tombol resend supaya user tidak spam kirim ulang.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const otp = digits.join('');

  const handleDigitChange = (idx, value) => {
    const clean = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setStatus({ kind: 'error', message: 'Masukkan 6 digit kode.' });
      return;
    }
    if (!email) {
      setStatus({ kind: 'error', message: 'Email tidak ditemukan di URL. Kembali ke halaman register.' });
      return;
    }

    setStatus({ kind: 'loading', message: '' });
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verifikasi gagal.');

      setStatus({ kind: 'success', message: 'Email terverifikasi. Mengarahkan ke dashboard...' });
      setCurrentUser(data);
      setTimeout(() => router.push('/customer/dashboard'), 1500);
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setStatus({ kind: 'idle', message: '' });
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal kirim ulang.');
      setStatus({ kind: 'success', message: data.message });
      setResendCooldown(60);
    } catch (err) {
      setStatus({ kind: 'error', message: err.message });
    }
  };

  return (
    <div className="pageContainer auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-subtitle">VERIFIKASI EMAIL</span>
          <h1 className="auth-title">Masukkan Kode</h1>
          <p className={styles.hint}>
            Kode 6 digit telah dikirim ke{' '}
            <span className={styles.emailBadge}>{email || 'email kamu'}</span>.
            Cek folder spam kalau tidak masuk inbox.
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

        <form onSubmit={handleSubmit}>
          <div className={styles.otpRow}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                className={styles.otpInput}
                autoComplete="one-time-code"
                disabled={status.kind === 'loading' || status.kind === 'success'}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            style={{ marginTop: '1rem' }}
            disabled={otp.length !== 6 || status.kind === 'loading' || status.kind === 'success'}
          >
            {status.kind === 'loading' ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </form>

        <div className={styles.resendBar}>
          Belum dapat email?
          <button
            type="button"
            onClick={handleResend}
            className={styles.resendBtn}
            disabled={resendCooldown > 0 || status.kind === 'loading' || status.kind === 'success'}
          >
            {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim ulang'}
          </button>
        </div>

        <div className="auth-footer">
          Salah email?{' '}
          <Link href="/register" className="auth-link">Daftar ulang</Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="pageContainer auth-page-container">
        <div className="auth-card">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Memuat...</p>
        </div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
