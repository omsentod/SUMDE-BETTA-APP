'use client';

import { useCart } from '@/context/CartContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PaymentMethodPicker from '@/components/PaymentMethodPicker';
import { calcPaymentFee, getMethodLabel, isValidPaymentMethod } from '@/lib/paymentFee';
import styles from './payment.module.css';

export default function PaymentPage() {
    const { checkoutTotal: total, clearCheckout: clearCart, checkoutItems: cart } = useCart();
    const router = useRouter();

    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resuming, setResuming] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState(null);
    // True saat user klik "Ganti Metode Pembayaran" dari waiting screen —
    // menampilkan ulang picker tapi tetap reuse order PENDING yang sama
    // (bukan bikin order baru).
    const [isChangingMethod, setIsChangingMethod] = useState(false);

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
                if (orderStatus === 'PAID' || orderStatus === 'PROCESSING') {
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
            try {
                setShipment(JSON.parse(shipData));
            } catch (e) {
                console.error('Failed to parse temp-shipment', e);
            }
        }

        const activePayData = localStorage.getItem('active-payment');
        if (activePayData) {
            try {
                const parsed = JSON.parse(activePayData);
                setActivePayment(parsed);
                setStatus('checkout_created');
                // Auto check status immediately on load (in case they just redirected back)
                autoCheckPayment(parsed.orderId);
            } catch (e) {
                console.error('Failed to parse active-payment', e);
            }
        } else if (!shipData && !activePayData) {
            // Redirect to checkout if no shipping context
            router.push('/checkout');
        }
    }, [router, autoCheckPayment]);

    // 1b. Interval polling while waiting for payment
    useEffect(() => {
        if (status !== 'checkout_created' || !activePayment?.orderId) return;
        const interval = setInterval(() => {
            autoCheckPayment(activePayment.orderId);
        }, 4000);
        return () => clearInterval(interval);
    }, [status, activePayment?.orderId, autoCheckPayment]);

    const formatIDR = (v) => new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(v || 0);

   
    const breakdown = useMemo(() => {
        const subtotal = total || 0;
        const shippingFee = Number(shipment?.shipping?.fee) || 0;
        const paymentFee = isValidPaymentMethod(paymentMethod)
            ? calcPaymentFee(paymentMethod, subtotal + shippingFee)
            : 0;
        return { subtotal, shippingFee, paymentFee, grandTotal: subtotal + shippingFee + paymentFee };
    }, [total, shipment, paymentMethod]);

    // Minta sesi DOKU Checkout baru untuk order yang sudah ada. Dipakai untuk
    // order baru, retry dengan metode sama (URL lama bisa saja sudah expired
    // / channel jadi inactive), maupun setelah ganti metode pembayaran.
    const requestFreshDokuSession = async (orderId) => {
        const callbackUrl = window.location.origin + '/payment';
        const dokuRes = await fetch('/api/payment/doku', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, callbackUrl })
        });
        if (!dokuRes.ok) {
            const errData = await dokuRes.json();
            throw new Error(errData.error || 'Gagal membuat link pembayaran Doku.');
        }
        return dokuRes.json();
    };

    // 2. Inisiasi Doku Checkout — dipakai untuk order baru (status 'pending')
    // maupun retry dengan metode baru pada order PENDING yang sudah ada
    // (isChangingMethod). Pada kasus kedua, order TIDAK dibuat ulang — hanya
    // field paymentMethod di-update — supaya tidak muncul order duplikat
    // untuk cart yang sama.
    const handleProceedToDoku = async () => {
        if (!isChangingMethod && (!shipment?.shipping?.courier || !shipment?.shipping?.service)) {
            alert('Data ongkir hilang. Silakan kembali ke halaman checkout.');
            router.push('/checkout');
            return;
        }
        if (!isValidPaymentMethod(paymentMethod)) {
            alert('Pilih metode pembayaran terlebih dahulu.');
            return;
        }
        setLoading(true);
        try {
            let orderId;

            if (isChangingMethod && activePayment?.orderId) {
                orderId = activePayment.orderId;
                const methodRes = await fetch(`/api/orders/${orderId}/payment-method`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentMethod }),
                });
                if (!methodRes.ok) {
                    const errData = await methodRes.json();
                    throw new Error(errData.error || 'Gagal mengubah metode pembayaran.');
                }
            } else {
                // Step 1: Create order as PENDING in database
                const orderPayload = {
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
                        selectedSize: item.selectedSize
                    })),
                    shipping: {
                        courier: shipment.shipping.courier,
                        service: shipment.shipping.service,
                    },
                    paymentMethod,
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
                orderId = createdOrder.id;
            }

            // Step 2: Request Doku Checkout session (selalu fresh)
            const data = await requestFreshDokuSession(orderId);

            const payDetails = {
                orderId,
                paymentUrl: data.paymentUrl,
                amount: data.amount
            };

            // Save details to state & local storage
            setActivePayment(payDetails);
            localStorage.setItem('active-payment', JSON.stringify(payDetails));
            setIsChangingMethod(false);

            // Redirect to Doku Hosted Checkout Page
            window.location.href = data.paymentUrl;

        } catch (err) {
            console.error('Error starting Doku payment:', err);
            alert(err.message || 'Terjadi kesalahan sistem.');
        } finally {
            setLoading(false);
        }
    };

    // "Lanjutkan Ke DOKU" pada waiting screen — regenerate sesi baru (bukan
    // reuse activePayment.paymentUrl lama) supaya tidak kena expired
    // session/channel inactive saat retry dengan metode yang sama.
    const handleResumeToDoku = async () => {
        if (!activePayment?.orderId) return;
        setResuming(true);
        try {
            const data = await requestFreshDokuSession(activePayment.orderId);
            const payDetails = {
                orderId: activePayment.orderId,
                paymentUrl: data.paymentUrl,
                amount: data.amount,
            };
            setActivePayment(payDetails);
            localStorage.setItem('active-payment', JSON.stringify(payDetails));
            window.location.href = data.paymentUrl;
        } catch (err) {
            console.error('Error resuming Doku payment:', err);
            alert(err.message || 'Gagal membuat ulang sesi pembayaran.');
        } finally {
            setResuming(false);
        }
    };

    const handleOpenChangeMethod = () => {
        setPaymentMethod(null); // reset pilihan biar user pilih ulang secara sadar
        setIsChangingMethod(true);
    };

    const handleCancelChangeMethod = () => {
        setIsChangingMethod(false);
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
            if (orderStatus === 'PAID' || orderStatus === 'PROCESSING') {
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

    const handleCancelPayment = async () => {
        if (!confirm('Apakah Anda ingin membatalkan transaksi pembayaran aktif ini? Pesanan akan ditandai dibatalkan.')) return;
        // Mark order CANCELLED di server DULU. Kalau gagal, jangan clear local
        // state — supaya user tahu pesanan belum ter-cancel (admin masih lihat
        // PENDING). Cegah drift UI vs DB.
        if (activePayment?.orderId) {
            let ok = false;
            try {
                const res = await fetch(`/api/orders/${activePayment.orderId}/cancel`, { method: 'POST' });
                if (res.ok) {
                    ok = true;
                } else {
                    const errData = await res.json().catch(() => ({}));
                    alert(`Gagal membatalkan pesanan: ${errData.error || res.statusText}. Coba lagi atau hubungi admin.`);
                }
            } catch (err) {
                console.error('Cancel order network error:', err);
                alert('Gagal menghubungi server untuk membatalkan pesanan. Cek koneksi lalu coba lagi.');
            }
            if (!ok) return; // pertahankan state lokal — biar user retry
        }
        localStorage.removeItem('active-payment');
        setStatus('pending');
        setActivePayment(null);
    };

    // SUCCESS SCREEN
    if (status === 'success') {
        return (
            <div className="payment-page">
                <section className={styles.sectionPadding}>
                    <div className={styles.successContainer}>
                        <div className={styles.successIconCircle}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h1 className={styles.successTitle}>Akuisisi Dikonfirmasi</h1>
                        <p className={styles.successDesc}>
                            Pembayaran Anda telah sukses diverifikasi oleh DOKU. Spesimen elit pilihan Anda sedang kami persiapkan untuk proses kurasi dan pengiriman bergaransi.
                        </p>
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className={`btn btn-primary ${styles.homeBtn}`}
                        >
                            Kembali ke Beranda
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="payment-page">
            <section className={styles.sectionPadding}>
                <div className={`container ${styles.paymentContainer}`}>
                    
                    {/* Header */}
                    <div className={styles.headerText}>
                        <h1 className={styles.headerTitle}>Penyelesaian Pembayaran</h1>
                        <p className={styles.headerDesc}>
                            {isChangingMethod
                                ? 'Pilih metode pembayaran baru untuk pesanan yang sama.'
                                : status === 'pending'
                                ? 'Pilih metode pembayaran Anda untuk menyelesaikan pesanan.'
                                : 'Pembayaran Anda sedang berjalan. Segera selesaikan transaksi Anda di portal DOKU.'}
                        </p>
                    </div>

                    {/* Step 1: Pending landing page (juga dipakai saat ganti metode) */}
                    {(status === 'pending' || (status === 'checkout_created' && isChangingMethod)) && (
                        <div className={styles.gridTwoCol}>
                            {/* Actions Card — payment method picker */}
                            <div className={styles.actionsCard}>
                                <div>
                                    {isChangingMethod && (
                                        <button
                                            type="button"
                                            onClick={handleCancelChangeMethod}
                                            className={styles.backToWaitingBtn}
                                        >
                                            ← Kembali ke Status Pembayaran
                                        </button>
                                    )}
                                    <div className={styles.cardSectionHeader}>
                                        <h3 className={styles.cardSectionTitle}>PILIH METODE PEMBAYARAN</h3>
                                    </div>
                                    <p className={styles.cardDescription}>
                                        Biaya admin otomatis terhitung transparan. Anda akan diarahkan ke portal resmi <b>DOKU</b>.
                                    </p>
                                    <PaymentMethodPicker
                                        value={paymentMethod}
                                        onChange={setPaymentMethod}
                                        base={breakdown.subtotal + breakdown.shippingFee}
                                    />
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className={styles.summaryCard}>
                                <div className={styles.cardSectionHeader}>
                                    <h3 className={styles.cardSectionTitle}>RINGKASAN TAGIHAN</h3>
                                </div>

                                {/* Destination Address Box (Top) */}
                                <div className={styles.shippingInfoBoxTop}>
                                    <div className={styles.shippingInfoTopHeader}>
                                        <div className={styles.shippingInfoTitleRow}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span>Kirim Ke</span>
                                        </div>
                                        {shipment?.shipping?.serviceName && (
                                            <span className={styles.courierChip}>{shipment.shipping.serviceName}</span>
                                        )}
                                    </div>
                                    <div className={styles.recipientRow}>
                                        <p className={styles.recipientName}>{shipment?.name || 'Penerima'}</p>
                                        <p className={styles.recipientPhone}>{shipment?.phone || '-'}</p>
                                    </div>
                                    <p className={styles.recipientAddress}>
                                        {shipment?.streetAddress}
                                        {shipment?.village ? `, Kel. ${shipment.village}` : ''}
                                        {shipment?.city ? `, ${shipment.city}` : ''}
                                        {shipment?.province ? `, ${shipment.province}` : ''}
                                    </p>
                                </div>

                                <div className={styles.summaryItemsList}>
                                    {cart.map(item => (
                                        <div key={`${item.id}-${item.selectedSize}`} className={styles.summaryItemRow}>
                                            <span className={styles.itemDesc} title={item.name}>
                                                {item.name} {item.selectedSize ? `(${item.selectedSize})` : ''} × {item.quantity}
                                            </span>
                                            <span className={styles.itemPrice}>{formatIDR(item.price * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>

                                <hr className={styles.breakdownDivider} />

                                <div>
                                    <div className={styles.summaryCalcRow}>
                                        <span className={styles.calcLabel}>Subtotal Produk</span>
                                        <span className={styles.calcValue}>{formatIDR(breakdown.subtotal)}</span>
                                    </div>

                                    <div className={styles.summaryCalcRow}>
                                        <span className={styles.calcLabel}>
                                            Ongkos Kirim {shipment?.shipping?.serviceName ? `(${shipment.shipping.serviceName})` : ''}
                                        </span>
                                        <span className={styles.calcValue}>{formatIDR(breakdown.shippingFee)}</span>
                                    </div>

                                    <div className={styles.summaryCalcRow}>
                                        <span className={styles.calcLabel}>
                                            Biaya Admin {isValidPaymentMethod(paymentMethod) ? `(${getMethodLabel(paymentMethod)})` : ''}
                                        </span>
                                        <span className={styles.calcValue}>
                                            {breakdown.paymentFee === 0 && isValidPaymentMethod(paymentMethod) ? (
                                                <span className={styles.freeFeeBadge}>Gratis</span>
                                            ) : (
                                                formatIDR(breakdown.paymentFee)
                                            )}
                                        </span>
                                    </div>

                                    <div className={styles.summaryTotalRow}>
                                        <span>Total Tagihan</span>
                                        <span className={styles.totalHighlight}>{formatIDR(breakdown.grandTotal)}</span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleProceedToDoku}
                                        className={`btn btn-primary ${styles.dokuBtn}`}
                                        disabled={loading || !isValidPaymentMethod(paymentMethod)}
                                    >
                                        {loading ? (
                                            <>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.btnSpinner}>
                                                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                                                </svg>
                                                {isChangingMethod ? 'Menyimpan metode...' : 'Menghubungkan ke DOKU...'}
                                            </>
                                        ) : !isValidPaymentMethod(paymentMethod) ? (
                                            'Pilih Metode Pembayaran'
                                        ) : (
                                            `Bayar ${formatIDR(breakdown.grandTotal)} via DOKU`
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Waiting/Callback state */}
                    {status === 'checkout_created' && activePayment && !isChangingMethod && (
                        <div className={styles.waitingCard}>
                            <div className={styles.spinner}></div>

                            <h2 className={styles.waitingTitle}>Menunggu Pembayaran</h2>
                            <p className={styles.waitingText}>
                                Sesi pembayaran DOKU Checkout telah berhasil dibuat. Silakan selesaikan transaksi Anda di jendela DOKU, lalu klik periksa status di bawah. Kalau Anda kembali dari DOKU tanpa membayar, lanjutkan sesi ini atau ganti metode pembayaran.
                            </p>

                            <div className={styles.btnGroup}>
                                <button
                                    type="button"
                                    onClick={handleResumeToDoku}
                                    className={`btn btn-primary ${styles.continueBtn}`}
                                    disabled={resuming}
                                >
                                    {resuming ? 'Menyiapkan...' : 'Lanjutkan Ke DOKU'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenChangeMethod}
                                    className={styles.changeMethodBtn}
                                    disabled={resuming}
                                >
                                    Ganti Metode Pembayaran
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCheckStatus}
                                    className={styles.checkStatusBtn}
                                    disabled={checkingStatus}
                                >
                                    {checkingStatus ? 'Memeriksa...' : 'Cek Status Pembayaran'}
                                </button>
                                <button
                                    type="button"
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
