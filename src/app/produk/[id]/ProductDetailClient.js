'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
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
    const touchStartX = useRef(null);

    const product = products.find((p) => p.id === id);

    // Reset selected size + error whenever we're viewing a different product
    // (product id changes because URL param or products list updated).
    useEffect(() => {
        if (!product) return;
        const firstAvailable = product.sizes?.find((s) => s.quantity > 0)?.size || '';
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state turunan saat pindah produk (id berubah)
        setSelectedSize(firstAvailable);
        setSizeError('');
        setActiveIndex(0); // kembali ke foto pertama saat pindah produk
    }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }).format(product.price);

    const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
    const requiresSizePick = hasSizes && !selectedSize;

    const handleAcquire = () => {
        if (requiresSizePick) {
            setSizeError('Mohon pilih ukuran (size) terlebih dahulu.');
            return;
        }
        setSizeError('');
        buyNow({ ...product, selectedSize });
        router.push('/checkout');
    };

    const handleAddToCart = () => {
        if (requiresSizePick) {
            setSizeError('Mohon pilih ukuran (size) terlebih dahulu.');
            return;
        }
        setSizeError('');
        addToCart({ ...product, selectedSize });
    };

    const canBuy = !product.isSold && product.quantity > 0;

    // Galeri berurutan sesuai urutan yang di-set admin.
    const gallery = toImageArray(product.images, product.image);
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


                            <div className={styles.priceBlock}>
                                <span className={styles.priceCurrency}>Rp</span>
                                <span className={styles.priceAmount}>
                                    {new Intl.NumberFormat('id-ID').format(product.price)}
                                </span>
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
                                    <label className={styles.metaLabel}>Gender</label>
                                    <span className={`${styles.metaValue} ${styles.metaValueUpper}`}>
                                        {product.gender || 'MALE'}
                                    </span>
                                </div>
                            </div>

                            {hasSizes && (
                                <div className={`${styles.sizeSection} ${sizeError ? styles.sizeSectionInvalid : ''}`}>
                                    <h3 className={styles.sizeHeader}>Pilih Ukuran (Size)</h3>
                                    <div className={styles.sizeList}>
                                        {product.sizes.map((s) => {
                                            const isOutOfStock = s.quantity <= 0;
                                            const isSelected = selectedSize === s.size;
                                            const cls = [
                                                styles.sizeBtn,
                                                isSelected && styles.sizeBtnSelected,
                                                isOutOfStock && styles.sizeBtnOut,
                                            ].filter(Boolean).join(' ');
                                            return (
                                                <button
                                                    key={s.size}
                                                    type="button"
                                                    disabled={isOutOfStock}
                                                    onClick={() => {
                                                        setSelectedSize(s.size);
                                                        if (sizeError) setSizeError('');
                                                    }}
                                                    className={cls}
                                                >
                                                    <span className={styles.sizeLabel}>{s.size}</span>
                                                    <span className={styles.sizeStock}>
                                                        {isOutOfStock ? 'Habis' : `Stok: ${s.quantity}`}
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
