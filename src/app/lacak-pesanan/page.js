'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CONTACT, waLink } from '@/lib/constants';
import { useToast } from '@/context/ToastContext';
import styles from './lacakPesanan.module.css';

function formatIDR(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function getStatusInfo(status) {
    switch (status) {
        case 'PENDING':
            return {
                label: 'Menunggu Pembayaran',
                className: styles.statusPending,
                step: 1,
                desc: 'Pesanan telah dibuat. Silakan selesaikan pembayaran.',
            };
        case 'PAID':
            return {
                label: 'Pembayaran Diterima',
                className: styles.statusPaid,
                step: 2,
                desc: 'Pembayaran terkonfirmasi. Ikan sedang dalam persiapan farm.',
            };
        case 'PROCESSING':
            return {
                label: 'Sedang Diproses',
                className: styles.statusProcessing,
                step: 3,
                desc: 'Ikan sedang dikarantina akhir, dipacking oksigen ganda, dan menunggu kurir.',
            };
        case 'SHIPPED':
            return {
                label: 'Sedang Dikirim',
                className: styles.statusShipped,
                step: 4,
                desc: 'Paket sudah diserahkan ke kurir dan sedang dalam perjalanan.',
            };
        case 'COMPLETED':
            return {
                label: 'Pesanan Selesai',
                className: styles.statusCompleted,
                step: 5,
                desc: 'Paket telah berhasil diterima di alamat tujuan.',
            };
        case 'CANCELLED':
            return {
                label: 'Dibatalkan',
                className: styles.statusCancelled,
                step: 0,
                desc: 'Pesanan telah dibatalkan.',
            };
        case 'RETURNED':
            return {
                label: 'Paket Dikembalikan',
                className: styles.statusReturned,
                step: 0,
                desc: 'Paket dalam proses retur/investigasi.',
            };
        default:
            return {
                label: status || 'Diproses',
                className: styles.statusProcessing,
                step: 2,
                desc: 'Pesanan dalam pemrosesan.',
            };
    }
}

function TrackOrderContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const paramOrderId = searchParams.get('orderId') || searchParams.get('id') || '';
    const paramEmail = searchParams.get('email') || searchParams.get('phone') || searchParams.get('identifier') || '';

    const [orderIdInput, setOrderIdInput] = useState(paramOrderId);
    const [identifierInput, setIdentifierInput] = useState(paramEmail);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [orderData, setOrderData] = useState(null);

    // Live Biteship courier tracking state
    const [liveTracking, setLiveTracking] = useState(null);
    const [loadingTracking, setLoadingTracking] = useState(false);

    const fetchTracking = useCallback(async (orderId, identifier) => {
        if (!orderId || !identifier) return;
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/orders/track?orderId=${encodeURIComponent(orderId)}&identifier=${encodeURIComponent(identifier)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Pesanan tidak ditemukan.');
            }
            setOrderData(data);

            // Jika ada resi dan kurir, otomatis fetch live tracking dari Biteship
            if (data.trackingNumber && data.shippingCourier) {
                setLoadingTracking(true);
                fetch(`/api/shipping/track?waybill=${encodeURIComponent(data.trackingNumber)}&courier=${encodeURIComponent(data.shippingCourier)}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((trackData) => {
                        if (trackData && Array.isArray(trackData.history)) {
                            setLiveTracking(trackData);
                        }
                    })
                    .catch((err) => console.error('Failed to fetch live courier history:', err))
                    .finally(() => setLoadingTracking(false));
            }
        } catch (err) {
            setError(err.message || 'Gagal memuat detail pesanan.');
            setOrderData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-fetch if query params are present on mount
    useEffect(() => {
        if (paramOrderId && paramEmail) {
            fetchTracking(paramOrderId, paramEmail);
        }
    }, [paramOrderId, paramEmail, fetchTracking]);

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const cleanId = orderIdInput.trim();
        const cleanIdent = identifierInput.trim();
        if (!cleanId || !cleanIdent) {
            setError('Silakan masukkan Nomor Pesanan dan Email / No. WhatsApp.');
            return;
        }
        // Update URL query params without reloading
        router.replace(`/lacak-pesanan?orderId=${encodeURIComponent(cleanId)}&email=${encodeURIComponent(cleanIdent)}`);
        fetchTracking(cleanId, cleanIdent);
    };

    const handleCopyWaybill = (code) => {
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
            toast.success('Nomor resi berhasil disalin!');
        }).catch(() => {
            toast.info(`Resi: ${code}`);
        });
    };

    const handleResetSearch = () => {
        setOrderData(null);
        setLiveTracking(null);
        setError('');
        router.replace('/lacak-pesanan');
    };

    const statusInfo = orderData ? getStatusInfo(orderData.status) : null;

    return (
        <div className={`container ${styles.pageContainer}`}>
            {/* Header */}
            <div className={styles.headerSection}>
                <div className={styles.headerBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                    <span>Layanan Mandiri Pelanggan</span>
                </div>
                <h1 className={styles.title}>Lacak Status Pesanan</h1>
                <p className={styles.subtitle}>
                    Cek progres kurasi farm, persiapan packing bergaransi, dan live tracking resi pengiriman tanpa perlu login.
                </p>
            </div>

            {/* Search Form Card (jika belum ada data atau user ingin mencari ulang) */}
            {!orderData && (
                <div className={styles.searchCard}>
                    <form onSubmit={handleFormSubmit} className={styles.searchForm}>
                        {error && (
                            <div className={styles.errorBanner} role="alert">
                                <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className={styles.formGroup}>
                            <label htmlFor="orderIdInput" className={styles.label}>
                                Nomor / ID Pesanan
                            </label>
                            <div className={styles.inputWrapper}>
                                <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                                    <path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4" />
                                    <circle cx="8" cy="12" r="2" />
                                </svg>
                                <input
                                    id="orderIdInput"
                                    type="text"
                                    className={styles.input}
                                    placeholder="Contoh: 01a19032... atau 8 digit awal"
                                    value={orderIdInput}
                                    onChange={(e) => setOrderIdInput(e.target.value)}
                                    required
                                />
                            </div>
                            <p className={styles.helpText}>
                                Dapat ditemukan pada rincian transaksi atau email konfirmasi pesanan Anda.
                            </p>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="identifierInput" className={styles.label}>
                                Email atau Nomor WhatsApp
                            </label>
                            <div className={styles.inputWrapper}>
                                <svg className={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                <input
                                    id="identifierInput"
                                    type="text"
                                    className={styles.input}
                                    placeholder="Email atau No. WhatsApp saat checkout"
                                    value={identifierInput}
                                    onChange={(e) => setIdentifierInput(e.target.value)}
                                    required
                                />
                            </div>
                            <p className={styles.helpText}>
                                Digunakan sebagai verifikasi keamanan untuk melindungi privasi pengiriman Anda.
                            </p>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="spin-animate">
                                        <line x1="12" y1="2" x2="12" y2="6" />
                                        <line x1="12" y1="18" x2="12" y2="22" />
                                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                                        <line x1="2" y1="12" x2="6" y2="12" />
                                        <line x1="18" y1="12" x2="22" y2="12" />
                                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                                    </svg>
                                    <span>Memeriksa Pesanan...</span>
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <span>Lacak Pesanan Saya</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* Results Section */}
            {orderData && (
                <div className={styles.resultsContainer}>
                    <div className={styles.topBarActions}>
                        <button
                            type="button"
                            onClick={handleResetSearch}
                            className={styles.backSearchBtn}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="19" y1="12" x2="5" y2="12" />
                                <polyline points="12 19 5 12 12 5" />
                            </svg>
                            <span>Lacak Pesanan Lain</span>
                        </button>

                        <div className={styles.orderDate}>
                            Dipesan pada: {formatDate(orderData.createdAt)}
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className={styles.orderCard}>
                        {/* Header ID & Status */}
                        <div className={styles.orderHeader}>
                            <div>
                                <div className={styles.orderHeaderId}>
                                    <span>Pesanan #{orderData.shortId}</span>
                                </div>
                                <div className={styles.orderDate}>
                                    Penerima: {orderData.recipientName} ({orderData.maskedPhone})
                                </div>
                            </div>

                            <span className={`${styles.statusBadge} ${statusInfo?.className || ''}`}>
                                {statusInfo?.label}
                            </span>
                        </div>

                        {/* Visual Stepper */}
                        {statusInfo && statusInfo.step > 0 && (
                            <div className={styles.stepperWrapper}>
                                <ol className={styles.stepperList}>
                                    <li className={`${styles.stepItem} ${statusInfo.step >= 1 ? (statusInfo.step === 1 ? styles.stepItemActive : styles.stepItemCompleted) : ''}`}>
                                        <span className={styles.stepDot}>1</span>
                                        <span className={styles.stepLabel}>Pesanan Dibuat</span>
                                    </li>
                                    <li className={`${styles.stepItem} ${statusInfo.step >= 2 ? (statusInfo.step === 2 ? styles.stepItemActive : styles.stepItemCompleted) : ''}`}>
                                        <span className={styles.stepDot}>2</span>
                                        <span className={styles.stepLabel}>Lunas</span>
                                    </li>
                                    <li className={`${styles.stepItem} ${statusInfo.step >= 3 ? (statusInfo.step === 3 ? styles.stepItemActive : styles.stepItemCompleted) : ''}`}>
                                        <span className={styles.stepDot}>3</span>
                                        <span className={styles.stepLabel}>Dipacking</span>
                                    </li>
                                    <li className={`${styles.stepItem} ${statusInfo.step >= 4 ? (statusInfo.step === 4 ? styles.stepItemActive : styles.stepItemCompleted) : ''}`}>
                                        <span className={styles.stepDot}>4</span>
                                        <span className={styles.stepLabel}>Dikirim</span>
                                    </li>
                                    <li className={`${styles.stepItem} ${statusInfo.step >= 5 ? styles.stepItemCompleted : ''}`}>
                                        <span className={styles.stepDot}>5</span>
                                        <span className={styles.stepLabel}>Sampai</span>
                                    </li>
                                </ol>
                            </div>
                        )}

                        {/* Shipping & Resi Box */}
                        <div className={styles.shippingBox}>
                            <div className={styles.shippingBoxHeader}>
                                <div className={styles.courierMeta}>
                                    <span className={styles.courierBadge}>
                                        {orderData.shippingCourier || 'KURIR'}
                                    </span>
                                    <span className={styles.courierService}>
                                        {orderData.shippingService || 'Layanan Standar'}
                                    </span>
                                </div>

                                {orderData.trackingNumber ? (
                                    <div className={styles.waybillRow}>
                                        <span className={styles.waybillCode}>{orderData.trackingNumber}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyWaybill(orderData.trackingNumber)}
                                            className={styles.copyBtn}
                                            title="Salin Nomor Resi"
                                            aria-label="Salin Nomor Resi"
                                        >
                                            <svg className={styles.copyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.orderDate}>
                                        Resi sedang disiapkan farm
                                    </div>
                                )}
                            </div>

                            {/* Live Timeline Checkpoints (jika ada data dari Biteship) */}
                            {loadingTracking && (
                                <div className={styles.orderDate}>
                                    Memuat riwayat live tracking kurir...
                                </div>
                            )}

                            {liveTracking && Array.isArray(liveTracking.history) && liveTracking.history.length > 0 && (
                                <div className={styles.timelineSection}>
                                    <h4 className={styles.timelineTitle}>Riwayat Perjalanan Paket (Live)</h4>
                                    <div className={styles.timelineList}>
                                        {liveTracking.history.map((hist, idx) => (
                                            <div key={idx} className={styles.timelineItem}>
                                                <div className={styles.timelineDot} />
                                                <p className={styles.timelineDesc}>{hist.note || hist.status}</p>
                                                <div className={styles.timelineTime}>
                                                    {formatDate(hist.updated_at || hist.created_at)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items Section */}
                        <div className={styles.itemsSection}>
                            <h4 className={styles.sectionHeading}>Ikan &amp; Produk Pilihan</h4>
                            <div className={styles.itemsList}>
                                {orderData.items.map((item) => (
                                    <div key={item.id} className={styles.itemRow}>
                                        <div className={styles.itemInfo}>
                                            <Image
                                                src={item.image}
                                                alt={item.name}
                                                width={48}
                                                height={48}
                                                className={styles.itemImage}
                                            />
                                            <div className={styles.itemDetails}>
                                                <p className={styles.itemName}>{item.name}</p>
                                                <p className={styles.itemVariant}>
                                                    {item.selectedSize ? `Varian: ${item.selectedSize} · ` : ''}
                                                    Jumlah: {item.quantity} ekor/unit
                                                </p>
                                            </div>
                                        </div>
                                        <span className={styles.itemPrice}>
                                            {formatIDR(item.price * item.quantity)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Financial Breakdown */}
                            <div className={styles.breakdownSection}>
                                <div className={styles.calcRow}>
                                    <span>Subtotal Produk</span>
                                    <span>{formatIDR(orderData.subtotal)}</span>
                                </div>
                                <div className={styles.calcRow}>
                                    <span>Ongkos Kirim ({orderData.shippingCourier || 'Kurir'})</span>
                                    <span>{formatIDR(orderData.shippingFee)}</span>
                                </div>
                                {orderData.paymentFee > 0 && (
                                    <div className={styles.calcRow}>
                                        <span>Biaya Admin ({orderData.paymentMethod || 'Pembayaran'})</span>
                                        <span>{formatIDR(orderData.paymentFee)}</span>
                                    </div>
                                )}
                                <div className={styles.calcTotalRow}>
                                    <span>Total Tagihan</span>
                                    <span className={styles.calcTotalValue}>{formatIDR(orderData.total)}</span>
                                </div>
                            </div>

                            {/* Destination Address Card */}
                            <div className={styles.addressBox}>
                                <div className={styles.addressHeader}>Alamat Pengiriman</div>
                                <div className={styles.addressRecipient}>
                                    {orderData.recipientName} ({orderData.maskedPhone})
                                </div>
                                <p className={styles.addressText}>
                                    {orderData.streetAddress}, {orderData.city}, {orderData.province} {orderData.postalCode}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Help & Support Card */}
                    <div className={styles.helpCard}>
                        <div className={styles.helpTextCol}>
                            <h4 className={styles.helpTitle}>Butuh Bantuan dengan Pesanan Anda?</h4>
                            <p className={styles.helpSubtitle}>
                                Tim SUMDE BETTA siap membantu konfirmasi pengiriman, update karantina ikan, atau pertanyaan resi melalui WhatsApp.
                            </p>
                        </div>
                        <a
                            href={waLink({ text: `Halo SUMDE BETTA, saya ingin menanyakan pesanan #${orderData.shortId}` })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.waBtn}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.053-1.637-.282-1.32-.44-2.164-1.748-2.23-1.836-.065-.088-.535-.71-.535-1.355 0-.645.337-.962.457-1.092.12-.13.262-.163.349-.163.088 0 .175.001.25.005.08.004.187-.03.292.224.11.265.372.909.405.975.033.066.054.143.011.23-.044.088-.066.143-.131.22-.066.077-.138.172-.197.231-.066.066-.134.137-.058.269.077.132.341.562.732.909.504.448.929.587 1.061.652.132.066.208.055.285-.033.077-.088.329-.384.417-.516.088-.131.175-.11.296-.065.121.044.767.362.899.428.132.066.22.099.252.154.033.055.033.318-.111.723z"/>
                            </svg>
                            <span>Hubungi CS WhatsApp</span>
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TrackOrderPage() {
    return (
        <Suspense fallback={
            <div className={`container ${styles.pageContainer}`}>
                <div className={styles.headerSection}>
                    <h1 className={styles.title}>Lacak Status Pesanan</h1>
                    <p className={styles.subtitle}>Memuat formulir pelacakan...</p>
                </div>
            </div>
        }>
            <TrackOrderContent />
        </Suspense>
    );
}

