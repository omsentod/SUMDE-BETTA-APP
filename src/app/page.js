'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/context/ProductContext";

export default function CatalogHome() {
    const { products, isLoading } = useProducts();
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    // Extract unique categories dynamically and find an image for each
    const categoriesWithImages = useMemo(() => {
        const list = [{ name: 'Semua', image: '/logo.png' }]; // Use logo for Semua
        
        const seen = new Set();
        products.forEach(p => {
            if (p.form && !seen.has(p.form.toLowerCase())) {
                seen.add(p.form.toLowerCase());
                list.push({
                    name: p.form,
                    image: p.image || '/betta-1.png'
                });
            }
        });
        
        return list;
    }, [products]);

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

    // Ambil produk premium pertama untuk fallback hero banner jika tidak ada event
    const featuredProduct = useMemo(() => {
        return hottestDrops[0] || products.find(p => !p.isSold) || null;
    }, [hottestDrops, products]);

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);

    // Fetch active events for the homepage carousel
    useEffect(() => {
        const fetchActiveEvents = async () => {
            try {
                const res = await fetch('/api/events?active=true');
                if (res.ok) {
                    const data = await res.json();
                    setEvents(data);
                }
            } catch (err) {
                console.error('Gagal memuat event aktif:', err);
            } finally {
                setEventsLoading(false);
            }
        };
        fetchActiveEvents();
    }, []);

    // Autoplay carousel
    useEffect(() => {
        if (events.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % events.length);
        }, 6000); // Ganti slide setiap 6 detik
        return () => clearInterval(interval);
    }, [events]);

    if (isLoading) {
        return (
            <div className="pageContainer" style={{ paddingTop: '90px', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '2rem', color: 'var(--text-muted)' }}>Memuat Koleksi Elit...</h2>
            </div>
        );
    }

    return (
        <div className="pageContainer" style={{ paddingTop: '90px' }}>
            <section className="container" style={{ margin: '2rem auto' }}>
                {!eventsLoading && events.length > 0 ? (
                    <div className="hero-carousel-section">
                        {events.map((event, idx) => {
                            const isActiveSlide = idx === currentSlide;
                            const isExternalUrl = event.targetUrl.startsWith('http://') || event.targetUrl.startsWith('https://');

                            return (
                                <div
                                    key={event.id}
                                    className={`hero-slide ${isActiveSlide ? 'hero-slide-active' : ''}`}
                                >
                                    {/* Background Image */}
                                    <Image
                                        src={event.image}
                                        alt={event.title}
                                        fill
                                        sizes="(max-width: 1400px) 100vw, 1400px"
                                        className="hero-bg-image"
                                        priority={idx === 0}
                                    />
                                    
                                    {/* Dark Overlay for Text Readability */}
                                    <div className="hero-overlay"></div>

                                    {/* Centered Overlay Content */}
                                    <div className="hero-content">
                                        <span className="sub-title">
                                            {event.subtitle || 'PROMO EVENT'}
                                        </span>
                                        <h1>{event.title}</h1>
                                        <p>{event.description}</p>
                                        
                                        {isExternalUrl ? (
                                            <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-block', margin: '0 auto' }}>
                                                {event.buttonText || 'LIHAT EVENT'}
                                            </a>
                                        ) : (
                                            <Link href={event.targetUrl} className="btn btn-primary" style={{ display: 'inline-block', margin: '0 auto' }}>
                                                {event.buttonText || 'LIHAT EVENT'}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Carousel Indicators (Dots) */}
                        {events.length > 1 && (
                            <div className="hero-carousel-dots">
                                {events.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlide(idx)}
                                        className={`hero-dot ${idx === currentSlide ? 'hero-dot-active' : ''}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Fallback ke Featured Premium Product Banner jika event kosong atau loading */
                    <div className="hero-carousel-section">
                        <div className="hero-slide hero-slide-active">
                            {/* Background Image */}
                            <Image
                                src={featuredProduct ? featuredProduct.image : "/betta-2.png"}
                                alt={featuredProduct ? featuredProduct.name : "Featured Koi Galaxy"}
                                fill
                                sizes="(max-width: 1400px) 100vw, 1400px"
                                className="hero-bg-image"
                                priority
                            />
                            
                            {/* Dark Overlay for Text Readability */}
                            <div className="hero-overlay"></div>

                            {/* Centered Overlay Content */}
                            <div className="hero-content">
                                <span className="sub-title">
                                    {featuredProduct ? "PREMIUM DROP" : "LIMITED DROPS"}
                                </span>
                                <h1>
                                    {featuredProduct ? (
                                        <>
                                            Acquire the Rarest<br/>
                                            <span className="text-gradient">{featuredProduct.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            Acquire the Rarest<br/>
                                            <span className="text-gradient">Koi Galaxy Series</span>
                                        </>
                                    )}
                                </h1>
                                <p>
                                    {featuredProduct ? featuredProduct.description : "Koleksi eksklusif hasil seleksi genetik terbaik dengan mutasi warna nebula penuh. Hanya untuk kolektor sejati."}
                                </p>
                                {featuredProduct ? (
                                    <Link href={`/produk/${featuredProduct.id}`} className="btn btn-primary" style={{ display: 'inline-block', margin: '0 auto' }}>
                                        LIHAT DETAIL DROP
                                    </Link>
                                ) : (
                                    <Link href="/produk" className="btn btn-primary" style={{ display: 'inline-block', margin: '0 auto' }}>
                                        LIHAT KOLEKSI
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Quick Categories Selector */}
            <section className="categories-tabs-section container" style={{ margin: '3rem auto' }}>
                <div style={{ 
                    display: 'flex', 
                    gap: '2.5rem', 
                    flexWrap: 'wrap', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)', 
                    paddingBottom: '2.5rem' 
                }}>
                    {categoriesWithImages.map(cat => (
                        <div
                            key={cat.name}
                            onClick={() => setSelectedCategory(cat.name)}
                            className="category-card"
                        >
                            <div 
                                className="category-circle"
                                style={{
                                    background: selectedCategory === cat.name ? 'linear-gradient(135deg, var(--primary), var(--secondary))' : 'var(--glass-border)',
                                    boxShadow: selectedCategory === cat.name ? '0 0 25px var(--primary-glow)' : 'none',
                                    transform: selectedCategory === cat.name ? 'scale(1.08)' : 'scale(1)'
                                }}
                            >
                                <div className="category-image-container">
                                    <Image
                                        src={cat.image}
                                        alt={cat.name}
                                        fill
                                        sizes="100px"
                                        className="category-image"
                                        priority
                                    />
                                </div>
                            </div>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: selectedCategory === cat.name ? '700' : '500',
                                color: selectedCategory === cat.name ? 'var(--primary)' : 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1rem',
                                transition: 'color 0.3s'
                            }}>
                                {cat.name}
                            </span>
                        </div>
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
