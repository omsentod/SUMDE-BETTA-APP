'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useMemo } from 'react';
import styles from './ProductCard.module.css';
import { useCart } from '@/context/CartContext';
import SizePickerModal from './SizePickerModal';
import { parseYouTubeId } from '@/lib/productImages';
import { getEffectiveUnitPrice } from '@/lib/wholesale';

function extractImageUrl(item) {
    if (!item) return null;
    if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) return null;
        if (parseYouTubeId(trimmed) || /\.(mp4|webm|mov)($|\?)/i.test(trimmed)) {
            return null;
        }
        return trimmed;
    }
    if (typeof item === 'object') {
        if (item.type === 'video') return null;
        const u = typeof item.url === 'string'
            ? item.url.trim()
            : (typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '');
        if (!u) return null;
        if (parseYouTubeId(u) || /\.(mp4|webm|mov)($|\?)/i.test(u)) {
            return null;
        }
        return u;
    }
    return null;
}

// Normalisasi galeri foto ke array URL yang aman ditampilkan,
// mencakup cover image, array/JSON images, dan foto varian.
function toGallery(images, fallbackImage, variants = []) {
    const list = [];
    const seen = new Set();

    const add = (url) => {
        if (!url || typeof url !== 'string') return;
        const trimmed = url.trim();
        if (!trimmed) return;
        if (seen.has(trimmed)) return;
        seen.add(trimmed);
        list.push(trimmed);
    };

    // 1. Foto cover utama (fallbackImage)
    const coverUrl = extractImageUrl(fallbackImage);
    if (coverUrl) {
        add(coverUrl);
    }

    // 2. Daftar foto dari field images (array atau JSON string)
    let rawImages = [];
    if (Array.isArray(images)) {
        rawImages = images;
    } else if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images);
            if (Array.isArray(parsed)) rawImages = parsed;
            else if (typeof parsed === 'string') rawImages = [parsed];
        } catch {
            if (images.trim()) rawImages = [images.trim()];
        }
    }

    for (const item of rawImages) {
        const u = extractImageUrl(item);
        if (u) add(u);
    }

    // 3. Foto dari masing-masing varian (jika memiliki foto tersendiri)
    if (Array.isArray(variants)) {
        for (const v of variants) {
            const u = extractImageUrl(v?.imageUrl || v?.image);
            if (u) add(u);
        }
    }

    return list;
}

