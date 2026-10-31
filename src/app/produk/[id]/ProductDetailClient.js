'use client';
import { useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ProductCard';
import { getSimilarProducts } from '@/lib/recommendation';
import { parseYouTubeId } from '@/lib/productImages';
import styles from './productDetail.module.css';

// Normalisasi galeri media (foto dan video) yang aman dan berurutan sesuai setting admin.
function buildProductMediaGallery(product, variants = []) {
    if (!product) return [];
    let raw = [];
    if (Array.isArray(product.images)) {
        raw = product.images;
    } else if (typeof product.images === 'string') {
        try {
            const parsed = JSON.parse(product.images);
            if (Array.isArray(parsed)) raw = parsed;
        } catch { /* ignore */ }
    }

    const items = [];
    const seen = new Set();

    const addItem = (type, url) => {
        if (!url || typeof url !== 'string') return;
        const trimmed = url.trim();
        const key = `${type}:${trimmed}`;
        if (seen.has(key)) return;
        seen.add(key);

        if (type === 'video') {
            const ytId = parseYouTubeId(trimmed);
            items.push({
                type: 'video',
                url: trimmed,
                ytId,
                thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null,
            });
        } else {
            items.push({
                type: 'image',
                url: trimmed,
                thumbnail: trimmed,
            });
        }
    };

    // 1. Masukkan media sesuai urutan yang di-set admin (Product.images)
    for (const item of raw) {
        if (typeof item === 'string') {
            const s = item.trim();
            if (s.startsWith('/')) {
                addItem('image', s);
            } else if (parseYouTubeId(s) || /\.(mp4|webm|mov)($|\?)/i.test(s)) {
                addItem('video', s);
            }
        } else if (item && typeof item === 'object') {
            const u = typeof item.url === 'string' ? item.url : '';
            if (item.type === 'video' || parseYouTubeId(u)) {
                addItem('video', u);
            } else if (u) {
                addItem('image', u);
            }
        }
    }

    // 2. Jika ada videoUrl terpisah di DB tapi belum ada di gallery, tambahkan
    if (product.videoUrl) {
        const trimmedVid = product.videoUrl.trim();
        const hasVid = items.some((m) => m.type === 'video' && m.url === trimmedVid);
        if (!hasVid) {
            addItem('video', trimmedVid);
        }
    }

    // 3. Fallback foto utama jika belum ada foto
    const hasImage = items.some((m) => m.type === 'image');
    if (!hasImage && product.image) {
        addItem('image', product.image);
    }

    // 4. Tambahkan foto varian jika ada varian dengan foto tersendiri
    if (Array.isArray(variants)) {
        variants.forEach((v) => {
            if (v.imageUrl) {
                addItem('image', v.imageUrl);
            }
        });
    }

    return items;
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
        return buildProductMediaGallery(product, variants);
    }, [product, variants]);

    if (isLoading) {
        return (
            <div className={`pageContainer ${styles.stateWrap}`}>
                <h2 className={styles.stateTitle}>Memuat Detail Ikan...</h2>
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
        const fallbackImg = gallery.find((m) => m.type === 'image')?.url || product.image;
        const itemImage = activeVariant?.imageUrl || fallbackImg;
        buyNow({ ...product, price: currentPrice, image: itemImage, selectedSize, variantId: activeVariant?.id });
        router.push('/checkout');
    };

    const handleAddToCart = () => {
        if (requiresSizePick) {
            setSizeError('Mohon pilih varian terlebih dahulu.');
            return;
        }
        setSizeError('');
        const fallbackImg = gallery.find((m) => m.type === 'image')?.url || product.image;
        const itemImage = activeVariant?.imageUrl || fallbackImg;
        addToCart({ ...product, price: currentPrice, image: itemImage, selectedSize, variantId: activeVariant?.id });
    };

    const canBuy = !product.isSold && product.quantity > 0;
    const idx = gallery.length > 0 ? Math.min(activeIndex, gallery.length - 1) : 0;
    const activeMedia = gallery[idx] || (gallery[0] || { type: 'image', url: product.image });
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

                        {/* Media gallery — geser sesuai urutan yang di-set admin (foto + video) */}
                        <div>
                            <div
                                className={styles.imageFrame}
                                onTouchStart={onTouchStart}
                                onTouchEnd={onTouchEnd}
                            >
                                {activeMedia?.type === 'video' ? (
                                    <div className={styles.videoEmbedWrapper}>
                                        {activeMedia.ytId ? (
                                            <iframe
                                                src={`https://www.youtube-nocookie.com/embed/${activeMedia.ytId}?autoplay=0&rel=0&modestbranding=1`}
                                                title={`Video ${product.name}`}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                className={styles.videoEmbed}
                                            />
                                        ) : (
                                            <video
                                                src={activeMedia.url}
                                                controls
                                                playsInline
                                                preload="metadata"
                                                className={styles.videoEmbed}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <Image
                                        src={activeMedia?.url || product.image}
                                        alt={`${product.name}${hasMultiple ? ` — media ${idx + 1} dari ${gallery.length}` : ''}`}
                                        fill
                                        sizes="(max-width: 900px) 100vw, 50vw"
                                        className={styles.image}
                                        priority={idx === 0}
                                    />
                                )}

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
                                            aria-label="Media sebelumnya"
                                        >
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.galleryNav} ${styles.galleryNext}`}
                                            onClick={() => goTo(1)}
                                            aria-label="Media berikutnya"
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
                                    {gallery.map((media, i) => (
                                        <button
                                            key={`${media.url}-${i}`}
                                            type="button"
                                            className={`${styles.thumb} ${i === idx ? styles.thumbActive : ''}`}
                                            onClick={() => setActiveIndex(i)}
                                            aria-label={`Lihat ${media.type === 'video' ? 'video' : 'foto'} ${i + 1}`}
                                        >
                                            {media.type === 'video' ? (
                                                <div className={styles.videoThumbWrap}>
                                                    {media.thumbnail ? (
                                                        <Image
                                                            src={media.thumbnail}
                                                            alt={`Video ${product.name}`}
                                                            fill
                                                            sizes="80px"
                                                            className={styles.thumbImg}
                                                        />
                                                    ) : (
                                                        <div className={styles.videoThumbPlaceholder} />
                                                    )}
                                                    <span className={styles.playBadge} aria-hidden="true">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                            <polygon points="5 3 19 12 5 21 5 3" />
                                                        </svg>
                                                    </span>
                                                </div>
                                            ) : (
                                                <Image
                                                    src={media.url}
                                                    alt={`${product.name} ${i + 1}`}
                                                    fill
                                                    sizes="80px"
                                                    className={styles.thumbImg}
                                                />
                                            )}
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

                            {/* Authenticity / Specification Trust Box */}
                            {product.isPremium ? (
                                <div className={styles.authenticityBoxPremium}>
                                    <div className={styles.authenticityHeader}>
                                        <div className={styles.authenticityTitleRow}>
                                            <svg className={styles.authenticityIconPremium} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                            </svg>
                                            <span className={styles.authenticityTitlePremium}>
                                                ✦ Edisi Gallery
                                            </span>
                                        </div>
                                        <span className={styles.authenticityTag}>GALLERY</span>
                                    </div>
                                    <p className={styles.authenticityDesc}>
                                        Koleksi gallery pilihan dengan mutu visual estetika tertinggi. Setiap ikan memiliki keunikan mutasi genetik tersendiri dan diabadikan secara khusus sesuai wujud fisik asli yang akan Anda terima.
                                    </p>
                                </div>
                            ) : product.department?.isLiveFish === false ? (
                                <div className={styles.authenticityBoxSample}>
                                    <div className={styles.authenticityHeader}>
                                        <div className={styles.authenticityTitleRow}>
                                            <svg className={styles.authenticityIconSample} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                                            </svg>
                                            <span className={styles.authenticityTitle}>
                                                Standar Farm SUMDE Aquatics
                                            </span>
                                        </div>
                                        <span className={styles.authenticityTagNeutral}>Perlengkapan Terstandar</span>
                                    </div>
                                    <p className={styles.authenticityDesc}>
                                        Produk terstandarisasi untuk perawatan ikan cupang dan ekosistem akuatik sehat. Telah diuji kelayakan dan dikemas aman untuk pengiriman ke seluruh Indonesia.
                                    </p>
                                </div>
                            ) : (
                                <div className={styles.authenticityBoxSample}>
                                    <div className={styles.authenticityHeader}>
                                        <div className={styles.authenticityTitleRow}>
                                            <svg className={styles.authenticityIconSample} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                                <rect x="14" y="14" width="7" height="7" rx="1" />
                                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                            </svg>
                                            <span className={styles.authenticityTitle}>
                                                Koleksi Reguler Farm SUMDE
                                            </span>
                                        </div>
                                        <span className={styles.authenticityTagNeutral}>Standar Farm</span>
                                    </div>
                                    <p className={styles.authenticityDesc}>
                                        Ikan sehat berkualitas grade pilihan farm SUMDE BETTA, diseleksi langsung dari lini farm terbaik sesuai varian ukuran dan gender pilihan Anda.
                                    </p>
                                </div>
                            )}

                            {product.department?.isLiveFish === false ? (
                                <div className={styles.metaCard}>
                                    <div className={styles.metaItem}>
                                        <label className={styles.metaLabel}>Sub-Kategori</label>
                                        <span className={styles.metaValue}>{product.subCategory?.name || product.category || 'Peralatan'}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <label className={styles.metaLabel}>Merk / Brand</label>
                                        <span className={styles.metaValue}>{product.brand || 'Sumde Aquatics'}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <label className={styles.metaLabel}>Berat Ongkir</label>
                                        <span className={styles.metaValue}>{product.weight ? `${product.weight} gr` : '1.000 gr'}</span>
                                    </div>
                                </div>
                            ) : (
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
                            )}

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
                                                            const foundIdx = gallery.findIndex((m) => m.url === v.imageUrl);
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

                            {/* Garansi & Standar Pengiriman Farm SUMDE */}
                            <div className={styles.assuranceSection}>
                                <div className={styles.assuranceItem}>
                                    <div className={styles.assuranceIconWrapper}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            <polyline points="9 12 11 14 15 10" />
                                        </svg>
                                    </div>
                                    <div className={styles.assuranceContent}>
                                        <h4 className={styles.assuranceTitle}>Garansi Selamat (DOA 100%)</h4>
                                        <p className={styles.assuranceDesc}>
                                            Garansi hidup sampai tujuan. Jika ada kendala perjalanan, sertakan video unboxing tanpa jeda untuk penggantian penuh.
                                        </p>
                                    </div>
                                </div>

                                <div className={styles.assuranceItem}>
                                    <div className={styles.assuranceIconWrapper}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                                        </svg>
                                    </div>
                                    <div className={styles.assuranceContent}>
                                        <h4 className={styles.assuranceTitle}>Kemasan Oksigen Murni Ganda</h4>
                                        <p className={styles.assuranceDesc}>
                                            Kemasan kantong ganda dengan injeksi oksigen murni, kardus tebal, dan insulasi styrofoam penahan suhu.
                                        </p>
                                    </div>
                                </div>

                                <div className={styles.assuranceItem}>
                                    <div className={styles.assuranceIconWrapper}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <rect x="1" y="3" width="15" height="13" />
                                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                            <circle cx="5.5" cy="18.5" r="2.5" />
                                            <circle cx="18.5" cy="18.5" r="2.5" />
                                        </svg>
                                    </div>
                                    <div className={styles.assuranceContent}>
                                        <h4 className={styles.assuranceTitle}>Pengiriman Nusantara Terverifikasi</h4>
                                        <p className={styles.assuranceDesc}>
                                            Ekspedisi resmi terintegrasi dengan pelacakan nomor resi otomatis serta pembaruan berkala langsung ke sistem.
                                        </p>
                                    </div>
                                </div>
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
                                <span className={styles.similarEyebrow}>Rekomendasi Koleksi</span>
                                <h2 className={styles.similarTitle}>Produk Serupa</h2>
                                <p className={styles.similarSubtitle}>
                                    Ikan dengan form {product.form}, corak {product.coloration}, dan karakteristik serupa.
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
