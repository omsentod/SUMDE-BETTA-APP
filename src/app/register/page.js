'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Password konfirmasi tidak cocok.');
            return;
        }

        setIsLoading(true);

        try {
            const data = await register(name, email, password);
            setSuccess(true);
            // Redirect ke /verify-email — email + OTP sudah dikirim di endpoint.
            const target = data?.email
                ? `/verify-email?email=${encodeURIComponent(data.email)}`
                : '/verify-email';
            setTimeout(() => router.push(target), 1200);
        } catch (err) {
            setError(err.message || 'Registrasi gagal.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pageContainer auth-page-container">
            <div className="auth-card">
                <div className="auth-header">
                    <span className="auth-subtitle">
                        Join Us
                    </span>
                    <h1 className="auth-title">
                        Buat Akun
                    </h1>
                </div>

                {error && (
                    <div className="auth-alert-error">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="auth-alert-success">
                        Registrasi berhasil! Mengarahkan ke halaman verifikasi email...
                    </div>
                )}

                <GoogleSignInButton next="/customer/dashboard" label="Daftar dengan Google" />

                <div className="auth-divider">atau daftar dengan email</div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div>
                        <label className="auth-label">
                            Nama Lengkap
                        </label>
                        <input
                            type="text"
                            className="search-input auth-input-full"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ahmad Pratama"
                            required
                        />
                    </div>

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
                            placeholder="Minimal 8 karakter"
                            minLength={8}
                            required
                        />
                    </div>

                    <div>
                        <label className="auth-label">
                            Konfirmasi Password
                        </label>
                        <input
                            type="password"
                            className="search-input auth-input-full"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Masukkan ulang password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary auth-submit-btn"
                        disabled={isLoading || success}
                    >
                        {isLoading ? 'Memproses...' : 'Daftar'}
                    </button>
                </form>

                <div className="auth-footer">
                    Sudah punya akun?{' '}
                    <Link href="/login" className="auth-link">
                        Masuk Disini
                    </Link>
                </div>
            </div>
        </div>
    );
}
