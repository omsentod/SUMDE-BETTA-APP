'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef } from 'react';
import styles from './ProductCard.module.css';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import SizePickerModal from './SizePickerModal';

// Normalisasi galeri foto ke array URL yang aman ditampilkan. Prisma Json biasa
// sudah balik sebagai array, tapi tetap toleran kalau berupa string JSON. Kalau
// kosong, fallback ke cover tunggal (`image`).
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

export default function ProductCard({ id, name, price, form, coloration, isSold, isPremium, image, images, category, description, statsForm, age, statsSpirit, sizes, variants, quantity, soldCount }) {
    const { addToCart, buyNow, isCartOpen, toggleCart } = useCart();
    const router = useRouter();
    const formattedPrice = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);

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
    const [modalAction, setModalAction] = useState(null);

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
    const handleImgMouseLeave = () => { if (hasGallery) setImgIdx(0); };
    const handleImgTouchStart = (e) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
    const handleImgTouchEnd = (e) => {
        if (!hasGallery || touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
        if (Math.abs(dx) > 40) {
            const n = gallery.length;
            setImgIdx((prev) => (prev + (dx < 0 ? 1 : -1) + n) % n);
        }
        touchStartX.current = null;
    };

    const productPayload = { id, name, price, form, coloration, image, images, category, description, statsForm, age, statsSpirit, sizes, variants: variantList, quantity, soldCount };

    const commitAddToCart = (selectedSize, variant) => {
        const itemPrice = variant?.price !== null && variant?.price !== undefined ? variant.price : price;
        const itemImage = variant?.imageUrl || image;
        addToCart({ ...productPayload, price: itemPrice, image: itemImage, selectedSize, variantId: variant?.id });
    };

    const commitBuyNow = (selectedSize, variant) => {
        if (effectiveSold) return;
        const itemPrice = variant?.price !== null && variant?.price !== undefined ? variant.price : price;
        const itemImage = variant?.imageUrl || image;
        buyNow({ ...productPayload, price: itemPrice, image: itemImage, selectedSize, variantId: variant?.id });
        router.push('/checkout');
    };

    const openSizePicker = (action) => {
        if (isCartOpen) toggleCart();
        setModalAction(action);
    };

    const handleAddToCart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasSizes) { openSizePicker('cart'); return; }
        commitAddToCart(null, null);
    };

    const handleBuyNow = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (effectiveSold) return;
        if (hasSizes) { openSizePicker('buy'); return; }
        commitBuyNow(null, null);
    };

    const handleModalCommit = (selectedSize, variant) => {
        if (modalAction === 'buy') commitBuyNow(selectedSize, variant);
        else commitAddToCart(selectedSize, variant);
        setModalAction(null);
    };

    return (
        <div className={styles.card}>
            {/* Card Body wrapped in Link for direct navigation to details */}
            <Link href={`/produk/${id}`} className={styles.cardLink}>
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
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    ) : (
                        <div className={styles.placeholderIcon}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" />
                                <path d="M18 12v.5" />
                                <path d="M16 17.93a1 1 0 0 1-.5.07c-2.3 0-4.32-.97-5.5-2.5" />
                                <path d="M2 9.5 6.5 12 2 14.5Z" />
                            </svg>
                        </div>
                    )}

                    {/* Dot indikator galeri (muncul kalau foto > 1) */}
                    {hasGallery && (
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
                        {effectiveSold && (
                            <span className={styles.badgeSold}>
                                Terjual
                            </span>
                        )}
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
                </div>

                {/* Content Container */}
                <div className={styles.contentContainer}>
                    {/* Taxonomy quick details */}
                    <div className={styles.taxonomyContainer}>
                        <span>{form}</span>
                        <span className={styles.dot}></span>
                        <span>{coloration}</span>
                        <span className={styles.dot}></span>
                        <span>{age}</span>
                    </div>

                    {/* Title */}
                    <h3 className={styles.title} title={name}>
                        {name}
                    </h3>

                    {/* Price and Sold info */}
                    <div className={styles.priceRow}>
                        <p className={styles.price}>
                            {formattedPrice}
                        </p>
                        {Number(soldCount) > 0 && (
                            <span className={styles.soldCount}>
                                {soldCount} Terjual
                            </span>
                        )}
                    </div>
                </div>
            </Link>

            {/* Actions (Isolated from card click) */}
            <div className={styles.actionsContainer}>
                {effectiveSold ? (
                    <button className={styles.buyBtnSold} disabled>
                        Lihat Arsip
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleBuyNow}
                            className={styles.buyBtnActive}
                        >
                            Beli Sekarang
                        </button>
                        <button
                            onClick={handleAddToCart}
                            className={styles.cartBtn}
                            aria-label="Add to cart"
                            title="Tambah ke Keranjang"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={styles.cartIconBase}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4.5m0 0v-4.5m0 4.5h3.5m-3.5 0H8.5" className={styles.cartIconHover} />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Size picker (opens only when product has sizes and user clicks buy/cart) */}
            {modalAction && (
                <SizePickerModal
                    product={productPayload}
                    action={modalAction}
                    onClose={() => setModalAction(null)}
                    onCommit={handleModalCommit}
                />
            )}
        </div>
    );
}
