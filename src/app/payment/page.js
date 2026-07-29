'use client';
import { useCart } from '@/context/CartContext';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './payment.module.css';

export default function PaymentPage() {
    const { checkoutTotal: total, clearCheckout: clearCart, checkoutItems: cart } = useCart();
    const router = useRouter();

    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    
    // Sesi Checkout Details
    const [activePayment, setActivePayment] = useState(null);
    const [status, setStatus] = useState('pending'); // 'pending' | 'checkout_created' | 'success'

    // Auto-check helper — polls the minimal /status endpoint (no PII exposed).
    const autoCheckPayment = useCallback(async (orderId) => {
        if (!orderId) return;
        try {
            const res = await fetch(`/api/orders/${orderId}/status`);
            if (res.ok) {
                const { status: orderStatus } = await res.json();
                if (orderStatus === 'PROCESSING') {
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
            const res = await fetch(`/api/orders/${activePayment.orderId}/status`);
            if (!res.ok) {
                throw new Error('Gagal memverifikasi status pesanan.');
            }

            const { status: orderStatus } = await res.json();
            if (orderStatus === 'PROCESSING') {
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
            <section className={styles.sectionPadding}>
                <div className={`container ${styles.paymentContainer}`}>
                    
                    {/* Header */}
                    <div className={styles.headerText}>
                        <h1 className={styles.headerTitle}>Penyelesaian Aman</h1>
                        <p className="text-[var(--text-muted)]">
                            {status === 'pending' 
                                ? 'Konfirmasi akuisisi Anda menggunakan portal pembayaran terenkripsi DOKU Checkout.' 
                                : 'Pembayaran Anda sedang berjalan. Segera selesaikan transaksi Anda di portal DOKU.'}
                        </p>
                    </div>

                    {/* Step 1: Pending landing page */}
                    {status === 'pending' && (
                        <div className={styles.gridTwoCol}>
                            {/* Actions Card */}
                            <div className={styles.actionsCard}>
                                <div>
                                    <h3 className={styles.cardSectionTitle}>DOKU CHECKOUT</h3>
                                    
                                    <div className={styles.cardDescription}>
                                        <p>Anda akan dialihkan ke halaman aman <b>DOKU Checkout</b> untuk menyelesaikan transaksi.</p>
                                        <p className="mt-2">Metode yang didukung di portal Doku Sandbox:</p>
                                        <ul className={styles.methodList}>
                                            <li>Virtual Account (BCA, Mandiri, BNI, BRI, Permata)</li>
                                            <li>QRIS (Pindai Barcode dinamis)</li>
                                            <li>Credit Card (Uji coba CC Sandbox)</li>
                                            <li>O2O / Convenience Store (Alfamart / Indomaret)</li>
                                        </ul>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProceedToDoku}
                                    className={`btn btn-primary ${styles.dokuBtn}`}
                                    disabled={loading}
                                >
                                    {loading ? 'Menghubungkan ke DOKU...' : 'Bayar Sekarang via DOKU Checkout'}
                                </button>
                            </div>

                            {/* Summary Card */}
                            <div className={styles.summaryCard}>
                                <h3 className={styles.cardSectionTitle}>RINGKASAN TAGIHAN</h3>
                                <div className="mb-8">
                                    {cart.map(item => (
                                        <div key={`${item.id}-${item.selectedSize}`} className={styles.summaryItemRow}>
                                            <span className="text-[var(--text-muted)]">{item.name} x {item.quantity}</span>
                                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                    <div className={styles.summaryTotalRow}>
                                        <span>Total Tagihan</span>
                                        <span className="color-secondary">{formattedTotal}</span>
                                    </div>
                                </div>

                                <h3 className={styles.cardSectionTitle}>PENGIRIMAN</h3>
                                <div className={styles.shippingInfoBox}>
                                    <p className="text-white font-medium mb-1">{shipment?.name}</p>
                                    <p className="mb-1">{shipment?.phone}</p>
                                    <p className="m-0">{shipment?.streetAddress}, Kel. {shipment?.village}, {shipment?.city}, {shipment?.province}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Waiting/Callback state */}
                    {status === 'checkout_created' && activePayment && (
                        <div className={styles.waitingCard}>
                            <div className={styles.spinner}></div>
                            
                            <h2 className={styles.waitingTitle}>Menunggu Pembayaran</h2>
                            <p className={styles.waitingText}>
                                Halaman pembayaran DOKU Checkout telah berhasil dibuat. Silakan selesaikan pembayaran di jendela baru, lalu kembali ke sini untuk memeriksa status pembayaran Anda.
                            </p>

                            <div className={styles.btnGroup}>
                                <button
                                    onClick={() => window.location.href = activePayment.paymentUrl}
                                    className={`btn btn-primary ${styles.continueBtn}`}
                                >
                                    Lanjutkan Ke DOKU
                                </button>
                                <button
                                    onClick={handleCheckStatus}
                                    className={styles.checkStatusBtn}
                                    disabled={checkingStatus}
                                >
                                    {checkingStatus ? 'Memeriksa...' : 'Cek Status Pembayaran'}
                                </button>
                                <button
                                    onClick={handleCancelPayment}
                                    className={styles.cancelBtn}
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
