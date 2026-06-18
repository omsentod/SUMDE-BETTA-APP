'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

function ThemeIcon({ theme }) {
    return theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    );
}

function CartIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
    );
}

export default function Header() {
    const { itemCount, toggleCart } = useCart();
    const { theme, toggleTheme } = useTheme();
    const { currentUser, logout } = useAuth();

    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    const closeMenu = () => setMenuOpen(false);

    // Close profile dropdown on outside click
    useEffect(() => {
        const handleOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const initials = currentUser
        ? currentUser.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : '';

    const isAdmin = currentUser?.role === 'admin';
    const isCustomer = currentUser?.role === 'customer';

    return (
        <>
            <header className="header">
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>

                    {/* Logo */}
                    <Link href="/" className="logo-link">
                        <Image src="/logo.png" alt="Sumde Betta Logo" width={44} height={44} className="logo-img" />
                        <div className="logo-text">SUMDE <span className="logo-highlight">BETTA</span></div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="nav-links">
                        <Link href="/">Beranda</Link>
                        <Link href="/produk">Produk</Link>
                        <Link href="/event">Event</Link>
                        <Link href="/tentang">Tentang Kami</Link>
                    </nav>

                    {/* Desktop Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="header-action-btn hide-on-mobile"
                            aria-label="Toggle Theme"
                        >
                            <ThemeIcon theme={theme} />
                        </button>

                        {/* Cart */}
                        <button
                            onClick={toggleCart}
                            className="header-action-btn"
                            aria-label="Keranjang Belanja"
                        >
                            <CartIcon />
                            {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
                        </button>

                        {/* Auth: Profile dropdown or Masuk */}
                        {currentUser ? (
                            <div className="profile-menu-wrapper hide-on-mobile" ref={profileRef}>
                                <button
                                    className="profile-avatar-btn"
                                    onClick={() => setProfileOpen(prev => !prev)}
                                    aria-label="Menu profil"
                                    title={currentUser.name}
                                >
                                    {initials}
                                </button>

                                <div className={`profile-dropdown${profileOpen ? ' open' : ''}`}>
                                    <div className="profile-dropdown-header">
                                        <div className="profile-dropdown-name">{currentUser.name}</div>
                                        <div className="profile-dropdown-role">{currentUser.role}</div>
                                    </div>

                                    {isCustomer && (
                                        <>
                                            <Link href="/customer/dashboard" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                Edit Profil
                                            </Link>
                                            <Link href="/customer/addresses" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                Alamat Saya
                                            </Link>
                                            <Link href="/customer/orders" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                                Pesanan Saya
                                            </Link>
                                        </>
                                    )}

                                    {isAdmin && (
                                        <Link href="/admin/dashboard" className="profile-dropdown-item" onClick={() => setProfileOpen(false)}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                                            Admin Dashboard
                                        </Link>
                                    )}

                                    <div className="profile-dropdown-divider" />

                                    <button
                                        className="profile-dropdown-item profile-dropdown-logout"
                                        onClick={() => { logout(); setProfileOpen(false); }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Link href="/login" className="btn btn-primary hide-on-mobile" style={{ padding: '0.5rem 1.5rem', fontSize: '0.8rem', borderRadius: '8px' }}>
                                Masuk
                            </Link>
                        )}

                        {/* Hamburger (mobile only) */}
                        <button className="header-action-btn mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Buka Menu">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Nav Overlay */}
            <div className={`mobile-nav-overlay${menuOpen ? ' open' : ''}`}>
                <div className="mobile-nav-header">
                    <Link href="/" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Image src="/logo.png" alt="Logo" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                        <div className="logo-text">SUMDE <span className="logo-highlight">BETTA</span></div>
                    </Link>
                    <button onClick={closeMenu} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '0.5rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <nav className="mobile-nav-links">
                    <Link href="/" className="mobile-nav-link" onClick={closeMenu}>Beranda</Link>
                    <Link href="/produk" className="mobile-nav-link" onClick={closeMenu}>Produk</Link>
                    <Link href="/event" className="mobile-nav-link" onClick={closeMenu}>Event</Link>
                    <Link href="/tentang" className="mobile-nav-link" onClick={closeMenu}>Tentang Kami</Link>
                    {isCustomer && (
                        <>
                            <Link href="/customer/dashboard" className="mobile-nav-link" onClick={closeMenu}>Edit Profil</Link>
                            <Link href="/customer/addresses" className="mobile-nav-link" onClick={closeMenu}>Alamat Saya</Link>
                            <Link href="/customer/orders" className="mobile-nav-link" onClick={closeMenu}>Pesanan Saya</Link>
                        </>
                    )}
                    {isAdmin && (
                        <Link href="/admin/dashboard" className="mobile-nav-link" onClick={closeMenu} style={{ color: 'var(--primary)' }}>Admin Dashboard</Link>
                    )}
                </nav>

                <div className="mobile-nav-actions">
                    {currentUser ? (
                        <button onClick={() => { logout(); closeMenu(); }} className="btn btn-outline" style={{ flex: 1, cursor: 'pointer' }}>
                            Logout
                        </button>
                    ) : (
                        <Link href="/login" className="btn btn-primary" onClick={closeMenu} style={{ flex: 1, textAlign: 'center' }}>
                            Masuk
                        </Link>
                    )}
                    <button onClick={toggleTheme} className="btn btn-outline" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Toggle Theme">
                        <ThemeIcon theme={theme} />
                    </button>
                    <button onClick={() => { toggleCart(); closeMenu(); }} className="btn btn-outline" style={{ padding: '0.75rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <CartIcon />
                        {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
                    </button>
                </div>
            </div>
        </>
    );
}
