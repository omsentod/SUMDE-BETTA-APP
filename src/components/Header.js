'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';

export default function Header() {
    const { itemCount, toggleCart } = useCart();

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
                    <Link href="/produk">Produk</Link>
                    <Link href="/tentang">Partai</Link>
                    <Link href="/kontak">Kontak</Link>
                </nav>
                <div className="header-actions">
                    <button
                        onClick={toggleCart}
                        className="btn btn-outline"
                        style={{ padding: '0.6rem', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
