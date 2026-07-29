'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

// Shopee-style size picker: opens when a buyer clicks "Beli Sekarang" or the
// cart icon on a ProductCard that has multiple sizes. User picks a size in a
// bottom-sheet-like modal, then the action (add-to-cart / buy-now) completes.
//
// Props:
//   product   — the full product object (needs id, name, price, image, sizes[])
//   action    — 'cart' | 'buy'
//   onClose   — close handler (backdrop click, escape, or after commit)
//   onCommit  — (selectedSize) => void  runs after user picks + confirms

export default function SizePickerModal({ product, action, onClose, onCommit }) {
    // Portal target = document.body — see note below.
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Escape to close + body scroll lock
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
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];

    const priceFormatted = new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(product.price);

    const ctaLabel = action === 'buy' ? 'Beli Sekarang' : 'Tambah ke Keranjang';

    // Render into document.body via a portal. Without this, any ancestor with
    // `transform` / `filter` / `will-change` (Tailwind's `transform` utility
    // on ProductCard.card is the culprit) creates a stacking context that
    // traps `position: fixed`. Result before portal: modal appears INSIDE the
    // card, clipped by `overflow: hidden` — looking like a "second UI".
    return createPortal(
        <div
            className="size-picker-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="size-picker-sheet" role="dialog" aria-modal="true">
                {/* Header with product preview */}
                <div className="size-picker-header">
                    <div className="size-picker-thumb">
                        {product.image && (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="96px"
                                className="size-picker-thumb-img"
                            />
                        )}
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

                {/* Size options */}
                <div className="size-picker-section">
                    <div className="size-picker-label">Ukuran</div>
                    {sizes.length === 0 ? (
                        <p className="size-picker-empty">Produk ini tidak punya varian ukuran.</p>
                    ) : (
                        <div className="size-picker-options">
                            {sizes.map((s) => {
                                const soldOut = (s.quantity || 0) <= 0;
                                return (
                                    <SizeOption
                                        key={s.size}
                                        size={s.size}
                                        stock={s.quantity}
                                        soldOut={soldOut}
                                        onPick={() => { if (!soldOut) onCommit(s.size); }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="size-picker-footer-hint">
                    Klik ukuran di atas untuk langsung {ctaLabel.toLowerCase()}.
                </div>
            </div>
        </div>,
        document.body
    );
}

function SizeOption({ size, stock, soldOut, onPick }) {
    return (
        <button
            type="button"
            onClick={onPick}
            disabled={soldOut}
            className={`size-picker-option ${soldOut ? 'size-picker-option-out' : ''}`}
            title={soldOut ? 'Stok habis' : `${stock} tersedia`}
        >
            <span className="size-picker-option-label">{size}</span>
            <span className="size-picker-option-stock">
                {soldOut ? 'Habis' : `${stock} tersedia`}
            </span>
        </button>
    );
}
