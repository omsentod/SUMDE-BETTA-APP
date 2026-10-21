'use client';
import { useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { getSimilarProducts } from '@/lib/recommendation';
import styles from './productDetail.module.css';

// Normalisasi galeri foto ke array URL yang aman ditampilkan. Prisma Json biasa
// sudah balik sebagai array, tapi tetap toleran kalau berupa string JSON. Kalau
// kosong, fallback ke cover tunggal (`image`) untuk produk lama.
function toImageArray(images, fallbackImage) {
    let arr = [];
    if (Array.isArray(images)) {
        arr = images;
    } else if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images);
            if (Array.isArray(parsed)) arr = parsed;
        } catch { /* ignore */ }
    }
    arr = arr.filter((u) => typeof u === 'string' && u);
    if (arr.length === 0 && fallbackImage) arr = [fallbackImage];
    return arr;
}

export default function ProductDetailClient() {
    const { id } = useParams();
    const router = useRouter();
    const { addToCart, buyNow } = useCart();
    const { products, isLoading } = useProducts();
    const [selectedSize, setSelectedSize] = useState('');
    const [sizeError, setSizeError] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [prevProductId, setPrevProductId] = useState(null);
    const touchStartX = useRef(null);

    const product = products.find((p) => p.id === id);

    // Algoritma Content-Based Recommendation: hitung produk dengan
    // karakteristik (form, corak warna, gender, harga, grade) paling serupa
    const similarProducts = useMemo(() => {
        if (!product || !products || products.length === 0) return [];
        return getSimilarProducts(product, products, 4);
    }, [product, products]);

    // Reset selected size + error whenever we're viewing a different product
    const variants = useMemo(() => {
        if (!product) return [];
        if (Array.isArray(product.variants) && product.variants.length > 0) return product.variants;
        if (Array.isArray(product.sizes) && product.sizes.length > 0) {
            return product.sizes.map((s) => ({ size: s.size, stock: s.quantity, price: null, imageUrl: null }));
        }
        return [];
    }, [product]);

    const activeVariant = useMemo(() => {
        return variants.find((v) => v.size === selectedSize) || null;
    }, [variants, selectedSize]);

    const currentPrice = useMemo(() => {
        if (activeVariant && activeVariant.price !== null && activeVariant.price !== undefined) {
            return activeVariant.price;
        }
        return product?.price || 0;
    }, [activeVariant, product]);

    if (product && product.id !== prevProductId) {
        setPrevProductId(product.id);
        const firstAvailable = variants.find((v) => (v.stock ?? v.quantity ?? 0) > 0)?.size || '';
        setSelectedSize(firstAvailable);
        setSizeError('');
        setActiveIndex(0);
    }

    const gallery = useMemo(() => {
        if (!product) return [];
        const base = toImageArray(product.images, product.image);
        variants.forEach((v) => {
            if (v.imageUrl && !base.includes(v.imageUrl)) {
                base.push(v.imageUrl);
            }
        });
        return base;
    }, [product, variants]);

    if (isLoading) {
        return (
            <div className={`pageContainer ${styles.stateWrap}`}>
                <h2 className={styles.stateTitle}>Memuat Spesimen...</h2>
            </div>
        );
    }

    if (!product) {
        return (
            <div className={`pageContainer ${styles.stateWrap}`}>
                <h2 className={styles.notFoundTitle}>Koleksi Tidak Ditemukan</h2>
                <Link href="/produk" className="btn btn-primary">Kembali ke Galeri</Link>
            </div>
        );
    }

    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(currentPrice);

    const hasSizes = variants.length > 0;
    const requiresSizePick = hasSizes && !selectedSize;

    const handleAcquire = () => {
        if (requiresSizePick) {
            setSizeError('Mohon pilih varian terlebih dahulu.');
            return;
        }
        setSizeError('');
        const itemImage = activeVariant?.imageUrl || product.image;
        buyNow({ ...product, price: currentPrice, image: itemImage, selectedSize, variantId: activeVariant?.id });
        router.push('/checkout');
    };

    const handleAddToCart = () => {
        if (requiresSizePick) {
            setSizeError('Mohon pilih varian terlebih dahulu.');
            return;
        }
        setSizeError('');
        const itemImage = activeVariant?.imageUrl || product.image;
        addToCart({ ...product, price: currentPrice, image: itemImage, selectedSize, variantId: activeVariant?.id });
    };

    const canBuy = !product.isSold && product.quantity > 0;
    const idx = gallery.length > 0 ? Math.min(activeIndex, gallery.length - 1) : 0;
    const hasMultiple = gallery.length > 1;

    const goTo = (dir) => {
        const n = gallery.length;
        if (n <= 1) return;
        setActiveIndex((prev) => (Math.min(prev, n - 1) + dir + n) % n);
    };
    const onTouchStart = (e) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
    const onTouchEnd = (e) => {
        if (touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(dx) > 40) goTo(dx < 0 ? 1 : -1);
        touchStartX.current = null;
    };

    return (
        <div className={styles.page}>
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.grid}>

                        {/* Image gallery — geser sesuai urutan yang di-set admin */}
                        <div>
                            <div
                                className={styles.imageFrame}
                                onTouchStart={onTouchStart}
                                onTouchEnd={onTouchEnd}
                            >
                                <Image
                                    src={gallery[idx] || product.image}
                                    alt={`${product.name}${hasMultiple ? ` — foto ${idx + 1} dari ${gallery.length}` : ''}`}
                                    fill
                                    sizes="(max-width: 900px) 100vw, 50vw"
                                    className={styles.image}
                                    priority
                                />

                                {product.isSold && (
                                    <div className={styles.soldOverlay}>
                                        <span className={styles.soldBadge}>Arsip</span>
                                    </div>
                                )}

                                {hasMultiple && (
                                    <>
                                        <button
                                            type="button"
                                            className={`${styles.galleryNav} ${styles.galleryPrev}`}
                                            onClick={() => goTo(-1)}
                                            aria-label="Foto sebelumnya"
                                        >
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.galleryNav} ${styles.galleryNext}`}
                                            onClick={() => goTo(1)}
                                            aria-label="Foto berikutnya"
                                        >
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                                        </button>
                                        <div className={styles.galleryDots}>
                                            {gallery.map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`${styles.galleryDot} ${i === idx ? styles.galleryDotActive : ''}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {hasMultiple && (
                                <div className={styles.thumbStrip}>
                                    {gallery.map((url, i) => (
                                        <button
                                            key={`${url}-${i}`}
                                            type="button"
                                            className={`${styles.thumb} ${i === idx ? styles.thumbActive : ''}`}
                                            onClick={() => setActiveIndex(i)}
                                            aria-label={`Lihat foto ${i + 1}`}
                                        >
                                            <Image src={url} alt={`${product.name} ${i + 1}`} fill sizes="80px" style={{ objectFit: 'cover' }} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Info — punya class `infoColumn` supaya mobile bisa jadi flex + reorder */}
                        <div className={styles.infoColumn}>
                            <span className={styles.eyebrow}>
                                Edisi #{product.id.slice(0, 8).toUpperCase()} — {product.category}
                            </span>
                            <h1 className={styles.title}>{product.name}</h1>


                            <div className={styles.priceRow}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceCurrency}>Rp</span>
                                    <span className={styles.priceAmount}>
                                        {new Intl.NumberFormat('id-ID').format(currentPrice)}
                                    </span>
                                </div>
                                {Number(product.soldCount) > 0 && (
                                    <div className={styles.soldBadgeTag}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <path d="M16 10a4 4 0 0 1-8 0" />
                                        </svg>
                                        <span>{product.soldCount} Terjual</span>
                                    </div>
                                )}
                            </div>

                            <p className={styles.description}>{product.description}</p>

                            <div className={styles.metaCard}>
                                <div className={styles.metaItem}>
                                    <label className={styles.metaLabel}>Grade Bentuk</label>
                                    <span className={styles.metaValue}>{product.statsForm || 'COMP'}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <label className={styles.metaLabel}>Umur</label>
                                    <span className={styles.metaValue}>{product.age || '4 Month'}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <label className={styles.metaLabel}>Tipe Form</label>
                                    <span className={`${styles.metaValue} ${styles.metaValueUpper}`}>
                                        {product.form || product.category || 'PLAKAT'}
                                    </span>
                                </div>
                            </div>

                            {hasSizes && (
                                <div className={`${styles.sizeSection} ${sizeError ? styles.sizeSectionInvalid : ''}`}>
                                    <h3 className={styles.sizeHeader}>Pilih Varian</h3>
                                    <div className={styles.sizeList}>
                                        {variants.map((v) => {
                                            const stock = v.stock ?? v.quantity ?? 0;
                                            const isOutOfStock = stock <= 0;
                                            const isSelected = selectedSize === v.size;
                                            const cls = [
                                                styles.sizeBtn,
                                                isSelected && styles.sizeBtnSelected,
                                                isOutOfStock && styles.sizeBtnOut,
                                            ].filter(Boolean).join(' ');
                                            const vPriceFormatted = v.price != null
                                                ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v.price)
                                                : null;
                                            return (
                                                <button
                                                    key={v.size}
                                                    type="button"
                                                    disabled={isOutOfStock}
                                                    onClick={() => {
                                                        setSelectedSize(v.size);
                                                        if (sizeError) setSizeError('');
                                                        if (v.imageUrl) {
                                                            const foundIdx = gallery.indexOf(v.imageUrl);
                                                            if (foundIdx >= 0) setActiveIndex(foundIdx);
                                                        }
                                                    }}
                                                    className={cls}
                                                >
                                                    <span className={styles.sizeLabel}>{v.size}</span>
                                                    {vPriceFormatted && (
                                                        <span className={styles.sizePrice}>
                                                            {vPriceFormatted}
                                                        </span>
                                                    )}
                                                    <span className={styles.sizeStock}>
                                                        {isOutOfStock ? 'Habis' : `Stok: ${stock}`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {sizeError && (
                                        <div className={styles.sizeError} role="alert">
                                            {sizeError}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={styles.actionBar}>
                                {canBuy ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            className={styles.cartIconBtn}
                                            aria-label="Tambah ke Keranjang"
                                            title="Tambah ke Keranjang"
                                        >
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAcquire}
                                            className={styles.buyBtn}
                                        >
                                            <span className={styles.buyBtnPrice}>{formattedPrice}</span>
                                            <span className={styles.buyBtnLabel}>Beli Sekarang</span>
                                        </button>
                                    </>
                                ) : (
                                    <span className={styles.soldOutTag}>Stok Habis / Terjual</span>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Section Produk Serupa (Content-Based Recommendation) */}
            {similarProducts.length > 0 && (
                <section className={styles.similarSection}>
                    <div className="container">
                        <div className={styles.similarHeader}>
                            <div>
                                <span className={styles.similarEyebrow}>Rekomendasi Spesimen</span>
                                <h2 className={styles.similarTitle}>Produk Serupa</h2>
                                <p className={styles.similarSubtitle}>
                                    Spesimen dengan form {product.form}, corak {product.coloration}, dan karakteristik serupa.
                                </p>
                            </div>
                            <Link href={product.form || product.category ? `/produk?category=${encodeURIComponent((product.form || product.category).trim())}` : '/produk'} className={styles.similarViewAll}>
                                <span>Lihat Semua {product.form || product.category || 'Koleksi'}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </Link>
                        </div>

                        <div className="productGrid">
                            {similarProducts.map((simProd) => (
                                <ProductCard key={simProd.id} {...simProd} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Mobile-only sticky bottom action bar — menggantikan MobileBottomNav di halaman ini */}
            {canBuy && (
                <div className={styles.mobileActionBar}>
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        className={styles.mobileCartBtn}
                        aria-label="Tambah ke Keranjang"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        <span>Keranjang</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAcquire}
                        className={styles.mobileBuyBtn}
                    >
                        <span className={styles.mobileBuyLabel}>Beli Sekarang</span>
                        <span className={styles.mobileBuyPrice}>{formattedPrice}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
