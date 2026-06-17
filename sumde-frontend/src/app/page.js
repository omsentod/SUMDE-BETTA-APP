'use client';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/context/ProductContext";

const CATEGORIES = ['Semua', 'Plakat', 'Halfmoon', 'Crowntail', 'Giant'];

export default function CatalogHome() {
    const { products, isLoading } = useProducts();
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    // Filter products based on category tab
    const filteredProducts = useMemo(() => {
        if (selectedCategory === 'Semua') {
            return products;
        }
        return products.filter(p => p.form.toLowerCase() === selectedCategory.toLowerCase());
    }, [selectedCategory, products]);

    // Hottest drops are premium fish that are not sold
    const hottestDrops = useMemo(() => {
        return products.filter(p => p.isPremium && !p.isSold).slice(0, 4);
    }, [products]);

    if (isLoading) {
        return (
            <div className="pageContainer" style={{ paddingTop: '90px', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem', color: 'var(--text-muted)' }}>Memuat Koleksi Elit...</h2>
            </div>
        );
    }

    return (
        <div className="pageContainer" style={{ paddingTop: '90px' }}>
            {/* Minimalist Premium Banner */}
            <section className="promo-banner-section container" style={{ margin: '2rem auto' }}>
                <div className="promo-banner" style={{
                    position: 'relative',
                    height: '400px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(255,107,53,0.05) 100%)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '3rem'
                }}>
                    <div style={{ zIndex: 2, maxWidth: '50%' }}>
                        <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                            Limited Drops
                        </span>
                        <h1 style={{ fontSize: '3rem', fontFamily: 'var(--font-serif)', fontStyle: 'italic', margin: '1rem 0 1.5rem 0', lineHeight: 1.2 }}>
                            Acquire the Rarest <br/>
                            <span className="text-gradient">Koi Galaxy Series</span>
                        </h1>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                            Koleksi eksklusif hasil seleksi genetik terbaik dengan mutasi warna nebula penuh. Hanya untuk kolektor sejati.
                        </p>
                        <Link href="/produk/2" className="btn btn-primary">Lihat Detail Drop</Link>
                    </div>
                    {/* Floating fish background */}
                    <div className="banner-image-wrapper" style={{
                        position: 'absolute',
                        right: '5%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '450px',
                        height: '450px',
                        pointerEvents: 'none'
                    }}>
                        <Image
                            src="/betta-2.png"
                            alt="Featured Koi Galaxy"
                            fill
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </div>
                </div>
            </section>

            {/* Quick Categories Selector */}
            <section className="categories-tabs-section container" style={{ margin: '3rem auto' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                            style={{
                                padding: '0.75rem 2rem',
                                borderRadius: '30px',
                                textTransform: 'uppercase',
                                fontSize: '0.8rem',
                                letterSpacing: '0.1rem'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </section>

            {/* Hottest Drops Section */}
            {selectedCategory === 'Semua' && hottestDrops.length > 0 && (
                <section className="hottest-drops-section container" style={{ margin: '4rem auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem' }}>Hottest Drops</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1rem' }}>Ikan Pilihan Kurator Terpopuler</p>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>Updated 24 hours ago</span>
                    </div>

                    <div className="productGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                        {hottestDrops.map(product => (
                            <ProductCard key={product.id} {...product} />
                        ))}
                    </div>
                </section>
            )}

            {/* Main Listings Grid */}
            <section className="main-listings-section container" style={{ margin: '5rem auto' }}>
                <div style={{ marginBottom: '3rem' }}>
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {selectedCategory === 'Semua' ? 'Semua Rilis' : `${selectedCategory} Collection`}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1rem' }}>
                        Menampilkan {filteredProducts.length} spesimen aktif
                    </p>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="productGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} {...product} />
                        ))}
                    </div>
                ) : (
                    <div className="emptyState" style={{ padding: '6rem 2rem', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: '16px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐟</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tidak ada spesimen</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Belum ada ikan cupang untuk kategori ini.</p>
                        <button onClick={() => setSelectedCategory('Semua')} className="btn btn-outline">Lihat Semua Kategori</button>
                    </div>
                )}
            </section>
        </div>
    );
}
