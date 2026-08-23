'use client';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './CartSidebar.module.css';

export default function CartSidebar() {
    const {
        cart,
        cartCheckedTotal,
        checkedCount,
        allChecked,
        isCartOpen,
        toggleCart,
        updateQuantity,
        removeFromCart,
        toggleItemCheck,
        toggleAllChecked,
        removeCheckedItems,
        setDirectCheckoutItem
    } = useCart();
    const router = useRouter();

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        // Clear any direct checkout item so checkout processes checked cart items
        setDirectCheckoutItem(null);
        toggleCart();
        router.push('/checkout');
    };

    const handleBulkDelete = () => {
        if (checkedCount === 0) return;
        const confirmed = window.confirm(
            `Hapus ${checkedCount} item terpilih dari keranjang?`
        );
        if (confirmed) removeCheckedItems();
    };

    const formattedCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <>
            <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={toggleCart}></div>
            <div className={`cart-sidebar ${isCartOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h2 className="cart-header-title">Keranjang</h2>
                    <button onClick={toggleCart} className="cart-header-close">×</button>
                </div>

                {cart.length > 0 && (
                    <div className={styles.bulkBar}>
                        <label className={styles.selectAllLabel}>
                            <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={toggleAllChecked}
                                aria-label="Pilih semua item"
                            />
                            <span>Pilih Semua</span>
                            <span className={styles.selectAllCount}>
                                ({checkedCount}/{cart.length})
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            className={styles.bulkDeleteBtn}
                            disabled={checkedCount === 0}
                        >
                            <svg
                                className={styles.bulkDeleteIcon}
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
                            Hapus Terpilih ({checkedCount})
                        </button>
                    </div>
                )}

                <div className="cart-items-list">
                    {cart.length === 0 ? (
                        <div className="cart-empty-state">
                            <p>Belum ada spesimen terpilih.</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={`${item.id}-${item.selectedSize}`} className="cart-item-side cart-item-row">
                                {/* Checkbox for item selection */}
                                <input
                                    type="checkbox"
                                    checked={item.checked !== false}
                                    onChange={() => toggleItemCheck(item.id, item.selectedSize)}
                                    className="cart-checkbox"
                                />

                                <div className="cart-item-body">
                                    <div className="cart-item-img-wrapper">
                                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="cart-item-title">{item.name}</h4>
                                        {item.selectedSize && (
                                            <p className="cart-item-size">
                                                Size: {item.selectedSize}
                                            </p>
                                        )}
                                        <p className="cart-item-price">
                                            {formattedCurrency(item.price)}
                                        </p>
                                        <div className="qty-control mt-1 scale-90 origin-left">
                                            <button onClick={() => updateQuantity(item.id, -1, item.selectedSize)} className="qty-btn cursor-pointer">-</button>
                                            <span className="text-[var(--text-main)]">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1, item.selectedSize)} className="qty-btn cursor-pointer">+</button>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeFromCart(item.id, item.selectedSize)} 
                                    className="cart-item-remove-btn"
                                >
                                    Hapus
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="cart-footer">
                    <div className="cart-footer-row">
                        <span>Total Terpilih</span>
                        <span className="color-primary">{formattedCurrency(cartCheckedTotal)}</span>
                    </div>
                    <div className="cart-footer-btn-group">
                        <button onClick={toggleCart} className="btn btn-outline cart-footer-btn">Batal</button>
                        <button
                            onClick={handleCheckout}
                            className="btn btn-primary cart-footer-btn"
                            disabled={cart.filter(i => i.checked !== false).length === 0}
                        >
                            Lanjut Checkout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
