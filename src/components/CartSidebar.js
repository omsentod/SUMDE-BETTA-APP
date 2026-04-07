'use client';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CartSidebar() {
    const { cart, total, isCartOpen, toggleCart, updateQuantity, removeFromCart } = useCart();
    const router = useRouter();

    if (!isCartOpen) return null;

    const handleCheckout = () => {
        toggleCart();
        router.push('/checkout');
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
                            <div key={item.id} className="cart-item-side">
                                <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', flexShrink: 0 }}>
                                    <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{item.name}</h4>
                                    <p style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price)}
                                    </p>
                                    <div className="qty-control" style={{ marginTop: '0.5rem', scale: '0.8', originX: 'left' }}>
                                        <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn">-</button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn">+</button>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    Hapus
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="cart-footer">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '600' }}>
                        <span>Total Akuisisi</span>
                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={toggleCart} className="btn btn-outline" style={{ flex: 1, padding: '0.8rem' }}>Batal</button>
                        <button
                            onClick={handleCheckout}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '0.8rem' }}
                            disabled={cart.length === 0}
                        >
                            Lanjut Checkout
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
