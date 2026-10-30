'use client';
import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ProductCard from "@/components/ProductCard";
import InteractiveBettaAquarium from "@/components/InteractiveBettaAquarium";
import ArtisticBettaEmpty from "@/components/ArtisticBettaEmpty";
import PokerCurvedShowcase from "@/components/PokerCurvedShowcase";
import { useProducts } from "@/context/ProductContext";
import styles from './home.module.css';

export default function CatalogHome() {
    const { products: allProducts, isLoading } = useProducts();
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    // Archived products are soft-deleted — kept for order-history integrity
    // but hidden from all public listings.
    const products = useMemo(() => allProducts.filter(p => !p.isArchived), [allProducts]);

    // Extract unique categories dynamically and find an image for each
    const categoriesWithImages = useMemo(() => {
        const list = [{ name: 'Semua', image: '/img/logo.png' }]; // Use logo for Semua

        const seen = new Set();
        products.forEach(p => {
            if (p.form && !seen.has(p.form.toLowerCase())) {
                seen.add(p.form.toLowerCase());
                list.push({
                    name: p.form,
                    image: p.image || '/img/betta-1.png'
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

    // Hottest drops are premium fish that are not sold (up to 7 for 3D curved poker stage)
    const hottestDrops = useMemo(() => {
        return products.filter(p => p.isPremium && !p.isSold).slice(0, 7);
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

    if (isLoading || eventsLoading) {
        return (
            <div className={styles.homeContainer}>
                <section className={`container ${styles.heroSection}`}>
                    <div className={`${styles.heroCarousel} skeleton-box`}>
                        <div className={styles.heroContent}>
                            <span className={styles.heroCurationTag}>SUMDE BETTA • EXCLUSIVES</span>
                            <h2 className={styles.heroTitle}>Memuat Koleksi Elit...</h2>
                        </div>
                    </div>
                </section>

                <section className={`container ${styles.categoriesSection}`}>
                    <div className={styles.categoriesContainer}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={styles.categoryCard}>
                                <div className={`${styles.categoryCircle} skeleton-box`} />
                            </div>
                        ))}
                    </div>
                </section>

                <section className="container">
                    <div className="productGrid">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={styles.skeletonCard}>
                                <div className={`skeleton-box ${styles.skeletonImage}`} />
                                <div className={styles.skeletonInfo}>
                                    <div className={`skeleton-box ${styles.skeletonTitle}`} />
                                    <div className={`skeleton-box ${styles.skeletonSub}`} />
                                    <div className={`skeleton-box ${styles.skeletonPrice}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className={styles.homeContainer}>
            {/* Cinematic Hero Carousel with Interactive Living Betta Aquarium */}
            <section className={`container ${styles.heroSection}`}>
                <div className={styles.heroCarousel}>
                    {/* Living Aquatic Canvas Overlay */}
                    <InteractiveBettaAquarium fishCount={1} />

                    {events.length > 0 ? (
                        <>
                            {events.map((event, idx) => {
                                const isActiveSlide = idx === currentSlide;
                                const isExternalUrl = event.targetUrl.startsWith('http://') || event.targetUrl.startsWith('https://');

                                return (
                                    <div
                                        key={event.id}
                                        className={`${styles.heroSlide} ${isActiveSlide ? styles.heroSlideActive : ''}`}
                                    >
                                        <Image
                                            src={event.image}
                                            alt={event.title}
                                            fill
                                            sizes="(max-width: 1400px) 100vw, 1400px"
                                            className={styles.heroBgImage}
                                            priority={idx === 0}
                                        />

                                        <div className={styles.heroOverlay} />

                                        <div className={styles.heroContent}>
                                            <div className={styles.heroCurationTag}>
                                                <span className={styles.heroCurationDot} />
                                                <span>{event.subtitle || 'PROMO KURASI FARM'}</span>
                                            </div>
                                            <h1 className={styles.heroTitle}>{event.title}</h1>
                                            <p className={styles.heroDescription}>{event.description}</p>

                                            <div className={styles.heroActionGroup}>
                                                {isExternalUrl ? (
                                                    <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" className={styles.heroPrimaryBtn}>
                                                        <span>{event.buttonText || 'Eksplorasi Event'}</span>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <line x1="5" y1="12" x2="19" y2="12" />
                                                            <polyline points="12 5 19 12 12 19" />
                                                        </svg>
                                                    </a>
                                                ) : (
                                                    <Link href={event.targetUrl} className={styles.heroPrimaryBtn}>
                                                        <span>{event.buttonText || 'Eksplorasi Event'}</span>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <line x1="5" y1="12" x2="19" y2="12" />
                                                            <polyline points="12 5 19 12 12 19" />
                                                        </svg>
                                                    </Link>
                                                )}
                                                <Link href="/produk" className={styles.heroSecondaryBtn}>
                                                    Semua Koleksi
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {events.length > 1 && (
                                <div className={styles.heroCarouselDots}>
                                    {events.map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setCurrentSlide(idx)}
                                            className={`${styles.heroDot} ${idx === currentSlide ? styles.heroDotActive : ''}`}
                                            aria-label={`Slide ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Fallback Banner */
                        <div className={`${styles.heroSlide} ${styles.heroSlideActive}`}>
                            <Image
                                src={featuredProduct ? featuredProduct.image : "/img/betta-2.png"}
                                alt={featuredProduct ? featuredProduct.name : "Featured Betta Splendens"}
                                fill
                                sizes="(max-width: 1400px) 100vw, 1400px"
                                className={styles.heroBgImage}
                                priority
                            />

                            <div className={styles.heroOverlay} />

                            <div className={styles.heroContent}>
                                <div className={styles.heroCurationTag}>
                                    <span className={styles.heroCurationDot} />
                                    <span>{featuredProduct ? "Koleksi Kurasi • 1 of 1" : "Karya Seni Hidup"}</span>
                                </div>
                                <h1 className={styles.heroTitle}>
                                    {featuredProduct ? (
                                        <>
                                            Karya Seni Akuatik<br />
                                            <span className={styles.heroTitleSerif}>{featuredProduct.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            Spesimen Seni Hidup<br />
                                            <span className={styles.heroTitleSerif}>Seri Koi &amp; Avatar</span>
                                        </>
                                    )}
                                </h1>
                                <p className={styles.heroDescription}>
                                    {featuredProduct
                                        ? featuredProduct.description
                                        : "Koleksi seleksi genetik unggulan dengan mutasi warna penuh. Setiap spesimen memiliki karakter dan keunikan visual tunggal."}
                                </p>
                                <div className={styles.heroActionGroup}>
                                    {featuredProduct ? (
                                        <Link href={`/produk/${featuredProduct.id}`} className={styles.heroPrimaryBtn}>
                                            <span>Detail Spesimen</span>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        </Link>
                                    ) : (
                                        <Link href="/produk" className={styles.heroPrimaryBtn}>
                                            <span>Jelajahi Galeri</span>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        </Link>
                                    )}
                                    <Link href="/produk?tab=premium" className={styles.heroSecondaryBtn}>
                                        Koleksi 1 of 1
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Quick Categories Selector */}
            <section className={`container ${styles.categoriesSection}`}>
                <div className={styles.categoriesContainer}>
                    {categoriesWithImages.map(cat => {
                        const isSelected = selectedCategory === cat.name;
                        return (
                            <div
                                key={cat.name}
                                onClick={() => setSelectedCategory(cat.name)}
                                className={styles.categoryCard}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        setSelectedCategory(cat.name);
                                    }
                                }}
                            >
                                <div className={`${styles.categoryCircle} ${isSelected ? styles.categoryCircleActive : ''}`}>
                                    <div className={styles.categoryImageWrapper}>
                                        <Image
                                            src={cat.image}
                                            alt={cat.name}
                                            fill
                                            sizes="80px"
                                            className={styles.categoryImage}
                                        />
                                    </div>
                                </div>
                                <span className={`${styles.categoryName} ${isSelected ? styles.categoryNameActive : ''}`}>
                                    {cat.name}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Special Curated Premium Showcase Section (3D Curved Poker Arc Showcase) */}
            {selectedCategory === 'Semua' && hottestDrops.length > 0 && (
                <PokerCurvedShowcase products={hottestDrops} />
            )}

            {/* Main Listings Grid */}
            <section className={`container ${styles.mainListingsSection}`}>
                <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleGroup}>
                        <h2 className={styles.sectionTitle}>
                            {selectedCategory === 'Semua' ? 'Katalog Seluruh Spesimen' : `Kategori ${selectedCategory}`}
                        </h2>
                        <p className={styles.sectionSubtitle}>
                            Menampilkan {filteredProducts.length} spesimen aktif siap diadopsi
                        </p>
                    </div>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="productGrid">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} {...product} />
                        ))}
                    </div>
                ) : (
                    <ArtisticBettaEmpty
                        title={`Belum Ada Spesimen ${selectedCategory}`}
                        description="Belum ada ikan cupang untuk kategori ini saat ini. Eksplorasi kategori lainnya atau periksa kembali nanti."
                        actionText="Tampilkan Semua Spesimen"
                        onAction={() => setSelectedCategory('Semua')}
                    />
                )}
            </section>
        </div>
    );
}
