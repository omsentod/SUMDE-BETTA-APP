'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './ProductCardVIP.module.css';
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

    const coverUrl = extractImageUrl(fallbackImage);
    if (coverUrl) add(coverUrl);

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

    if (Array.isArray(variants)) {
        for (const v of variants) {
            const u = extractImageUrl(v?.imageUrl || v?.image);
            if (u) add(u);
        }
    }

    return list;
}

/**
 * ProductCardVIP
 *
 * Komponen kartu produk VIP Gallery Chamber di SUMDE BETTA.
 * Memiliki komponen identik dengan ProductCard biasa (ada tombol keranjang,
 * baris harga & status stok, modal size picker, galeri multi-foto),
 * dengan balutan visual dark luxury (obsidian & gold) serta efek interaktif
 * 3D tilt & holographic sheen pada desktop hover.
 */
export default function ProductCardVIP({
    id,
    name = 'Koleksi Gallery VIP',
    price = 0,
    image,
    images,
    category,
    form,
    coloration,
    age,
    isSold = false,
    hasVariants = false,
    quantity,
    soldCount,
    videoUrl,
    brand,
    department,
    subCategory,
    isWholesale,
    wholesaleTiers,
    sizes,
    variants,
    onClick,
}) {
    const { addToCart, isCartOpen, toggleCart } = useCart();
    const [modalAction, setModalAction] = useState(null);

    const cardRef = useRef(null);
    const rafIdRef = useRef(null);

    // Normalisasi varian & stok
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
    const hasSizes = variantList.length > 0;

    // Galeri foto
    const gallery = useMemo(() => {
        return toGallery(images, image, variantList);
    }, [images, image, variantList]);

    const hasGallery = gallery.length > 1;
    const [imgIdx, setImgIdx] = useState(0);
    const [imgLoaded, setImgLoaded] = useState(false);
    const touchStartX = useRef(null);
    const touchStartY = useRef(null);
    const isSwiping = useRef(false);
    const safeImgIdx = gallery.length > 0 ? Math.min(imgIdx, gallery.length - 1) : 0;

    // Deteksi video
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

    // Format harga IDR standar
    const formattedPrice = useMemo(() => {
        const numericPrice = typeof price === 'number' ? price : Number(price) || 0;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(numericPrice);
    }, [price]);

    // Payload untuk Keranjang
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

    // Sub-info taksonomi
    const isLive = department?.isLiveFish !== false && !brand;
    const taxonomyItems = isLive
        ? [form, coloration, age].filter(Boolean)
        : [brand, subCategory?.name || category].filter(Boolean);

    // Multi-photo mouse & touch handling
    const handleImgMouseMove = (e) => {
        if (!hasGallery) return;
        if (e.target.closest?.(`.${styles.navBtn}`) || e.target.closest?.(`.${styles.cardDots}`)) return;
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

    // ── 3D Tilt Mouse Tracking ──
    const handleMouseMove = useCallback((e) => {
        if (typeof window === 'undefined') return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const card = cardRef.current;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const width = rect.width;
        const height = rect.height;

        const mouseXPercent = Math.min(Math.max((x / width) * 100, 0), 100);
        const mouseYPercent = Math.min(Math.max((y / height) * 100, 0), 100);

        const normalizedX = (x / width) * 2 - 1;
        const normalizedY = (y / height) * 2 - 1;

        const MAX_TILT_DEG = 7;
        const rotateX = -normalizedY * MAX_TILT_DEG;
        const rotateY = normalizedX * MAX_TILT_DEG;

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
            card.style.setProperty('--mouse-x', `${mouseXPercent.toFixed(2)}%`);
            card.style.setProperty('--mouse-y', `${mouseYPercent.toFixed(2)}%`);
            card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
        });
    }, []);

    const handleMouseEnter = useCallback(() => {
        if (typeof window === 'undefined') return;
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const card = cardRef.current;
        if (!card) return;
        card.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
    }, []);

    const handleMouseLeave = useCallback(() => {
        const card = cardRef.current;
        if (!card) return;

        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }

        card.style.transition = 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.55s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.4s ease';
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
    }, []);

    return (
        <>
            <Link
                href={`/produk/${id}`}
                ref={cardRef}
                className={`${styles.card} ${effectiveSold ? styles.cardSold : ''}`}
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleCardClick}
                aria-label={`Lihat detail produk ${name}`}
            >
                {/* Holographic Sheen Layer */}
                <div className={styles.holographicSheen} aria-hidden="true" />

                {/* Image Container (1:1 Aspect Ratio) */}
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
                            onLoad={() => setImgLoaded(true)}
                            className={`${styles.image} ${imgLoaded ? styles.imageLoaded : styles.imageLoading} ${effectiveSold ? styles.imageSold : ''}`}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                    ) : (
                        <div className={styles.placeholderIcon}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </div>
                    )}

                    {/* Desktop multi-photo nav buttons */}
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

                    {/* Multi-photo dot indicators */}
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

                    {/* Top Badges Bar */}
                    <div className={styles.topBadgeBar}>
                        <div className={styles.topBadgeLeft}>
                            <span className={styles.vipPill}>
                                <span className={styles.sparkleIcon}>✦</span>
                                GALLERY
                            </span>
                        </div>
                        <div className={styles.topBadgeRight}>
                            {hasVideo && !effectiveSold && (
                                <span className={styles.badgeVideo} title="Tersedia video">
                                    <svg className={styles.videoIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                        <polygon points="6 4 20 12 6 20 6 4" />
                                    </svg>
                                    <span className={styles.badgeVideoText}>Video</span>
                                </span>
                            )}
                            {!effectiveSold && (
                                <span className={styles.badgeSingleStock}>
                                    {isLive ? '1 Ekor' : '1 Unit'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Sold overlay */}
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
                    {/* Taxonomy Row */}
                    {taxonomyItems.length > 0 && (
                        <div className={styles.taxonomyContainer}>
                            {taxonomyItems.map((item, idx) => (
                                <span key={idx} className={styles.taxonomyItem}>
                                    {idx > 0 && <span className={styles.taxonomyDot}>•</span>}
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Product Title */}
                    <h3 className={styles.title} title={name}>
                        {name}
                    </h3>

                    {/* Bottom Row: Price & Sold on Left, Quick Cart on Right */}
                    <div className={styles.bottomRow}>
                        <div className={styles.priceCol}>
                            <span className={styles.price}>{formattedPrice}</span>
                            <div className={styles.statusMetaRow}>
                                {isWholesale && !effectiveSold && (
                                    <span className={styles.wholesaleBadge}>Partai</span>
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
                                className={styles.cartBtn}
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

            {/* Size picker modal */}
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
