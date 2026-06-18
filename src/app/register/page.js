'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
            await register(name, email, password);
            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err) {
            setError(err.message || 'Registrasi gagal.');
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
                        Join Us
                    </span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontStyle: 'italic', marginTop: '0.5rem', color: 'var(--text-main)' }}>
                        Buat Akun
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

                {success && (
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(0,180,216,0.1)',
                        border: '1px solid var(--secondary)',
                        borderRadius: '8px',
                        color: 'var(--secondary)',
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        Registrasi berhasil! Mengalihkan ke login...
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
                            Nama Lengkap
                        </label>
                        <input
                            type="text"
                            className="search-input"
                            style={{ width: '100%', padding: '0.9rem' }}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ahmad Pratama"
                            required
                        />
                    </div>

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
                            placeholder="Minimal 6 karakter"
                            minLength={6}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
                            Konfirmasi Password
                        </label>
                        <input
                            type="password"
                            className="search-input"
                            style={{ width: '100%', padding: '0.9rem' }}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Masukkan ulang password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
                        disabled={isLoading || success}
                    >
                        {isLoading ? 'Memproses...' : 'Daftar'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Sudah punya akun?{' '}
                    <Link href="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'underline' }}>
                        Masuk Disini
                    </Link>
                </div>
            </div>
        </div>
    );
}
