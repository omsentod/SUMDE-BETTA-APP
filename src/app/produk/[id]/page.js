'use client';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { products } from '@/data/products';
import { useCart } from '@/context/CartContext';

export default function ProductDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { addToCart, cart } = useCart();

    const product = products.find((p) => p.id === id);

    if (!product) {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem' }}>Koleksi Tidak Ditemukan</h2>
                <Link href="/produk" className="btn btn-primary" style={{ marginTop: '2rem' }}>Kembali ke Galeri</Link>
            </div>
        );
    }

    const isInCart = cart.some((item) => item.id === product.id);

    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(product.price);

    const handleAcquire = () => {
        addToCart(product);
        router.push('/checkout');
    };

    return (
        <div className="product-detail-page">
            <section style={{ padding: '8rem 0' }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6rem', alignItems: 'start' }}>

                        <div className="detail-visual">
                            <div style={{ position: 'relative', height: '600px', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                                {product.isSold && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ padding: '1rem 3rem', border: '2px solid var(--primary)', color: 'var(--primary)', fontFamily: 'var(--font-serif)', fontSize: '2rem', fontStyle: 'italic', backdropFilter: 'blur(5px)' }}>
                                            Arsip
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="detail-info">
                            <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: '700' }}>
                                Edisi {product.id} — {product.category}
                            </span>
                            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '4.5rem', marginBottom: '1.5rem', lineHeight: '1' }}>
                                {product.name}
                            </h1>
                            <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8', marginBottom: '3rem' }}>
                                {product.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '4rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grade Bentuk</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{product.stats.form}</span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Intensitas Warna</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{product.stats.color}</span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Mental</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{product.stats.spirit}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: '300' }}>{formattedPrice}</span>
                                {!product.isSold && (
                                    <button
                                        onClick={handleAcquire}
                                        className="btn btn-primary"
                                        style={{ padding: '1.2rem 3rem' }}
                                        disabled={isInCart}
                                    >
                                        {isInCart ? 'Sudah Dipesan' : 'Akuisisi Spesimen'}
                                    </button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
