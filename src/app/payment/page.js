'use client';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentPage() {
    const { total, clearCart, cart } = useCart();
    const [status, setStatus] = useState('pending'); 
    const [shipment, setShipment] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const data = localStorage.getItem('temp-shipment');
        if (data) setShipment(JSON.parse(data));
    }, []);

    const formattedTotal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(total);

    useEffect(() => {
        if (status === 'processing') {
            const timer = setTimeout(() => {
                setStatus('success');
                clearCart();
                localStorage.removeItem('temp-shipment');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [status, clearCart]);

    if (status === 'success') {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <div style={{ fontSize: '5rem', color: 'var(--secondary)', marginBottom: '2rem' }}>✓</div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '4rem', marginBottom: '1rem' }}>Akuisisi Dikonfirmasi</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>Garis keturunan telah diamankan. Pengiriman kurir ke <b>{shipment?.address}</b> sedang dimulai.</p>
                <button onClick={() => router.push('/')} className="btn btn-primary">Kembali ke Beranda</button>
            </div>
        );
    }

    return (
        <div className="payment-page">
            <section style={{ padding: '8rem 0' }}>
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', marginBottom: '1rem' }}>Penyelesaian Aman</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Pindai kode QRIS dinamis di bawah untuk menyelesaikan pengadaan.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                background: 'white',
                                padding: '2rem',
                                borderRadius: '1.5rem',
                                display: 'inline-block',
                                boxShadow: '0 0 50px rgba(0,180,216,0.3)'
                            }}>
                                <div style={{ width: '250px', height: '250px', background: '#f5f5f5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: '100%', height: '100%', position: 'relative', opacity: status === 'processing' ? 0.3 : 1 }}>
                                        <div style={{ width: '100%', height: '100%', background: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 15px 15px' }}></div>
                                    </div>
                                    <div style={{ position: 'absolute', width: '60px', height: '60px', background: 'white', borderRadius: '0.8rem', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Image src="/logo.png" alt="Sumde Logo" width={50} height={50} style={{ borderRadius: '0.5rem' }} />
                                    </div>
                                    {status === 'processing' && (
                                        <div style={{ position: 'absolute', color: 'black', fontWeight: 'bold' }}>Memverifikasi...</div>
                                    )}
                                </div>
                            </div>
                            <div style={{ marginTop: '2rem' }}>
                                <button
                                    onClick={() => setStatus('processing')}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    disabled={status === 'processing'}
                                >
                                    {status === 'processing' ? 'Memproses Penyelesaian...' : 'Saya Sudah Transfer'}
                                </button>
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', letterSpacing: '0.2rem', marginBottom: '1.5rem' }}>RINGKASAN PESANAN</h3>
                            <div style={{ marginBottom: '2rem' }}>
                                {cart.map(item => (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                        <span>{item.name} x {item.quantity}</span>
                                        <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Total Tagihan</span>
                                    <span>{formattedTotal}</span>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', letterSpacing: '0.2rem', marginBottom: '1rem' }}>DIKIRIM KE</h3>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                <p style={{ color: 'white', fontWeight: '500' }}>{shipment?.name}</p>
                                <p>{shipment?.phone}</p>
                                <p>{shipment?.address}</p>
                                <p>{shipment?.city}, {shipment?.zip}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
