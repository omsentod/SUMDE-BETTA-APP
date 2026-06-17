'use client';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CartSidebar() {
    const { 
        cart, 
        checkoutTotal, 
        isCartOpen, 
        toggleCart, 
        updateQuantity, 
        removeFromCart,
        toggleItemCheck,
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

    const formattedCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    return (
        <>
            <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={toggleCart}></div>
            <div className={`cart-sidebar ${isCartOpen ? 'open' : ''}`}>
                <div className="cart-header">
                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontStyle: 'italic' }}>Keranjang</h2>
                    <button onClick={toggleCart} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
                </div>

                <div className="cart-items-list">
                    {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: '5rem', color: 'var(--text-muted)' }}>
                            <p>Belum ada spesimen terpilih.</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.id} className="cart-item-side" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {/* Checkbox for item selection (Shopee style) */}
                                <input
                                    type="checkbox"
                                    checked={item.checked !== false}
                                    onChange={() => toggleItemCheck(item.id)}
                                    style={{
                                        cursor: 'pointer',
                                        width: '18px',
                                        height: '18px',
                                        accentColor: 'var(--primary)',
                                        flexShrink: 0
                                    }}
                                />

                                <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '0.5rem', overflow: 'hidden', flexShrink: 0 }}>
                                        <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '0.95rem', marginBottom: '0.2rem', color: 'var(--text-main)' }}>{item.name}</h4>
                                        <p style={{ color: '#FF6B35', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {formattedCurrency(item.price)}
                                        </p>
                                        <div className="qty-control" style={{ marginTop: '0.4rem', scale: '0.8', originX: 'left' }}>
                                            <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn" style={{ cursor: 'pointer' }}>-</button>
                                            <span style={{ color: 'var(--text-main)' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn" style={{ cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeFromCart(item.id)} 
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        color: 'var(--primary)', 
                                        cursor: 'pointer', 
                                        fontSize: '0.75rem',
                                        padding: '0.5rem 0'
                                    }}
                                >
                                    Hapus
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="cart-footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-main)' }}>
                        <span>Total Terpilih</span>
                        <span style={{ color: '#FF6B35' }}>{formattedCurrency(checkoutTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={toggleCart} className="btn btn-outline" style={{ flex: 1, padding: '0.8rem', cursor: 'pointer' }}>Batal</button>
                        <button
                            onClick={handleCheckout}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '0.8rem', cursor: 'pointer' }}
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
