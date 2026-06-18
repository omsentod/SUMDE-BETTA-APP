'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';

export default function ProductDetailClient() {
    const { id } = useParams();
    const router = useRouter();
    const { addToCart, buyNow, cart } = useCart();
    const { products, isLoading } = useProducts();
    const [selectedSize, setSelectedSize] = useState('');

    const product = products.find((p) => p.id === id);

    useEffect(() => {
        if (product && product.sizes && Array.isArray(product.sizes)) {
            const available = product.sizes.find(s => s.quantity > 0);
            if (available) {
                setSelectedSize(available.size);
            }
        }
    }, [product]);

    if (isLoading) {
        return (
            <div className="pageContainer" style={{ paddingTop: '90px', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem', color: 'var(--text-muted)' }}>Memuat Spesimen...</h2>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem' }}>Koleksi Tidak Ditemukan</h2>
                <Link href="/produk" className="btn btn-primary" style={{ marginTop: '2rem' }}>Kembali ke Galeri</Link>
            </div>
        );
    }

    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(product.price);

    const handleAcquire = () => {
        if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 && !selectedSize) {
            alert('Mohon pilih ukuran (size) terlebih dahulu.');
            return;
        }
        buyNow({ ...product, selectedSize });
        router.push('/checkout');
    };

    const handleAddToCart = () => {
        if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 && !selectedSize) {
            alert('Mohon pilih ukuran (size) terlebih dahulu.');
            return;
        }
        addToCart({ ...product, selectedSize });
    };

    return (
        <div className="product-detail-page">
            <section style={{ padding: '8rem 0' }}>
                <div className="container">
                    <div className="grid-detail-outer">

                        <div className="detail-visual">
                            <div className="detail-image-frame">
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
                                Edisi #{product.id.slice(0, 8).toUpperCase()} — {product.category}
                            </span>
                            <h1 className="detail-title">
                                {product.name}
                            </h1>
                            <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '3rem' }}>
                                {product.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginBottom: '4rem', padding: '2rem', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text-main)' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Grade Bentuk</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{product.statsForm || 'COMP'}</span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Umur</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{product.age || '4 Month'}</span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Gender</label>
                                    <span style={{ fontSize: '1.2rem', fontWeight: '600', textTransform: 'uppercase' }}>{product.gender || 'MALE'}</span>
                                </div>
                            </div>

                            {/* Size Selection Area */}
                            {product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0 && (
                                <div style={{ marginBottom: '3rem', color: 'var(--text-main)' }}>
                                    <h3 style={{ fontSize: '1.0rem', textTransform: 'uppercase', letterSpacing: '0.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Pilih Ukuran (Size)</h3>
                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                        {product.sizes.map((s) => {
                                            const isOutOfStock = s.quantity <= 0;
                                            const isSelected = selectedSize === s.size;
                                            return (
                                                <button
                                                    key={s.size}
                                                    disabled={isOutOfStock}
                                                    onClick={() => setSelectedSize(s.size)}
                                                    className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{
                                                        padding: '0.5rem 1.2rem',
                                                        borderRadius: '30px',
                                                        fontSize: '0.85rem',
                                                        opacity: isOutOfStock ? 0.3 : 1,
                                                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        minWidth: '80px'
                                                    }}
                                                >
                                                    <span style={{ fontWeight: '700' }}>{s.size}</span>
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                                        {isOutOfStock ? 'Habis' : `Stok: ${s.quantity}`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '2.5rem', fontWeight: '300', color: 'var(--text-main)', marginRight: '1rem' }}>{formattedPrice}</span>
                                {!product.isSold && product.quantity > 0 ? (
                                    <>
                                        <button
                                            onClick={handleAcquire}
                                            className="btn btn-primary"
                                            style={{ padding: '1rem 2.5rem', cursor: 'pointer', borderRadius: '30px' }}
                                        >
                                            Beli Sekarang
                                        </button>
                                        <button
                                            onClick={handleAddToCart}
                                            className="btn btn-outline"
                                            style={{ padding: '1rem 2rem', cursor: 'pointer', borderRadius: '30px' }}
                                        >
                                            Tambah ke Keranjang
                                        </button>
                                    </>
                                ) : (
                                    <span style={{ 
                                        padding: '0.8rem 2.5rem', 
                                        border: '1px solid var(--primary)', 
                                        color: 'var(--primary)', 
                                        fontFamily: 'var(--font-serif)', 
                                        fontSize: '1.1rem', 
                                        fontStyle: 'italic', 
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '30px'
                                    }}>
                                        Stok Habis / Terjual
                                    </span>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
