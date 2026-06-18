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
        <div className="pageContainer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
            <div style={{
                width: '100%',
                maxWidth: '450px',
                padding: '3rem',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                        Welcome Back
                    </span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontStyle: 'italic', marginTop: '0.5rem', color: 'var(--text-main)' }}>
                        Masuk Akun
                    </h1>
                </div>

                {error && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(255,107,53,0.1)',
                        border: '1px solid var(--primary)',
                        borderRadius: '8px',
                        color: 'var(--primary)',
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            className="search-input"
                            style={{ width: '100%', padding: '0.9rem' }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@email.com"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            className="search-input"
                            style={{ width: '100%', padding: '0.9rem' }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Masukkan password Anda"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Memproses...' : 'Masuk'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Belum punya akun?{' '}
                    <Link href="/register" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>
                        Daftar Sekarang
                    </Link>
                </div>
            </div>
        </div>
    );
}
