'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import styles from './productDetail.module.css';

export default function ProductDetailClient() {
    const { id } = useParams();
    const router = useRouter();
    const { addToCart, buyNow } = useCart();
    const { products, isLoading } = useProducts();
    const [selectedSize, setSelectedSize] = useState('');
    const [sizeError, setSizeError] = useState('');

    const product = products.find((p) => p.id === id);

    // Reset selected size + error whenever we're viewing a different product
    // (product id changes because URL param or products list updated).
    useEffect(() => {
        if (!product) return;
        const firstAvailable = product.sizes?.find((s) => s.quantity > 0)?.size || '';
        setSelectedSize(firstAvailable);
        setSizeError('');
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

    return (
        <div className={styles.page}>
            <section className={styles.section}>
                <div className="container">
                    <div className={styles.grid}>

                        {/* Image */}
                        <div>
                            <div className={styles.imageFrame}>
                                <Image
                                    src={product.image}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 900px) 100vw, 50vw"
                                    className={styles.image}
                                />
                                {product.isSold && (
                                    <div className={styles.soldOverlay}>
                                        <span className={styles.soldBadge}>Arsip</span>
                                    </div>
                                )}
                            </div>
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
