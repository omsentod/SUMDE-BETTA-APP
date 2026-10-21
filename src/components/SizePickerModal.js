'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

const emptySubscribe = () => () => {};

export default function SizePickerModal({ product, action, onClose, onCommit }) {
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [hoveredVariant, setHoveredVariant] = useState(null);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    if (!product || !mounted) return null;

    const variants = Array.isArray(product.variants) && product.variants.length > 0
        ? product.variants
        : (Array.isArray(product.sizes)
            ? product.sizes.map(s => ({ size: s.size, stock: s.quantity, price: null, imageUrl: null }))
            : []);

    const activeDisplayPrice = hoveredVariant?.price != null ? hoveredVariant.price : product.price;
    const activeDisplayImage = hoveredVariant?.imageUrl || product.image || '/img/betta-1.png';

    const priceFormatted = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(activeDisplayPrice);

    const ctaLabel = action === 'buy' ? 'Beli Sekarang' : 'Tambah ke Keranjang';

    return createPortal(
        <div
            className="size-picker-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="size-picker-sheet" role="dialog" aria-modal="true">
                <div className="size-picker-header">
                    <div className="size-picker-thumb">
                        <Image
                            src={activeDisplayImage}
                            alt={product.name}
                            fill
                            sizes="96px"
                            className="size-picker-thumb-img"
                        />
                    </div>
                    <div className="size-picker-info">
                        <p className="size-picker-price">{priceFormatted}</p>
                        <p className="size-picker-name">{product.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="size-picker-close"
                        aria-label="Tutup"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="size-picker-section">
                    <div className="size-picker-label">Pilih Varian</div>
                    {variants.length === 0 ? (
                        <p className="size-picker-empty">Produk ini tidak punya opsi varian.</p>
                    ) : (
                        <div className="size-picker-options">
                            {variants.map((v) => {
                                const stock = v.stock ?? v.quantity ?? 0;
                                const soldOut = stock <= 0;
                                return (
                                    <SizeOption
                                        key={v.size}
                                        size={v.size}
                                        stock={stock}
                                        price={v.price}
                                        soldOut={soldOut}
                                        onMouseEnter={() => setHoveredVariant(v)}
                                        onMouseLeave={() => setHoveredVariant(null)}
                                        onPick={() => { if (!soldOut) onCommit(v.size, v); }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="size-picker-footer-hint">
                    Pilih varian di atas untuk langsung {ctaLabel.toLowerCase()}.
                </div>
            </div>
        </div>,
        document.body
    );
}

function SizeOption({ size, stock, price, soldOut, onPick, onMouseEnter, onMouseLeave }) {
    const priceText = price != null
        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price)
        : null;

    return (
        <button
            type="button"
            onClick={onPick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            disabled={soldOut}
            className={`size-picker-option ${soldOut ? 'size-picker-option-out' : ''}`}
            title={soldOut ? 'Stok habis' : `${stock} tersedia`}
        >
            <span className="size-picker-option-label">{size}</span>
            <span className="size-picker-option-stock">
                {soldOut ? 'Habis' : `${stock} tersedia`}
            </span>
            {priceText && (
                <span className="size-picker-option-price" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', marginTop: '2px', display: 'block' }}>
                    {priceText}
                </span>
            )}
        </button>
    );
}