export default function ProductCard({
    id,
    name,
    price,
    form,
    coloration,
    isSold,
    isPremium,
    image,
    images,
    category,
    age,
    sizes,
    variants,
    quantity,
    soldCount,
    videoUrl,
    brand,
    department,
    subCategory,
    isWholesale,
    wholesaleTiers,
    onClick,
}) {
    const { addToCart, isCartOpen, toggleCart } = useCart();
    const [modalAction, setModalAction] = useState(null);

    const hasVideo = useMemo(() => {
        if (typeof videoUrl === 'string' && videoUrl.trim().length > 0) return true;
        let raw = [];
        if (Array.isArray(images)) raw = images;
        else if (typeof images === 'string') {
            try {
                const parsed = JSON.parse(images);
                if (Array.isArray(parsed)) raw = parsed;
            } catch { /* ignore */ }
        }
        return raw.some((m) => {
            if (typeof m === 'string') return Boolean(parseYouTubeId(m) || /\.(mp4|webm|mov)($|\?)/i.test(m));
            if (typeof m === 'object' && m) {
                if (m.type === 'video') return true;
                const u = m.url || '';
                return Boolean(parseYouTubeId(u) || /\.(mp4|webm|mov)($|\?)/i.test(u));
            }
            return false;
        });
    }, [videoUrl, images]);

    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price || 0);

    const variantList = useMemo(() => {
        return Array.isArray(variants) && variants.length > 0
            ? variants
            : (Array.isArray(sizes) && sizes.length > 0
                ? sizes.map((s) => ({ size: s.size, stock: s.quantity, price: null, imageUrl: null }))
                : []);
    }, [variants, sizes]);

    const totalStock = variantList.length > 0
        ? variantList.reduce((sum, s) => sum + (Number(s.stock ?? s.quantity) || 0), 0)
        : (Number(quantity) || 0);

    const effectiveSold = Boolean(isSold || totalStock <= 0);
    const isLowStock = !effectiveSold && totalStock > 0 && totalStock <= 5;
    const hasSizes = variantList.length > 0;

    const gallery = useMemo(() => {
        return toGallery(images, image, variantList);
    }, [images, image, variantList]);

    const hasGallery = gallery.length > 1;
    const [imgIdx, setImgIdx] = useState(0);
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const isSwiping = useRef(false);
    const safeImgIdx = gallery.length > 0 ? Math.min(imgIdx, gallery.length - 1) : 0;

    const handleImgMouseMove = (e) => {
        if (!hasGallery) return;
        if (e.target.closest?.(`.${styles.navBtn}`) || e.target.closest?.(`.${styles.cardDots}`)) {
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const next = Math.min(gallery.length - 1, Math.max(0, Math.floor(ratio * gallery.length)));
        setImgIdx((prev) => (prev === next ? prev : next));
    };

    const handleImgMouseLeave = () => {
        if (hasGallery) setImgIdx(0);
    };

    const handleImgTouchStart = (e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
        touchStartY.current = e.touches[0]?.clientY ?? null;
        isSwiping.current = false;
    };

    const handleImgTouchMove = (e) => {
        if (touchStartX.current == null || touchStartY.current == null) return;
        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            isSwiping.current = true;
        }
    };

    const handleImgTouchEnd = (e) => {
        if (!hasGallery || touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(dx) > 30) {
            e.preventDefault();
            const n = gallery.length;
            setImgIdx((prev) => (prev + (dx < 0 ? 1 : -1) + n) % n);
        }
        touchStartX.current = null;
        touchStartY.current = null;
        setTimeout(() => {
            isSwiping.current = false;
        }, 120);
    };

    const handleCardClick = (e) => {
        if (isSwiping.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (onClick) {
            onClick(e);
        }
    };

    const productPayload = {
        id,
        name,
        price,
        form,
        coloration,
        image,
        images,
        category,
        age,
        sizes,
        variants: variantList,
        quantity,
        soldCount,
        isWholesale,
        wholesaleTiers,
        department,
        subCategory,
        brand,
    };

    const commitAddToCart = (selectedSize, variant, chosenQty = 1) => {
        const basePrice = variant?.price !== null && variant?.price !== undefined ? variant.price : price;
        const itemPrice = getEffectiveUnitPrice({ price, isWholesale, wholesaleTiers }, variant, chosenQty);
        const itemImage = variant?.imageUrl || image;
        addToCart({
            ...productPayload,
            productPrice: price,
            basePrice,
            price: itemPrice,
            image: itemImage,
            selectedSize,
            variantId: variant?.id,
            isWholesale,
            wholesaleTiers,
        }, chosenQty);
    };

    const openSizePicker = (action) => {
        if (isCartOpen) toggleCart();
        setModalAction(action);
    };

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (effectiveSold) return;
        if (hasSizes || isWholesale) {
            openSizePicker('cart');
            return;
        }
        commitAddToCart(null, null, 1);
    };

    const handleModalCommit = (selectedSize, variant, chosenQty = 1) => {
        commitAddToCart(selectedSize, variant, chosenQty);
        setModalAction(null);
    };

    // Sub-info taksonomi ringkas
    const isLive = department?.isLiveFish !== false && !brand;
    const taxonomyItems = isLive
        ? [form, coloration, age].filter(Boolean)
        : [brand, subCategory?.name || category].filter(Boolean);

    return (
        <>
            <Link
                href={`/produk/${id}`}
                scroll={true}
                className={`${styles.card} ${isPremium ? styles.cardPremium : styles.cardStandard}`}
                aria-label={`Lihat detail produk ${name}`}
                onClick={handleCardClick}
            >
                {/* Image Container */}
                <div
                    className={styles.imageContainer}
                    onMouseMove={handleImgMouseMove}
                    onMouseLeave={handleImgMouseLeave}
                    onTouchStart={handleImgTouchStart}
                    onTouchMove={handleImgTouchMove}
                    onTouchEnd={handleImgTouchEnd}
                >
                    {gallery.length > 0 ? (
                        <Image
                            src={gallery[safeImgIdx]}
                            alt={name}
                            fill
                            className={`${styles.image} ${effectiveSold ? styles.imageSold : ''}`}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                    ) : (
                        <div className={styles.placeholderIcon}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" />
                                <path d="M18 12v.5" />
                                <path d="M16 17.93a1 1 0 0 1-.5.07c-2.3 0-4.32-.97-5.5-2.5" />
                                <path d="M2 9.5 6.5 12 2 14.5Z" />
                            </svg>
                        </div>
                    )}

                    {/* Nav Arrow Buttons (Desktop Hover & Accessible Slide) */}
                    {hasGallery && !effectiveSold && (
                        <>
                            <button
                                type="button"
                                className={`${styles.navBtn} ${styles.navBtnPrev}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setImgIdx((prev) => (prev - 1 + gallery.length) % gallery.length);
                                }}
                                aria-label="Foto sebelumnya"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className={`${styles.navBtn} ${styles.navBtnNext}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setImgIdx((prev) => (prev + 1) % gallery.length);
                                }}
                                aria-label="Foto selanjutnya"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </>
                    )}

                    {/* Dot indikator galeri (Clickable) */}
                    {hasGallery && !effectiveSold && (
                        <div
                            className={styles.cardDots}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            {gallery.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`${styles.cardDot} ${i === safeImgIdx ? styles.cardDotActive : ''}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setImgIdx(i);
                                    }}
                                    aria-label={`Lihat foto ke-${i + 1}`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Top Badges Bar: Clean flex row, NO overlapping corners */}
                    <div className={styles.topBadgeBar}>
                        <div className={styles.topBadgeLeft}>
                            {isPremium && (
                                <span className={styles.taglinePremium}>
                                    <span className={styles.taglineSparkle}>✦</span>
                                    GALLERY
                                </span>
                            )}
                            {!isPremium && isLowStock && !effectiveSold && (
                                <span className={styles.badgeLowStock}>
                                    Sisa {totalStock}
                                </span>
                            )}
                        </div>

                        <div className={styles.topBadgeRight}>
                            {hasVideo && !effectiveSold && (
                                <span className={styles.badgeVideo} title="Tersedia video renang">
                                    <svg className={styles.videoIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <polygon points="6 4 20 12 6 20 6 4" />
                                    </svg>
                                    <span className={styles.badgeVideoText}>Video</span>
                                </span>
                            )}
                            {isPremium && !effectiveSold && (
                                <span className={styles.badgeSingleStock}>
                                    {isLive ? '1 Ekor' : '1 Unit'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Overlay Terjual / Stok Habis (Tengah Foto ala Shopee) */}
                    {effectiveSold && (
                        <div className={styles.soldOverlay}>
                            <div className={styles.soldOverlayCircle}>
                                <span>HABIS</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Container */}
                <div className={styles.contentContainer}>
                    {/* Taxonomy quick details */}
                    {taxonomyItems.length > 0 && (
                        <div className={`${styles.taxonomyContainer} ${isPremium ? styles.taxonomyContainerPremium : ''}`}>
                            {taxonomyItems.map((item, idx) => (
                                <span key={idx} className={styles.taxonomyItem}>
                                    {idx > 0 && <span className={isPremium ? styles.dotPremium : styles.dot}>•</span>}
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Product Title (Premium Editorial Serif vs Regular Clean Sans) */}
                    <h3 className={`${styles.title} ${isPremium ? styles.titlePremium : styles.titleStandard}`} title={name}>
                        {name}
                    </h3>

                    {/* Bottom Row: Price & Sold on Left, Quick Cart on Right */}
                    <div className={styles.bottomRow}>
                        <div className={styles.priceCol}>
                            <span className={`${styles.price} ${isPremium ? styles.pricePremium : ''}`}>{formattedPrice}</span>
                            <div className={styles.statusMetaRow}>
                                {isWholesale && !effectiveSold && (
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', background: 'color-mix(in oklab, #10b981 12%, transparent)', padding: '1px 6px', borderRadius: '4px', border: '1px solid color-mix(in oklab, #10b981 25%, transparent)' }}>
                                        Partai
                                    </span>
                                )}
                                {effectiveSold && (
                                    <span className={styles.soldBadgeMuted}>Habis</span>
                                )}
                                {Number(soldCount) > 0 && (
                                    <span className={styles.soldCountText}>{soldCount} Terjual</span>
                                )}
                            </div>
                        </div>

                        {!effectiveSold && (
                            <button
                                type="button"
                                onClick={handleAddToCart}
                                className={`${styles.cartBtn} ${isPremium ? styles.cartBtnPremium : ''}`}
                                aria-label={`Tambah ${name} ke keranjang`}
                                title="Tambah ke Keranjang"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.cartIcon}>
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </Link>

            {/* Size picker modal jika produk memiliki varian */}
            {modalAction && (
                <SizePickerModal
                    product={productPayload}
                    action={modalAction}
                    onClose={() => setModalAction(null)}
                    onCommit={handleModalCommit}
                />
            )}
        </>
    );
}
