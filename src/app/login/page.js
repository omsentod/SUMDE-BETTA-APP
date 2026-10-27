'use client';
import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GoogleSignInButton from '@/components/GoogleSignInButton';

function LoginPageInner() {
    const { currentUser, login } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Jika sudah login, redirect langsung ke dashboard yang sesuai
    useEffect(() => {
        if (currentUser) {
            const hasAdminAccess = currentUser.role === 'admin' || currentUser.canAccessAdmin || (Array.isArray(currentUser.permissions) && currentUser.permissions.length > 0);
            const nextParam = searchParams.get('next');
            const safeNext = nextParam && /^\/[a-zA-Z0-9/\-_?=&]*$/.test(nextParam) ? nextParam : null;

            if (safeNext && !(safeNext === '/customer/dashboard' && hasAdminAccess)) {
                router.replace(safeNext);
            } else {
                router.replace(hasAdminAccess ? '/admin/dashboard' : '/customer/dashboard');
            }
        }
    }, [currentUser, router, searchParams]);

    // Pesan error dari flow Google OAuth (redirect balik dari /callback dengan
    // ?googleError=...). Tampilkan di banner error.
    useEffect(() => {
        const gErr = searchParams.get('googleError');
        if (gErr) {
            const map = {
                state_mismatch: 'Sesi login Google kedaluwarsa. Coba lagi.',
                missing_params: 'Login Google terputus. Coba lagi.',
                access_denied: 'Kamu batalkan login Google.',
            };
            // eslint-disable-next-line react-hooks/set-state-in-effect -- read one-shot query param
            setError(map[gErr] || 'Login Google gagal: ' + gErr);
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            // Pengalihan halaman ditangani otomatis oleh effect di atas saat currentUser terisi
        } catch (err) {
            // Backend kirim code=EMAIL_NOT_VERIFIED kalau user harus verifikasi.
            // Redirect ke /verify-email dengan email prefill supaya user
            // tinggal masukkan OTP (atau klik "Kirim ulang").
            if (err.code === 'EMAIL_NOT_VERIFIED' && err.email) {
                router.push(`/verify-email?email=${encodeURIComponent(err.email)}`);
                return;
            }
            setError(err.message || 'Email atau password salah.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pageContainer auth-page-container">
            <div className="auth-card">
                <div className="auth-header">
                    <span className="auth-subtitle">
                        Welcome Back
                    </span>
                    <h1 className="auth-title">
                        Masuk Akun
                    </h1>
                </div>

                {error && (
                    <div className="auth-alert-error">
                        {error}
                    </div>
                )}

                <GoogleSignInButton next="/customer/dashboard" label="Masuk dengan Google" />

                <div className="auth-divider">atau login dengan email</div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div>
                        <label className="auth-label">
                            Email
                        </label>
                        <input
                            type="email"
                            className="search-input auth-input-full"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@email.com"
                            required
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="auth-label">Password</label>
                            <Link href="/forgot-password" className="auth-link" style={{ fontSize: '0.8rem' }}>
                                Lupa password?
                            </Link>
                        </div>
                        <input
                            type="password"
                            className="search-input auth-input-full"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan password Anda"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary auth-submit-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>

                <div className="auth-footer">
                    Belum punya akun?{' '}
                    <Link href="/register" className="auth-link">
                        Daftar Sekarang
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="pageContainer auth-page-container">
                <div className="auth-card">
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Memuat...</p>
                </div>
            </div>
        }>
            <LoginPageInner />
        </Suspense>
    );
}
