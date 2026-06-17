'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
    const { itemCount, toggleCart } = useCart();
    const { theme, toggleTheme } = useTheme();
    const { currentUser, logout } = useAuth();

    return (
        <header className="header">
            <div className="container flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Link href="/" className="logo-link" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Image
                        src="/logo.png"
                        alt="Sumde Betta Logo"
                        width={50}
                        height={50}
                        style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div className="logo-text">
                        SUMDE <span className="logo-highlight">BETTA</span>
                    </div>
                </Link>
                <nav className="nav-links">
                    <Link href="/">Beranda</Link>
                    <Link href="/produk">PRODUK</Link>
                    <Link href="/tentang">Tentang Kami</Link>
                    {currentUser && currentUser.role === 'admin' && (
                        <Link href="/admin/dashboard" style={{ color: 'var(--primary)', fontWeight: '700' }}>Admin Dashboard</Link>
                    )}
                    {currentUser && currentUser.role === 'customer' && (
                        <Link href="/customer/dashboard" style={{ color: 'var(--secondary)', fontWeight: '700' }}>Dashboard Saya</Link>
                    )}
                </nav>
                <div className="header-actions" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                    {currentUser ? (
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>
                                Halo, <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{currentUser.name.split(' ')[0]}</span>
                            </span>
                            <button
                                onClick={logout}
                                className="btn btn-outline"
                                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', height: '35px', borderRadius: '6px', cursor: 'pointer' }}
                            >
                                Keluar
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                            Masuk
                        </Link>
                    )}

                    <button
                        onClick={toggleTheme}
                        className="btn btn-outline"
                        style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '40px', cursor: 'pointer' }}
                        aria-label="Toggle Theme"
                    >
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5"></circle>
                                <line x1="12" y1="1" x2="12" y2="3"></line>
                                <line x1="12" y1="21" x2="12" y2="23"></line>
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                                <line x1="1" y1="12" x2="3" y2="12"></line>
                                <line x1="21" y1="12" x2="23" y2="12"></line>
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={toggleCart}
                        className="btn btn-outline"
                        style={{ padding: '0.6rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '40px', cursor: 'pointer' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1"></circle>
                            <circle cx="20" cy="21" r="1"></circle>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                        </svg>
                        {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
                    </button>
                </div>
            </div>
        </header>
    );
}
