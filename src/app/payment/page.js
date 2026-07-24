'use client';
import { useCart } from '@/context/CartContext';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentPage() {
    const { checkoutTotal: total, clearCheckout: clearCart, checkoutItems: cart } = useCart();
    const router = useRouter();

    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    
    // Sesi Checkout Details
    const [activePayment, setActivePayment] = useState(null);
    const [status, setStatus] = useState('pending'); // 'pending' | 'checkout_created' | 'success'

    // Auto-check helper
    const autoCheckPayment = useCallback(async (orderId) => {
        if (!orderId) return;
        try {
            // Session cookie is sent automatically; guest orders (userId null)
            // are readable via their UUID.
            const res = await fetch(`/api/orders/${orderId}`);
            if (res.ok) {
                const order = await res.json();
                if (order.status === 'PROCESSING') {
                    setStatus('success');
                    clearCart();
                    localStorage.removeItem('temp-shipment');
                    localStorage.removeItem('active-payment');
                }
            }
        } catch (err) {
            console.error('Failed to auto-check order status:', err);
        }
    }, [clearCart]);

    // 1. Load temp-shipment and check for active payment on mount
    useEffect(() => {
        const shipData = localStorage.getItem('temp-shipment');
        if (shipData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShipment(JSON.parse(shipData));
        }

        const activePayData = localStorage.getItem('active-payment');
        if (activePayData) {
            const parsed = JSON.parse(activePayData);
            setActivePayment(parsed);
            setStatus('checkout_created');
            // Auto check status immediately on load (in case they just redirected back)
            autoCheckPayment(parsed.orderId);
        } else if (!shipData && !activePayData) {
            // Redirect to checkout if no shipping context
            router.push('/checkout');
        }
    }, [router, autoCheckPayment]);

    const formattedTotal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(total);

    // 2. Inisiasi Doku Checkout
    const handleProceedToDoku = async () => {
        setLoading(true);
        try {
            // Step 1: Create order as PENDING in database
            const orderPayload = {
                total,
                status: 'PENDING',
                name: shipment.name,
                email: shipment.email,
                phone: shipment.phone,
                streetAddress: shipment.streetAddress,
                rtRw: shipment.rtRw,
                province: shipment.province,
                city: shipment.city,
                district: shipment.district,
                village: shipment.village,
                postalCode: shipment.postalCode,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    selectedSize: item.selectedSize
                }))
            };

            const orderRes = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderRes.ok) {
                const errData = await orderRes.json();
                throw new Error(errData.error || 'Gagal membuat pesanan.');
            }

            const createdOrder = await orderRes.json();

            // Step 2: Request Doku Checkout session
            const callbackUrl = window.location.origin + '/payment';
            const dokuRes = await fetch('/api/payment/doku', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: createdOrder.id,
                    callbackUrl
                })
            });

            if (!dokuRes.ok) {
                const errData = await dokuRes.json();
                throw new Error(errData.error || 'Gagal membuat link pembayaran Doku.');
            }

            const data = await dokuRes.json();

            const payDetails = {
                orderId: createdOrder.id,
                paymentUrl: data.paymentUrl,
                amount: data.amount
            };

            // Save details to state & local storage
            setActivePayment(payDetails);
            localStorage.setItem('active-payment', JSON.stringify(payDetails));
            
            // Redirect to Doku Hosted Checkout Page
            window.location.href = data.paymentUrl;

        } catch (err) {
            console.error('Error starting Doku payment:', err);
            alert(err.message || 'Terjadi kesalahan sistem.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Manual Check Status
    const handleCheckStatus = async () => {
        if (!activePayment?.orderId) return;

        setCheckingStatus(true);
        try {
            const res = await fetch(`/api/orders/${activePayment.orderId}`);
            if (!res.ok) {
                throw new Error('Gagal memverifikasi status pesanan.');
            }

            const order = await res.json();
            if (order.status === 'PROCESSING') {
                setStatus('success');
                clearCart();
                localStorage.removeItem('temp-shipment');
                localStorage.removeItem('active-payment');
            } else {
                alert('Pembayaran belum terdeteksi. Silakan lakukan pembayaran terlebih dahulu di halaman DOKU.');
            }
        } catch (err) {
            console.error('Error checking status:', err);
            alert(err.message || 'Gagal mengecek status pembayaran.');
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleCancelPayment = () => {
        if (confirm('Apakah Anda ingin membatalkan transaksi pembayaran aktif ini?')) {
            localStorage.removeItem('active-payment');
            setStatus('pending');
            setActivePayment(null);
        }
    };

    // SUCCESS SCREEN
    if (status === 'success') {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <div style={{ fontSize: '6rem', color: '#00b4d8', marginBottom: '2rem' }}>✓</div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '4rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Akuisisi Dikonfirmasi</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.1rem' }}>
                    Pembayaran Anda telah sukses diverifikasi oleh DOKU. Spesimen elit Anda sedang kami proses untuk pengiriman.
                </p>
                <button onClick={() => router.push('/')} className="btn btn-primary" style={{ padding: '1rem 2.5rem' }}>Kembali ke Beranda</button>
            </div>
        );
    }

    return (
        <div className="payment-page">
            <section style={{ padding: '8rem 0' }}>
                <div className="container" style={{ maxWidth: '850px' }}>
                    
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
                        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', marginBottom: '0.8rem', color: 'var(--text-main)' }}>Penyelesaian Aman</h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            {status === 'pending' 
                                ? 'Konfirmasi akuisisi Anda menggunakan portal pembayaran terenkripsi DOKU Checkout.' 
                                : 'Pembayaran Anda sedang berjalan. Segera selesaikan transaksi Anda di portal DOKU.'}
                        </p>
                    </div>

                    {/* Step 1: Pending landing page */}
                    {status === 'pending' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '3rem' }}>
                            {/* Actions Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2.5rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', letterSpacing: '0.2rem', marginBottom: '2rem', textTransform: 'uppercase' }}>DOKU CHECKOUT</h3>
                                    
                                    <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '3rem' }}>
                                        <p>Anda akan dialihkan ke halaman aman <b>DOKU Checkout</b> untuk menyelesaikan transaksi.</p>
                                        <p style={{ marginTop: '0.5rem' }}>Metode yang didukung di portal Doku Sandbox:</p>
                                        <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                                            <li>Virtual Account (BCA, Mandiri, BNI, BRI, Permata)</li>
                                            <li>QRIS (Pindai Barcode dinamis)</li>
                                            <li>Credit Card (Uji coba CC Sandbox)</li>
                                            <li>O2O / Convenience Store (Alfamart / Indomaret)</li>
                                        </ul>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProceedToDoku}
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '1.3rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                                    disabled={loading}
                                >
                                    {loading ? 'Menghubungkan ke DOKU...' : 'Bayar Sekarang via DOKU Checkout'}
                                </button>
                            </div>

                            {/* Summary Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', height: 'fit-content' }}>
                                <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', letterSpacing: '0.2rem', marginBottom: '1.5rem', textTransform: 'uppercase' }}>RINGKASAN TAGIHAN</h3>
                                <div style={{ marginBottom: '2rem' }}>
                                    {cart.map(item => (
                                        <div key={`${item.id}-${item.selectedSize}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{item.name} x {item.quantity}</span>
                                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                                        <span>Total Tagihan</span>
                                        <span style={{ color: '#00b4d8' }}>{formattedTotal}</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', letterSpacing: '0.2rem', marginBottom: '1rem', textTransform: 'uppercase' }}>PENGIRIMAN</h3>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                    <p style={{ color: 'white', fontWeight: '500', margin: '0 0 0.3rem 0' }}>{shipment?.name}</p>
                                    <p style={{ margin: '0 0 0.3rem 0' }}>{shipment?.phone}</p>
                                    <p style={{ margin: '0' }}>{shipment?.streetAddress}, Kel. {shipment?.village}, {shipment?.city}, {shipment?.province}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Waiting/Callback state */}
                    {status === 'checkout_created' && activePayment && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '3.5rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                border: '3px solid rgba(0, 180, 216, 0.2)',
                                borderTop: '3px solid #00b4d8',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 2.5rem auto'
                            }}></div>
                            
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', marginBottom: '1rem', color: 'var(--text-main)' }}>Menunggu Pembayaran</h2>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 2.5rem auto', lineHeight: '1.6' }}>
                                Halaman pembayaran DOKU Checkout telah berhasil dibuat. Silakan selesaikan pembayaran di jendela baru, lalu kembali ke sini untuk memeriksa status pembayaran Anda.
                            </p>

                            <style jsx>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                            `}</style>

                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
                                <button
                                    onClick={() => window.location.href = activePayment.paymentUrl}
                                    className="btn btn-primary"
                                    style={{ flex: 1.2, padding: '1.2rem', cursor: 'pointer', fontSize: '0.95rem' }}
                                >
                                    Lanjutkan Ke DOKU
                                </button>
                                <button
                                    onClick={handleCheckStatus}
                                    style={{
                                        flex: 1.2,
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        padding: '1.2rem',
                                        borderRadius: '0.8rem',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem'
                                    }}
                                    disabled={checkingStatus}
                                >
                                    {checkingStatus ? 'Memeriksa...' : 'Cek Status Pembayaran'}
                                </button>
                                <button
                                    onClick={handleCancelPayment}
                                    style={{
                                        flex: 0.6,
                                        background: 'rgba(255, 0, 0, 0.1)',
                                        border: '1px solid rgba(255, 0, 0, 0.2)',
                                        color: '#ff6b6b',
                                        padding: '1.2rem',
                                        borderRadius: '0.8rem',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </section>
        </div>
    );
}
