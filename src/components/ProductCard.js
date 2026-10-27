'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef } from 'react';
import styles from './ProductCard.module.css';
import { useCart } from '@/context/CartContext';
import SizePickerModal from './SizePickerModal';

// Normalisasi galeri foto ke array URL yang aman ditampilkan.
function toGallery(images, fallbackImage) {
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
    soldCount
}) {
    const { addToCart, isCartOpen, toggleCart } = useCart();
    const [modalAction, setModalAction] = useState(null);

    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price || 0);

    const variantList = Array.isArray(variants) && variants.length > 0
        ? variants
        : (Array.isArray(sizes) && sizes.length > 0
            ? sizes.map(s => ({ size: s.size, stock: s.quantity, price: null, imageUrl: null }))
            : []);

    const totalStock = variantList.length > 0
        ? variantList.reduce((sum, s) => sum + (Number(s.stock ?? s.quantity) || 0), 0)
        : (Number(quantity) || 0);

    const effectiveSold = Boolean(isSold || totalStock <= 0);
    const isLowStock = !effectiveSold && totalStock > 0 && totalStock <= 5;
    const hasSizes = variantList.length > 0;

    const gallery = toGallery(images, image);
    const hasGallery = gallery.length > 1;
    const [imgIdx, setImgIdx] = useState(0);
    const touchStartX = useRef(null);
    const safeImgIdx = gallery.length > 0 ? Math.min(imgIdx, gallery.length - 1) : 0;

    const handleImgMouseMove = (e) => {
        if (!hasGallery) return;
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
    };

    const handleImgTouchEnd = (e) => {
        if (!hasGallery || touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(dx) > 40) {
            const n = gallery.length;
            setImgIdx((prev) => (prev + (dx < 0 ? 1 : -1) + n) % n);
        }
        touchStartX.current = null;
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
        soldCount
    };

    const commitAddToCart = (selectedSize, variant) => {
        const itemPrice = variant?.price !== null && variant?.price !== undefined ? variant.price : price;
        const itemImage = variant?.imageUrl || image;
        addToCart({ ...productPayload, price: itemPrice, image: itemImage, selectedSize, variantId: variant?.id });
    };

    const openSizePicker = (action) => {
        if (isCartOpen) toggleCart();
        setModalAction(action);
    };

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (effectiveSold) return;
        if (hasSizes) {
            openSizePicker('cart');
            return;
        }
        commitAddToCart(null, null);
    };

    const handleModalCommit = (selectedSize, variant) => {
        commitAddToCart(selectedSize, variant);
        setModalAction(null);
    };

    // Sub-info taksonomi ringkas
    const taxonomyItems = [form, coloration, age].filter(Boolean);

    return (
        <>
            <Link href={`/produk/${id}`} className={styles.card} aria-label={`Lihat detail produk ${name}`}>
                {/* Image Container */}
                <div
                    className={styles.imageContainer}
                    onMouseMove={handleImgMouseMove}
                    onMouseLeave={handleImgMouseLeave}
                    onTouchStart={handleImgTouchStart}
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

                    {/* Dot indikator galeri */}
                    {hasGallery && !effectiveSold && (
                        <div className={styles.cardDots}>
                            {gallery.map((_, i) => (
                                <span
                                    key={i}
                                    className={`${styles.cardDot} ${i === safeImgIdx ? styles.cardDotActive : ''}`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Badges container (Kiri Atas) */}
                    <div className={styles.badgesContainer}>
                        {isPremium && !effectiveSold && (
                            <span className={styles.badgePremium}>
                                Premium
                            </span>
                        )}
                    </div>

                    {/* Badge Sisa Stok (Kanan Atas) */}
                    {isLowStock && (
                        <span className={styles.badgeLowStock}>
                            Sisa {totalStock}
                        </span>
                    )}

                    {/* Overlay Terjual / Stok Habis (Tengah Foto ala Shopee) */}
                    {effectiveSold && (
                        <div className={styles.soldOverlay}>
                            <div className={styles.soldOverlayCircle}>
                                <span>TERJUAL</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Container */}
                <div className={styles.contentContainer}>
                    {/* Taxonomy quick details */}
                    {taxonomyItems.length > 0 && (
                        <div className={styles.taxonomyContainer}>
                            {taxonomyItems.map((item, idx) => (
                                <span key={idx} className={styles.taxonomyItem}>
                                    {idx > 0 && <span className={styles.dot}>•</span>}
                                    {item}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Product Title (Formal e-commerce, 2 baris konsisten) */}
                    <h3 className={styles.title} title={name}>
                        {name}
                    </h3>

                    {/* Bottom Row: Price & Sold on Left, Quick Cart on Right */}
                    <div className={styles.bottomRow}>
                        <div className={styles.priceCol}>
                            <span className={styles.price}>{formattedPrice}</span>
                            <div className={styles.statusMetaRow}>
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
