'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const user = await login(email, password);
            if (user.role === 'admin') {
                router.push('/admin/dashboard');
            } else {
                router.push('/customer/dashboard');
            }
        } catch (err) {
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
                        <label className="auth-label">
                            Password
                        </label>
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
