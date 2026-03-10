'use client';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CheckoutPage() {
    const { cart, total, updateQuantity, removeFromCart } = useCart();
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        city: '',
        address: '',
        zip: ''
    });

    const formattedTotal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(total);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProceed = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.address || !formData.phone) {
            alert('Mohon lengkapi detail pengiriman.');
            return;
        }
        localStorage.setItem('temp-shipment', JSON.stringify(formData));
        router.push('/payment');
    };

    if (cart.length === 0) {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem' }}>Inventaris Anda Kosong</h2>
                <Link href="/produk" className="btn btn-primary" style={{ marginTop: '2rem' }}>Jelajahi Galeri</Link>
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <section style={{ padding: '8rem 0' }}>
                <div className="container">
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', marginBottom: '4rem' }}>Ringkasan Akuisisi</h1>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '4rem' }}>

                        <div className="checkout-left">
                            <div className="cart-items" style={{ marginBottom: '4rem' }}>
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Spesimen Terpilih</h3>
                                {cart.map((item) => (
                                    <div key={item.id} style={{ display: 'flex', gap: '2rem', padding: '2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                            <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>{item.name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Spesimen {item.category}</p>
                                        </div>
                                        <div className="qty-control">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn">-</button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn">+</button>
                                        </div>
                                        <div style={{ textAlign: 'right', minWidth: '150px' }}>
                                            <p style={{ fontSize: '1.1rem' }}>
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}
                                            </p>
                                            <button onClick={() => removeFromCart(item.id)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                                                HAPUS
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="shipment-form" style={{ background: 'rgba(255,255,255,0.02)', padding: '3rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Detail Pengiriman</h3>
                                <form onSubmit={handleProceed} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nama Lengkap</label>
                                        <input type="text" name="name" className="search-input" style={{ width: '100%' }} value={formData.name} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Alamat Email</label>
                                        <input type="email" name="email" className="search-input" style={{ width: '100%' }} value={formData.email} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nomor Telepon</label>
                                        <input type="text" name="phone" className="search-input" style={{ width: '100%' }} value={formData.phone} onChange={handleInputChange} required />
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Alamat Pengiriman</label>
                                        <textarea name="address" className="search-input" style={{ width: '100%', minHeight: '100px', resize: 'none' }} value={formData.address} onChange={handleInputChange} required></textarea>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kota</label>
                                        <input type="text" name="city" className="search-input" style={{ width: '100%' }} value={formData.city} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kode Pos</label>
                                        <input type="text" name="zip" className="search-input" style={{ width: '100%' }} value={formData.zip} onChange={handleInputChange} required />
                                    </div>
                                    <button type="submit" id="submit-shipment" style={{ display: 'none' }}></button>
                                </form>
                            </div>
                        </div>

                        <div className="summary-card" style={{ padding: '3rem', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', height: 'fit-content', position: 'sticky', top: '120px' }}>
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '2rem' }}>Total Akuisisi</h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
                                <span>Subtotal</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', fontSize: '1.1rem' }}>
                                <span>Penanganan Aman</span>
                                <span style={{ color: 'var(--secondary)' }}>Gratis</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', fontSize: '1.8rem', fontWeight: '600', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
                                <span>Total</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <button
                                onClick={() => document.getElementById('submit-shipment').click()}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1.2rem' }}
                            >
                                Lanjutkan Ke Pembayaran Aman
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1.5rem', lineHeight: '1.5' }}>
                                Dengan melanjutkan, Anda menyetujui syarat akuisisi dan penanganan spesimen elit kami.
                            </p>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
