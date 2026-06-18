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
            {/* Minimalist Premium Banner / Multi-Event Carousel */}
            <section className="promo-banner-section container" style={{ margin: '2rem auto', position: 'relative' }}>
                {!eventsLoading && events.length > 0 ? (
                    <div className="promo-banner-carousel">
                        {events.map((event, idx) => {
                            const isActiveSlide = idx === currentSlide;
                            const isExternalUrl = event.targetUrl.startsWith('http://') || event.targetUrl.startsWith('https://');
                            
                            // Deteksi status waktu event untuk menampilkan label bantu jika diperlukan
                            const now = new Date();
                            const start = event.startDate ? new Date(event.startDate) : null;
                            const isUpcoming = start && start > now;

                            return (
                                <div
                                    key={event.id}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '3rem',
                                        opacity: isActiveSlide ? 1 : 0,
                                        zIndex: isActiveSlide ? 10 : 0,
                                        pointerEvents: isActiveSlide ? 'auto' : 'none',
                                        transform: isActiveSlide ? 'scale(1)' : 'scale(0.98)',
                                        transition: 'all 0.8s ease-in-out',
                                        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(255,107,53,0.04) 100%)'
                                    }}
                                >
                                    <div className="promo-banner-text" style={{ maxWidth: '55%' }}>
                                        <span style={{ color: isUpcoming ? '#3B82F6' : 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                            {isUpcoming ? 'Upcoming Event' : (event.subtitle || 'Active Promo')}
                                        </span>
                                        <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', margin: '1rem 0 1.2rem 0', lineHeight: 1.2, color: 'var(--text-main)' }}>
                                            {event.title}
                                        </h1>
                                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {event.description}
                                        </p>
                                        
                                        {isExternalUrl ? (
                                            <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                                {event.buttonText || 'Lihat Event'}
                                            </a>
                                        ) : (
                                            <Link href={event.targetUrl} className="btn btn-primary">
                                                {event.buttonText || 'Lihat Event'}
                                            </Link>
                                        )}
                                    </div>
                                    <div className="promo-banner-image">
                                        <Image
                                            src={event.image}
                                            alt={event.title}
                                            fill
                                            style={{ objectFit: 'contain' }}
                                            priority={idx === 0}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Carousel Indicators (Dots) */}
                        {events.length > 1 && (
                            <div style={{
                                position: 'absolute',
                                bottom: '1.5rem',
                                left: '3rem',
                                display: 'flex',
                                gap: '0.6rem',
                                zIndex: 30
                            }}>
                                {events.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlide(idx)}
                                        style={{
                                            width: idx === currentSlide ? '24px' : '8px',
                                            height: '8px',
                                            borderRadius: '4px',
                                            background: idx === currentSlide ? 'var(--primary)' : 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Fallback ke Featured Premium Product Banner jika event kosong atau loading */
                    <div className="promo-banner-root">
                        <div className="promo-banner-text">
                            <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                                {featuredProduct ? "Premium Drop" : "Limited Drops"}
                            </span>
                            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', margin: '1rem 0 1.5rem 0', lineHeight: 1.2 }}>
                                {featuredProduct ? (
                                    <>
                                        Acquire the Rarest <br/>
                                        <span className="text-gradient">{featuredProduct.name}</span>
                                    </>
                                ) : (
                                    <>
                                        Acquire the Rarest <br/>
                                        <span className="text-gradient">Koi Galaxy Series</span>
                                    </>
                                )}
                            </h1>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                                {featuredProduct ? featuredProduct.description : "Koleksi eksklusif hasil seleksi genetik terbaik dengan mutasi warna nebula penuh. Hanya untuk kolektor sejati."}
                            </p>
                            {featuredProduct ? (
                                <Link href={`/produk/${featuredProduct.id}`} className="btn btn-primary">Lihat Detail Drop</Link>
                            ) : (
                                <Link href="/produk" className="btn btn-primary">Lihat Koleksi</Link>
                            )}
                        </div>
                        <div className="promo-banner-image">
                            <Image
                                src={featuredProduct ? featuredProduct.image : "/betta-2.png"}
                                alt={featuredProduct ? featuredProduct.name : "Featured Koi Galaxy"}
                                fill
                                style={{ objectFit: 'contain' }}
                                priority
                              />
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
