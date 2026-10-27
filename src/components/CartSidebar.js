'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import styles from './CartSidebar.module.css';

function CartItemImage({ src, alt }) {
    const [imgSrc, setImgSrc] = useState(src || '/img/betta-1.png');

    useEffect(() => {
        setImgSrc(src || '/img/betta-1.png');
    }, [src]);

    return (
        <Image
            src={imgSrc}
            alt={alt || 'Produk'}
            fill
            sizes="80px"
            className={styles.itemImage}
            onError={() => setImgSrc('/img/betta-1.png')}
        />
    );
}

export default function CartSidebar() {

    const {
        cart,
        cartCheckedTotal,
        checkedCount,
        allChecked,
        itemCount,
        isCartOpen,
        toggleCart,
        updateQuantity,
        removeFromCart,
        toggleItemCheck,
        toggleAllChecked,
        removeCheckedItems,
        setDirectCheckoutItem
    } = useCart();

    const { confirmDialog } = useToast();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll and register Escape key listener when cart is open
    useEffect(() => {
        if (!isCartOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                toggleCart();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCartOpen, toggleCart]);

    if (!mounted) return null;

    const handleCheckout = () => {
        setDirectCheckoutItem(null);
        toggleCart();
        router.push('/checkout');
    };

    const handleBulkDelete = async () => {
        if (checkedCount === 0) return;
        const confirmed = await confirmDialog({
            title: 'Hapus Item Terpilih',
            message: `Hapus ${checkedCount} produk terpilih dari keranjang belanja Anda?`,
            confirmText: 'Hapus',
            cancelText: 'Batal',
            isDanger: true,
        });
        if (confirmed) {
            removeCheckedItems();
        }
    };

    const handleNavigateToProduct = (id) => {
        toggleCart();
        router.push(`/produk/${id}`);
    };

    const handleStartShopping = () => {
        toggleCart();
        router.push('/produk');
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(val || 0);
    };

    return createPortal(
        <div
            className={`${styles.container} ${isCartOpen ? styles.isOpen : ''}`}
            aria-hidden={!isCartOpen}
        >
            {/* Backdrop overlay */}
            <div
                className={styles.overlay}
                onClick={toggleCart}
                aria-label="Tutup keranjang"
            />

            {/* Slide-over Drawer Panel */}
            <aside
                className={styles.sidebar}
                role="dialog"
                aria-modal="true"
                aria-label="Keranjang Belanja"
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerTitleGroup}>
                        <div className={styles.headerIconWrapper}>
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                        </div>
                        <div className={styles.headerTextGroup}>
                            <h2 className={styles.title}>Keranjang Belanja</h2>
                            {itemCount > 0 && (
                                <span className={styles.itemBadge}>
                                    {itemCount}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleCart}
                        className={styles.closeBtn}
                        aria-label="Tutup keranjang"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Bulk action selection bar */}
                {cart.length > 0 && (
                    <div className={styles.bulkBar}>
                        <label className={styles.selectAllLabel}>
                            <span className={styles.checkboxWrapper}>
                                <input
                                    type="checkbox"
                                    checked={allChecked}
                                    onChange={toggleAllChecked}
                                    className={styles.checkboxInput}
                                    aria-label="Pilih semua item"
                                />
                                <span className={styles.customCheckbox} aria-hidden="true">
                                    <svg viewBox="0 0 24 24">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </span>
                            </span>
                            <span>Pilih Semua</span>
                            <span className={styles.selectAllCount}>
                                ({checkedCount}/{cart.length})
                            </span>
                        </label>
                        {checkedCount > 0 && (
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                className={styles.bulkDeleteBtn}
                                aria-label="Hapus item terpilih"
                            >
                                <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                                <span>Hapus ({checkedCount})</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Cart items list */}
                <div className={styles.itemsList}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIconCircle}>
                                <svg
                                    width="38"
                                    height="38"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                            </div>
                            <h3 className={styles.emptyTitle}>Keranjang Belanja Kosong</h3>
                            <p className={styles.emptyDesc}>
                                Belum ada produk atau ikan hias pilihan di keranjang Anda.
                            </p>
                            <button
                                type="button"
                                onClick={handleStartShopping}
                                className={styles.emptyCta}
                            >
                                Mulai Belanja
                            </button>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div
                                key={`${item.id}-${item.selectedSize}`}
                                className={`${styles.itemCard} ${item.checked !== false ? styles.isSelected : ''}`}
                            >
                                <div className={styles.itemCheckboxWrapper}>
                                    <label className={styles.checkboxWrapper}>
                                        <input
                                            type="checkbox"
                                            checked={item.checked !== false}
                                            onChange={() => toggleItemCheck(item.id, item.selectedSize)}
                                            className={styles.checkboxInput}
                                            aria-label={`Pilih ${item.name}`}
                                        />
                                        <span className={styles.customCheckbox} aria-hidden="true">
                                            <svg viewBox="0 0 24 24">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </span>
                                    </label>
                                </div>

                                <div
                                    className={styles.itemImageWrapper}
                                    onClick={() => handleNavigateToProduct(item.id)}
                                    title={`Lihat detail ${item.name}`}
                                >
                                    <CartItemImage
                                        src={item.image}
                                        alt={item.name}
                                    />
                                </div>

                                <div className={styles.itemDetails}>
                                    <div className={styles.itemHeaderRow}>
                                        <h4
                                            className={styles.itemTitle}
                                            onClick={() => handleNavigateToProduct(item.id)}
                                            title={item.name}
                                        >
                                            {item.name}
                                        </h4>
                                        <button
                                            type="button"
                                            onClick={() => removeFromCart(item.id, item.selectedSize)}
                                            className={styles.itemDeleteBtn}
                                            title="Hapus item"
                                            aria-label={`Hapus ${item.name} dari keranjang`}
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                <path d="M10 11v6" />
                                                <path d="M14 11v6" />
                                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                            </svg>
                                        </button>
                                    </div>

                                    {item.selectedSize && (
                                        <div className={styles.variantTag}>
                                            <span>Varian: {item.selectedSize}</span>
                                        </div>
                                    )}

                                    <div className={styles.itemPriceAndQty}>
                                        <span className={styles.itemPrice}>
                                            {formatCurrency(item.price)}
                                        </span>

                                        <div className={styles.stepper}>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, -1, item.selectedSize)}
                                                className={styles.stepperBtn}
                                                aria-label="Kurangi jumlah"
                                                disabled={item.quantity <= 1}
                                            >
                                                <svg
                                                    width="11"
                                                    height="11"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    aria-hidden="true"
                                                >
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            </button>
                                            <span className={styles.stepperValue}>
                                                {item.quantity || 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, 1, item.selectedSize)}
                                                className={styles.stepperBtn}
                                                aria-label="Tambah jumlah"
                                            >
                                                <svg
                                                    width="11"
                                                    height="11"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    aria-hidden="true"
                                                >
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer & Checkout */}
                {cart.length > 0 && (
                    <div className={styles.footer}>
                        <div className={styles.summaryContainer}>
                            <div className={styles.summaryRow}>
                                <div className={styles.summaryLabelGroup}>
                                    <span className={styles.summaryLabel}>Total Pembayaran</span>
                                    <span className={styles.summarySublabel}>
                                        ({checkedCount} barang terpilih)
                                    </span>
                                </div>
                                <span className={styles.summaryTotal}>
                                    {formatCurrency(cartCheckedTotal)}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckout}
                            className={styles.checkoutBtn}
                            disabled={checkedCount === 0}
                        >
                            <span>
                                {checkedCount === 0
                                    ? 'Pilih Produk Terlebih Dahulu'
                                    : `Lanjut ke Pembayaran (${checkedCount})`}
                            </span>
                            {checkedCount > 0 && (
                                <svg
                                    width="17"
                                    height="17"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            )}
                        </button>

                        <div className={styles.trustBadge}>
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <polyline points="9 12 11 14 15 10" />
                            </svg>
                            <span>Garansi Ikan Hidup & Pengiriman Berstandar</span>
                        </div>
                    </div>
                )}
            </aside>
        </div>,
        document.body
    );
}
