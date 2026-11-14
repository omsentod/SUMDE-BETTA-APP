'use client';

import { useCart } from '@/context/CartContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PaymentMethodPicker from '@/components/PaymentMethodPicker';
import { calcPaymentFee, isValidPaymentMethod } from '@/lib/paymentFee';
import { useToast } from '@/context/ToastContext';
import styles from './payment.module.css';

// Ambang basi untuk state checkout yang tersimpan di localStorage
// (temp-shipment, active-payment), disamakan dengan payment_due_date DOKU
// (24 jam, lihat createCheckoutSession di src/lib/doku.js).
const CHECKOUT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function isFresh(createdAt) {
    return typeof createdAt === 'number' && Date.now() - createdAt <= CHECKOUT_SESSION_TTL_MS;
}

export default function PaymentPage() {
    const { checkoutTotal: total, clearCheckout: clearCart, checkoutItems: cart } = useCart();
    const { toast, confirmDialog } = useToast();
    const router = useRouter();

    const [shipment, setShipment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resuming, setResuming] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('QRIS');
    // True saat user klik "Ganti Metode Pembayaran" dari waiting screen —
    // menampilkan ulang picker tapi tetap reuse order PENDING yang sama
    // (bukan bikin order baru).
    const [isChangingMethod, setIsChangingMethod] = useState(false);

    const [orderError, setOrderError] = useState('');
    const [activePayment, setActivePayment] = useState(null);
    const [status, setStatus] = useState('pending'); // 'pending' | 'checkout_created' | 'success'
    const [completedOrderId, setCompletedOrderId] = useState(null);
    const [timeLeftMs, setTimeLeftMs] = useState(null);

    // Auto-check helper — polls the minimal /status endpoint (no PII exposed).
    const autoCheckPayment = useCallback(async (orderId) => {
        if (!orderId) return;
        try {
            const res = await fetch(`/api/orders/${orderId}/status`);
            if (res.ok) {
                const { status: orderStatus } = await res.json();
                if (orderStatus === 'PAID' || orderStatus === 'PROCESSING') {
                    setCompletedOrderId(orderId);
                    setStatus('success');
                    clearCart();
                    localStorage.removeItem('temp-shipment');
                    localStorage.removeItem('active-payment');
                } else if (orderStatus === 'CANCELLED') {
                    // Pesanan sudah dibatalkan — bersihkan state aktif agar tidak menjebak user
                    localStorage.removeItem('active-payment');
                    setStatus('pending');
                    setActivePayment(null);
                }
            } else if (res.status === 404) {
                localStorage.removeItem('active-payment');
                setStatus('pending');
                setActivePayment(null);
            }
        } catch (err) {
            console.error('Failed to auto-check order status:', err);
        }
    }, [clearCart]);

    // 1. Load temp-shipment and check for active payment on mount
    useEffect(() => {
        let hasFreshShipment = false;
        let shipmentTimestamp = 0;
        let nextShipment = null;
        let nextActivePayment = null;

        const shipData = typeof window !== 'undefined' ? localStorage.getItem('temp-shipment') : null;
        if (shipData) {
            try {
                const parsed = JSON.parse(shipData);
                if (isFresh(parsed.createdAt)) {
                    nextShipment = parsed;
                    hasFreshShipment = true;
                    shipmentTimestamp = parsed.createdAt || 0;
                } else {
                    localStorage.removeItem('temp-shipment');
                }
            } catch (e) {
                console.error('Failed to parse temp-shipment', e);
            }
        }

        let hasFreshActivePayment = false;
        const activePayData = typeof window !== 'undefined' ? localStorage.getItem('active-payment') : null;
        if (activePayData) {
            try {
                const parsed = JSON.parse(activePayData);
                // Hanya resume sesi active-payment jika sesi checkout (temp-shipment) tidak lebih baru!
                // Jika temp-shipment lebih baru, user baru saja dari /checkout untuk pesanan baru.
                const isNewerCheckout = hasFreshShipment && shipmentTimestamp > (parsed.createdAt || 0);
                if (isFresh(parsed.createdAt) && !isNewerCheckout) {
                    nextActivePayment = parsed;
                    hasFreshActivePayment = true;
                } else {
                    localStorage.removeItem('active-payment');
                }
            } catch (e) {
                console.error('Failed to parse active-payment', e);
            }
        }

        if (nextShipment) {
            setTimeout(() => setShipment(nextShipment), 0);
        }
        if (nextActivePayment) {
            setTimeout(() => {
                setActivePayment(nextActivePayment);
                setStatus('checkout_created');
                autoCheckPayment(nextActivePayment.orderId);
            }, 0);
        }

        if (!hasFreshShipment && !hasFreshActivePayment) {
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

    // 1c. Countdown timer 24 jam untuk sesi pembayaran aktif
    useEffect(() => {
        if (status !== 'checkout_created' || !activePayment?.createdAt) return;

        const calcRemaining = () => {
            const expiresAt = activePayment.createdAt + CHECKOUT_SESSION_TTL_MS;
            return Math.max(0, expiresAt - Date.now());
        };

        setTimeLeftMs(calcRemaining());

        const timer = setInterval(() => {
            const remaining = calcRemaining();
            setTimeLeftMs(remaining);
            if (remaining <= 0) {
                clearInterval(timer);
                if (activePayment?.orderId) {
                    autoCheckPayment(activePayment.orderId);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [status, activePayment?.createdAt, activePayment?.orderId, autoCheckPayment]);

    // Handle browser back button when on waiting screen:
    // Arahkan ke Pesanan Saya dan bersihkan state lokal tanpa membatalkan order di DB
    useEffect(() => {
        const handlePop = () => {
            if (status === 'checkout_created') {
                localStorage.removeItem('active-payment');
                localStorage.removeItem('temp-shipment');
                router.push('/customer/orders');
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [status, router]);

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
            toast.error('Data ongkir hilang. Silakan kembali ke halaman checkout.');
            router.push('/checkout');
            return;
        }
        if (!isValidPaymentMethod(paymentMethod)) {
            toast.warning('Pilih metode pembayaran terlebih dahulu.');
            return;
        }
        setLoading(true);
        setOrderError('');
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
                    telegramUsername: shipment.telegramUsername || null,
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
                amount: data.amount,
                createdAt: Date.now()
            };

            // Save details to state & local storage
            setActivePayment(payDetails);
            localStorage.setItem('active-payment', JSON.stringify(payDetails));
            setIsChangingMethod(false);

            // Bersihkan keranjang checkout sekarang karena order PENDING sudah tercatat di DB
            clearCart();
            localStorage.removeItem('temp-shipment');

            // Redirect to Doku Hosted Checkout Page
            window.location.href = data.paymentUrl;

        } catch (err) {
            console.error('Error starting Doku payment:', err);
            const msg = err.message || 'Terjadi kesalahan sistem.';
            setOrderError(msg);
            toast.error(msg);
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
                createdAt: Date.now(),
            };
            setActivePayment(payDetails);
            localStorage.setItem('active-payment', JSON.stringify(payDetails));
            window.location.href = data.paymentUrl;
        } catch (err) {
            console.error('Error resuming Doku payment:', err);
            toast.error(err.message || 'Gagal membuat ulang sesi pembayaran.');
        } finally {
            setResuming(false);
        }
    };

    const formatCountdown = (ms) => {
        if (ms === null) return '--:--:--';
        if (ms <= 0) return '00:00:00 (Waktu Habis)';
        const totalSec = Math.floor(ms / 1000);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // Saat user memilih "Bayar Nanti (Pesanan Saya)" setelah kembali/back dari DOKU:
    // Pesanan di database TETAP berstatus PENDING (tidak dibatalkan).
    // State lokal dibersihkan dan user diarahkan ke Pesanan Saya.
    const handlePayLater = () => {
        localStorage.removeItem('active-payment');
        localStorage.removeItem('temp-shipment');
        toast.info('Pesanan tersimpan di menu Pesanan Saya. Selesaikan pembayaran dalam 24 jam.');
        router.push('/customer/orders');
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
                setCompletedOrderId(activePayment.orderId);
                setStatus('success');
                clearCart();
                localStorage.removeItem('temp-shipment');
                localStorage.removeItem('active-payment');
                toast.success('Pembayaran terverifikasi! Pesanan Anda sedang diproses.');
            } else if (orderStatus === 'CANCELLED') {
                localStorage.removeItem('active-payment');
                setStatus('pending');
                setActivePayment(null);
                toast.info('Pesanan ini telah dibatalkan.');
            } else {
                toast.warning('Pembayaran belum terdeteksi. Silakan selesaikan pembayaran terlebih dahulu di DOKU.');
            }
        } catch (err) {
            console.error('Error checking status:', err);
            toast.error(err.message || 'Gagal mengecek status pembayaran.');
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleCancelPayment = async () => {
        const confirmed = await confirmDialog({
            title: 'Batalkan Transaksi?',
            message: 'Apakah Anda ingin membatalkan transaksi pembayaran aktif ini? Pesanan akan ditandai dibatalkan.',
            confirmText: 'Ya, Batalkan',
            cancelText: 'Kembali',
            isDanger: true,
        });
        if (!confirmed) return;

        // Mark order CANCELLED di server DULU. Kalau gagal, jangan clear local
        // state — supaya user tahu pesanan belum ter-cancel (admin masih lihat
        // PENDING). Cegah drift UI vs DB.
        if (activePayment?.orderId) {
            let ok = false;
            try {
                const res = await fetch(`/api/orders/${activePayment.orderId}/cancel`, { method: 'POST' });
                if (res.ok) {
                    ok = true;
                    toast.info('Pesanan berhasil dibatalkan.');
                } else {
                    const errData = await res.json().catch(() => ({}));
                    // Jika order ternyata sudah berstatus CANCELLED di server, tetap bersihkan state
                    if (res.status === 409 && errData.error?.includes('CANCELLED')) {
                        ok = true;
                        toast.info('Pesanan sudah berstatus dibatalkan.');
                    } else {
                        toast.error(`Gagal membatalkan pesanan: ${errData.error || res.statusText}.`);
                    }
                }
            } catch (err) {
                console.error('Cancel order network error:', err);
                toast.error('Gagal menghubungi server untuk membatalkan pesanan.');
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
                        <h1 className={styles.successTitle}>Pembayaran Berhasil</h1>
                        {completedOrderId && (
                            <div className={styles.successOrderBadge}>
                                No. Pesanan: <b>#{completedOrderId.slice(0, 8).toUpperCase()}</b>
                            </div>
                        )}
                        <p className={styles.successDesc}>
                            Pembayaran Anda telah sukses diverifikasi oleh DOKU. Ikan pilihan Anda sedang kami persiapkan untuk proses kurasi, pengemasan oksigen aman, dan pengiriman bergaransi.
                        </p>
                        <div className={styles.successButtonGroup}>
                            {completedOrderId && (
                                <button
                                    type="button"
                                    onClick={() => router.push(`/invoice/${completedOrderId}`)}
                                    className={`btn btn-primary ${styles.invoiceBtn}`}
                                >
                                    Lihat &amp; Cetak Faktur (Invoice)
                                </button>
                            )}
                            {completedOrderId && (
                                <button
                                    type="button"
                                    onClick={() => router.push(`/lacak-pesanan?orderId=${completedOrderId}`)}
                                    className={`btn btn-outline ${styles.trackBtn}`}
                                >
                                    Lacak Pengiriman
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className={`btn btn-outline ${styles.homeBtn}`}
                            >
                                Kembali ke Beranda
                            </button>
                        </div>
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
                                        Pilih metode pembayaran yang Anda inginkan. Anda akan diarahkan ke portal resmi <b>DOKU</b>.
                                    </p>
                                    <PaymentMethodPicker
                                        value={paymentMethod}
                                        onChange={setPaymentMethod}
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
                                        <div className={styles.shippingInfoTopActions}>
                                            {shipment?.shipping?.serviceName && (
                                                <span className={styles.courierChip}>{shipment.shipping.serviceName}</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => router.push('/checkout')}
                                                className={styles.editAddressBtn}
                                            >
                                                Ubah
                                            </button>
                                        </div>
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
                                        {shipment?.postalCode ? `, Kode Pos ${shipment.postalCode}` : ''}
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
                                    {shipment?.shipping?.isOuterJava && (
                                        <div className={styles.surchargeSubtext}>
                                            Termasuk karantina &amp; packing luar Jawa (+{formatIDR(shipment.shipping.surcharge || 10000)})
                                        </div>
                                    )}

                                    <div className={styles.summaryCalcRow}>
                                        <span className={styles.calcLabel}>Biaya Layanan</span>
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
                                            'Bayar Sekarang'
                                        )}
                                    </button>

                                    {orderError && (
                                        <div className={styles.orderErrorBox}>
                                            <div className={styles.orderErrorHeader}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                                <span>{orderError}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => router.push('/checkout')}
                                                className={styles.orderErrorActionBtn}
                                            >
                                                Periksa Alamat di Checkout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Waiting/Callback state saat kembali dari DOKU */}
                    {status === 'checkout_created' && activePayment && !isChangingMethod && (
                        <div className={styles.waitingCard}>
                            <div className={styles.waitingIconCircle}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>

                            <span className={styles.waitingBadge}>Menunggu Pembayaran</span>
                            <h2 className={styles.waitingTitle}>Selesaikan Pembayaran Anda</h2>

                            <div className={styles.waitingRecapBox}>
                                <div className={styles.waitingRecapRow}>
                                    <span className={styles.waitingRecapLabel}>No. Pesanan</span>
                                    <span className={styles.waitingRecapValue}>#{activePayment.orderId.slice(0, 8).toUpperCase()}</span>
                                </div>
                                <div className={styles.waitingRecapRow}>
                                    <span className={styles.waitingRecapLabel}>Total Tagihan</span>
                                    <span className={styles.waitingRecapTotal}>{formatIDR(activePayment.amount)}</span>
                                </div>
                            </div>

                            <div className={styles.countdownContainer}>
                                <div className={styles.countdownHeader}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span>Batas Waktu Pembayaran (24 Jam)</span>
                                </div>
                                <div className={styles.countdownDigits}>
                                    {formatCountdown(timeLeftMs)}
                                </div>
                            </div>

                            <p className={styles.waitingText}>
                                Pesanan Anda telah tersimpan dengan aman. Silakan selesaikan transaksi di portal <b>DOKU</b> atau pilih <b>Bayar Nanti</b> untuk menyelesaikannya melalui menu Pesanan Saya sebelum batas waktu berakhir.
                            </p>

                            <div className={styles.twoBtnGroup}>
                                <button
                                    type="button"
                                    onClick={handlePayLater}
                                    className={`btn btn-outline ${styles.payLaterBtn}`}
                                    disabled={resuming}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span>Bayar Nanti</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResumeToDoku}
                                    className={`btn btn-primary ${styles.continueBtn}`}
                                    disabled={resuming || (timeLeftMs !== null && timeLeftMs <= 0)}
                                >
                                    {resuming ? (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.btnSpinner} aria-hidden="true">
                                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                                            </svg>
                                            <span>Menghubungkan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                                <line x1="2" y1="10" x2="22" y2="10" />
                                            </svg>
                                            <span>Bayar Sekarang</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </section>
        </div>
    );
}
