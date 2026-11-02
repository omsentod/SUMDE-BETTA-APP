'use client';
import { useEffect, useState, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { normalizeWholesaleTiers, getApplicableWholesaleTier, getEffectiveUnitPrice } from '@/lib/wholesale';
import styles from './SizePickerModal.module.css';

const emptySubscribe = () => () => {};

export default function SizePickerModal({ product, action, onClose, onCommit }) {
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [showTypeHint, setShowTypeHint] = useState(false);
    const typeHintTimerRef = useRef(null);

    const triggerTypeHint = () => {
        setShowTypeHint(true);
        if (typeHintTimerRef.current) clearTimeout(typeHintTimerRef.current);
        typeHintTimerRef.current = setTimeout(() => {
            setShowTypeHint(false);
        }, 2200);
    };

    useEffect(() => {
        return () => {
            if (typeHintTimerRef.current) clearTimeout(typeHintTimerRef.current);
        };
    }, []);

    // Kunci body scroll dan escape listener
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = originalOverflow;
        };
    }, [onClose]);

    // Parse list varian produk secara aman
    const variants = useMemo(() => {
        if (!product) return [];
        if (Array.isArray(product.variants) && product.variants.length > 0) return product.variants;
        if (Array.isArray(product.sizes) && product.sizes.length > 0) {
            return product.sizes.map((s) => ({
                size: s.size,
                stock: s.quantity,
                price: null,
                imageUrl: null,
            }));
        }
        return [];
    }, [product]);

    // Inisialisasi varian aktif ke varian pertama yang punya stok
    useEffect(() => {
        if (variants.length > 0 && !selectedVariant) {
            const firstAvail = variants.find((v) => (v.stock ?? v.quantity ?? 0) > 0) || variants[0];
            setSelectedVariant(firstAvail);
        }
    }, [variants, selectedVariant]);

    if (!product || !mounted) return null;

    const isWholesale = Boolean(product.isWholesale);
    const wholesaleTiers = isWholesale ? normalizeWholesaleTiers(product.wholesaleTiers) : [];

    const maxStock = selectedVariant
        ? Math.max(0, selectedVariant.stock ?? selectedVariant.quantity ?? 0)
        : (variants.length > 0 ? 0 : Math.max(0, product.quantity ?? 0));

    const isSoldOut = maxStock <= 0;
    const basePrice = selectedVariant?.price != null ? selectedVariant.price : product.price;

    const activeTierMatch = isWholesale && wholesaleTiers.length > 0
        ? getApplicableWholesaleTier(product, quantity, selectedVariant)
        : null;

    const effectiveUnitPrice = getEffectiveUnitPrice(product, selectedVariant, quantity);
    const totalPrice = effectiveUnitPrice * quantity;
    const totalBasePrice = basePrice * quantity;
    const hasDiscount = totalBasePrice > totalPrice;
    const discountPercent = hasDiscount
        ? Math.round(((totalBasePrice - totalPrice) / totalBasePrice) * 100)
        : (activeTierMatch?.percentDiscount || 0);

    const activeDisplayImage = selectedVariant?.imageUrl || product.image || '/img/betta-1.png';

    const formattedAccumulatedBase = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(totalBasePrice);

    const formattedAccumulatedTotal = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(totalPrice);

    const ctaLabel = action === 'buy' ? 'Beli Sekarang' : 'Tambah ke Keranjang';

    const handleCommit = () => {
        if (isSoldOut) return;
        const size = selectedVariant?.size || null;
        onCommit(size, selectedVariant, quantity);
    };

    // Label taksonomi / departemen
    const taxonomyTag = product.department?.name || product.category || product.form || 'Koleksi Pilihan';

    return createPortal(
        <div
            className={styles.backdrop}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="presentation"
        >
            <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`Pilih varian ${product.name}`}>
                {/* Drag handle untuk mobile bottom sheet */}
                <span className={styles.dragHandle} aria-hidden="true" />

                {/* Header Produk */}
                <div className={styles.header}>
                    <div className={styles.thumbWrapper}>
                        <Image
                            src={activeDisplayImage}
                            alt={product.name}
                            fill
                            sizes="96px"
                            className={styles.thumbImg}
                        />
                    </div>
                    <div className={styles.headerInfo}>
                        <div className={styles.metaRow}>
                            <span className={styles.categoryTag}>{taxonomyTag}</span>
                            <span className={styles.stockBadge}>
                                <span className={`${styles.stockDot} ${isSoldOut ? styles.stockDotOut : ''}`} />
                                {isSoldOut ? 'Stok Habis' : `${maxStock} Tersedia`}
                            </span>
                        </div>

                        <h3 className={styles.productTitle} title={product.name}>
                            {product.name}
                        </h3>

                        <div className={styles.priceBlock}>
                            {hasDiscount ? (
                                <>
                                    <del className={styles.strikethroughPrice}>
                                        {formattedAccumulatedBase}
                                    </del>
                                    <span className={styles.unitPrice}>{formattedAccumulatedTotal}</span>
                                    <span className={styles.discountBadge}>
                                        -{discountPercent}%
                                    </span>
                                </>
                            ) : (
                                <span className={styles.unitPrice}>{formattedAccumulatedTotal}</span>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className={styles.closeBtn}
                        aria-label="Tutup jendela varian"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Pilihan Varian */}
                {variants.length > 0 && (
                    <div className={styles.sectionBlock}>
                        <div className={styles.sectionHeader}>
                            <span className={styles.sectionLabel}>Pilih Varian</span>
                            {selectedVariant && (
                                <span className={styles.selectedSummary}>
                                    Terpilih: <strong>{selectedVariant.size}</strong>
                                </span>
                            )}
                        </div>
                        <div className={styles.variantGrid}>
                            {variants.map((v) => {
                                const stock = v.stock ?? v.quantity ?? 0;
                                const out = stock <= 0;
                                const isSelected = selectedVariant?.size === v.size;
                                const vPriceText = v.price != null
                                    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v.price)
                                    : null;

                                return (
                                    <button
                                        key={v.size}
                                        type="button"
                                        disabled={out}
                                        onClick={() => {
                                            if (!out) {
                                                setSelectedVariant(v);
                                                if (quantity > stock) setQuantity(stock);
                                            }
                                        }}
                                        className={[
                                            styles.variantCard,
                                            isSelected && styles.variantCardActive,
                                            out && styles.variantCardDisabled,
                                        ].filter(Boolean).join(' ')}
                                        title={out ? 'Varian ini habis' : `${v.size} (${stock} tersedia)`}
                                    >
                                        <div className={styles.variantTitleRow}>
                                            <span className={styles.variantName}>{v.size}</span>
                                            {isSelected && (
                                                <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        {vPriceText && (
                                            <span className={styles.variantPriceTag}>{vPriceText}</span>
                                        )}
                                        <span className={styles.variantStockTag}>
                                            {out ? 'Habis' : `Stok: ${stock}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pilihan Partai (Wholesale) */}
                {isWholesale && wholesaleTiers.length > 0 && (
                    <div className={styles.wholesaleBox}>
                        <div className={styles.wholesaleHeader}>
                            <div className={styles.wholesaleHeaderLeft}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.wholesaleHeaderIcon}>
                                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                                <span>Harga Khusus Partai (Grosir)</span>
                            </div>
                            <span className={styles.wholesalePromoTag}>
                                {wholesaleTiers.length} Level Diskon
                            </span>
                        </div>

                        <div className={styles.wholesaleTiersGrid}>
                            {wholesaleTiers.map((tier, idx) => {
                                const isTierActive = activeTierMatch?.minQty === tier.minQty;
                                const isOutOfStock = maxStock < tier.minQty;
                                const tierMatch = getApplicableWholesaleTier(product, tier.minQty, selectedVariant);
                                const tierDisplayPrice = tierMatch ? tierMatch.unitPrice : tier.price;
                                const savings = tierMatch ? tierMatch.discountPerItem : Math.max(0, basePrice - tier.price);

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={isOutOfStock}
                                        onClick={() => {
                                            setQuantity(tier.minQty);
                                        }}
                                        className={[
                                            styles.tierCard,
                                            isTierActive && styles.tierCardActive,
                                            isOutOfStock && styles.tierCardDisabled,
                                        ].filter(Boolean).join(' ')}
                                        title={isOutOfStock ? 'Stok tidak mencukupi untuk tier ini' : `Pilih partai ${tier.minQty}+ ekor`}
                                    >
                                        <span className={styles.tierCardLevel}>Level {idx + 1}</span>
                                        <span className={styles.tierCardQty}>{tier.minQty}+ Ekor</span>
                                        <span className={styles.tierCardPrice}>
                                            Rp {tierDisplayPrice.toLocaleString('id-ID')}
                                        </span>
                                        {savings > 0 && (
                                            <span className={styles.tierCardDiscount}>
                                                -Rp {savings.toLocaleString('id-ID')}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Kontrol Kuantitas Nominal */}
                <div className={styles.quantityRow}>
                    <div className={styles.quantityLabelCol}>
                        <span className={styles.quantityTitle}>Jumlah Pesanan</span>
                        <span className={styles.quantitySubtitle}>
                            {selectedVariant
                                ? `Stok ${selectedVariant.size}: ${maxStock} ekor`
                                : `Tersedia: ${maxStock} ekor`}
                        </span>
                    </div>

                    <div className={styles.stepperWrapper}>
                        {showTypeHint && (
                            <div className={styles.typeHintBubble} role="status" aria-live="polite">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                </svg>
                                <span>Bisa ketik jumlah langsung</span>
                            </div>
                        )}

                        <div className={styles.stepperBox}>
                            <button
                                type="button"
                                className={styles.stepperBtn}
                                disabled={quantity <= 1 || isSoldOut}
                                onClick={() => {
                                    setQuantity((q) => Math.max(1, q - 1));
                                    triggerTypeHint();
                                }}
                                aria-label="Kurangi jumlah pesanan"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min="1"
                                max={Math.max(1, maxStock)}
                                className={styles.stepperInput}
                                value={quantity}
                                disabled={isSoldOut}
                                onFocus={() => setShowTypeHint(false)}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (Number.isNaN(val) || val < 1) {
                                        setQuantity(1);
                                    } else {
                                        setQuantity(Math.min(maxStock, val));
                                    }
                                }}
                                aria-label="Kuantitas pesanan"
                            />
                            <button
                                type="button"
                                className={styles.stepperBtn}
                                disabled={quantity >= maxStock || isSoldOut}
                                onClick={() => {
                                    setQuantity((q) => Math.min(maxStock, q + 1));
                                    triggerTypeHint();
                                }}
                                aria-label="Tambah jumlah pesanan"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer & CTA Button */}
                <div className={styles.footerArea}>
                    {quantity > 1 && (
                        <div className={styles.subtotalRow}>
                            <span className={styles.subtotalLabel}>
                                Subtotal ({quantity} ekor):
                            </span>
                            <span className={styles.subtotalPrice}>{formattedAccumulatedTotal}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleCommit}
                        disabled={isSoldOut}
                        className={styles.commitBtn}
                    >
                        <svg className={styles.commitBtnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="9" cy="21" r="1" />
                            <circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                        <span>{ctaLabel}</span>
                        <span>•</span>
                        <span>{formattedAccumulatedTotal}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
