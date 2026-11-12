'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import { useChat } from '@/context/ChatContext';
import ShipmentTracker from './ShipmentTracker';
import styles from './orders.module.css';

const STATUS_CONFIG = {
    PENDING:    { label: 'Belum Dibayar',  className: styles.statusPending },
    PAID:       { label: 'Lunas',          className: styles.statusPaid },
    PROCESSING: { label: 'Sedang Diproses',className: styles.statusProcessing },
    SHIPPED:    { label: 'Dikirim',        className: styles.statusShipped },
    COMPLETED:  { label: 'Selesai',        className: styles.statusCompleted },
    CANCELLED:  { label: 'Dibatalkan',     className: styles.statusCancelled },
};

const TABS = [
    { key: 'ALL',       label: 'Semua' },
    { key: 'PENDING',   label: 'Belum Dibayar' },
    { key: 'PAID',      label: 'Lunas' },
    { key: 'PROCESSING',label: 'Diproses' },
    { key: 'SHIPPED',   label: 'Dikirim' },
    { key: 'COMPLETED', label: 'Selesai' },
];

const EMPTY_STATES = {
    ALL:        { title: 'Belum ada pesanan',                desc: 'Mulai belanja koleksi ikan betta eksklusif kami.', showCta: true },
    PENDING:    { title: 'Tidak ada tagihan menunggu bayar', desc: 'Semua pesanan sudah dibayar, atau kamu belum membuat pesanan baru.', showCta: false },
    PAID:       { title: 'Belum ada pesanan lunas',          desc: 'Pesanan yang sudah dibayar dan menunggu diproses admin akan muncul di sini.', showCta: false },
    PROCESSING: { title: 'Belum ada pesanan diproses',       desc: 'Pesanan yang resi kurirnya sudah dipanggil akan muncul di sini.', showCta: false },
    SHIPPED:    { title: 'Belum ada pesanan dikirim',        desc: 'Pesanan yang sedang dalam perjalanan kurir akan muncul di sini.', showCta: false },
    COMPLETED:  { title: 'Belum ada pesanan selesai',        desc: 'Pesanan yang sudah berhasil diantar dan diterima akan muncul di sini.', showCta: false },
};

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

function getOrderItemImage(item) {
    if (item?.customImage) return item.customImage;
    if (item?.variant?.images) {
        try {
            const vImgs = typeof item.variant.images === 'string' ? JSON.parse(item.variant.images) : item.variant.images;
            if (Array.isArray(vImgs) && vImgs.length > 0 && vImgs[0]) return vImgs[0];
        } catch {}
    }
    if (item?.product?.image) return item.product.image;
    if (item?.product?.images) {
        try {
            const pImgs = typeof item.product.images === 'string' ? JSON.parse(item.product.images) : item.product.images;
            if (Array.isArray(pImgs) && pImgs.length > 0 && pImgs[0]) return pImgs[0];
        } catch {}
    }
    return '/img/betta-1.png';
}

function OrderItemImage({ src, alt }) {
    const [isError, setIsError] = useState(false);

    return (
        <div className={styles.itemImageWrapper}>
            <Image
                src={isError || !src ? '/img/betta-1.png' : src}
                alt={alt || 'Foto produk'}
                fill
                sizes="56px"
                className={styles.itemImage}
                onError={() => setIsError(true)}
            />
        </div>
    );
}

function formatOrderDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function OrdersPage() {
    const { currentUser, isLoading: authLoading, fetchMyOrders } = useAuth();
    const { toast, confirmDialog } = useToast();
    const { openChat } = useChat();
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL');
    const [payingOrderId, setPayingOrderId] = useState(null);
    const [cancellingOrderId, setCancellingOrderId] = useState(null);
    const [trackingData, setTrackingData] = useState({});
    const [trackingLoading, setTrackingLoading] = useState({});

    const handleHelpOrder = useCallback((order) => {
        const firstItem = order.items?.[0];
        const firstImage = getOrderItemImage(firstItem);
        const itemName = firstItem?.customName || firstItem?.product?.name || 'Pesanan Ikan/Produk';
        const otherItemsCount = (order.items?.length || 1) - 1;

        openChat({
            attachedType: 'ORDER',
            attachedId: order.id,
            orderStatus: order.status,
            autoSend: true,
            sendNonce: Date.now(),
            attachedMeta: {
                orderId: order.id,
                status: order.status,
                total: order.total,
                image: firstImage,
                itemName: itemName + (otherItemsCount > 0 ? ` (+${otherItemsCount} produk lainnya)` : ''),
                itemCount: order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1,
                courier: order.shippingCourier,
                trackingNumber: order.trackingNumber,
                createdAt: order.createdAt,
            },
        });
    }, [openChat]);

    const handleTrack = async (order) => {
        if (!order.trackingNumber || !order.shippingCourier) return;
        
        if (trackingData[order.id]) {
            setTrackingData(prev => ({ ...prev, [order.id]: null }));
            return;
        }

        setTrackingLoading(prev => ({ ...prev, [order.id]: true }));
        try {
            const res = await fetch(`/api/shipping/track?waybill=${order.trackingNumber}&courier=${order.shippingCourier}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setTrackingData(prev => ({ ...prev, [order.id]: data }));
            fetchMyOrders().then(setOrders);
        } catch (err) {
            toast.error(err.message || 'Gagal melacak pesanan.');
        } finally {
            setTrackingLoading(prev => ({ ...prev, [order.id]: false }));
        }
    };

    const handleCancelOrder = async (orderId) => {
        const confirmed = await confirmDialog({
            title: 'Batalkan Pesanan?',
            message: 'Batalkan pesanan ini? Tindakan ini tidak dapat diurungkan.',
            confirmText: 'Ya, Batalkan',
            cancelText: 'Kembali',
            isDanger: true,
        });
        if (!confirmed) return;

        setCancellingOrderId(orderId);
        try {
            const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal membatalkan pesanan.');
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: data.order.status } : o));
            toast.success('Pesanan berhasil dibatalkan.');
        } catch (err) {
            toast.error(err.message || 'Gagal membatalkan pesanan.');
        } finally {
            setCancellingOrderId(null);
        }
    };

    const handlePayNow = async (orderId) => {
        setPayingOrderId(orderId);
        try {
            const callbackUrl = window.location.origin + '/customer/orders';
            const res = await fetch('/api/payment/doku', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, callbackUrl })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            window.location.assign(data.paymentUrl);
        } catch (err) {
            console.error('Payment error:', err);
            toast.error(err.message || 'Gagal memulai pembayaran.');
            setPayingOrderId(null);
        }
    };

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [authLoading, currentUser, router]);

    useEffect(() => {
        if (!currentUser) return;
        fetchMyOrders().then(data => { setOrders(data); setLoading(false); });
        const timer = setInterval(() => {
            fetchMyOrders().then(setOrders);
        }, 20000);
        return () => clearInterval(timer);
    }, [currentUser, fetchMyOrders]);

    const filtered = activeTab === 'ALL' ? orders : orders.filter(o => o.status === activeTab);

    if (authLoading && !currentUser) {
        return <div className={`skeleton-box ${styles.skeletonPanel}`} aria-busy="true" aria-label="Memuat pesanan" />;
    }
    if (!currentUser) return null;

    return (
        <div>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Pesanan Saya</h1>
                <p className={styles.pageSubtitle}>Pantau status pembayaran dan pengiriman pesanan Anda.</p>
            </div>

            {/* Status Tabs */}
            <div className={styles.tabsWrapper}>
                {TABS.map(tab => {
                    const count = tab.key === 'ALL' ? orders.length : orders.filter(o => o.status === tab.key).length;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                        >
                            <span>{tab.label}</span>
                            {count > 0 && <span className={styles.tabBadge}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Orders List / Empty State */}
            {loading ? (
                <div className={`skeleton-box ${styles.skeletonPanel}`} aria-busy="true" aria-label="Memuat daftar pesanan" />
            ) : filtered.length === 0 ? (
                (() => {
                    const empty = EMPTY_STATES[activeTab] || EMPTY_STATES.ALL;
                    return (
                        <div className={styles.emptyCard}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className={styles.emptyIcon}
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338A2.25 2.25 0 0017.088 3.75H6.912a2.25 2.25 0 00-2.152 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                            </svg>
                            <h3 className={styles.emptyTitle}>{empty.title}</h3>
                            <p className={styles.emptyDesc}>{empty.desc}</p>
                            {empty.showCta && (
                                <Link href="/produk" className={styles.emptyCta}>Jelajahi Produk</Link>
                            )}
                        </div>
                    );
                })()
            ) : (
                <div className={styles.ordersList}>
                    {filtered.map(order => {
                        const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                        return (
                            <div key={order.id} className={styles.orderCard}>
                                {/* Order Card Header */}
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardHeaderLeft}>
                                        <div className={styles.orderIcon} aria-hidden="true">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                                <line x1="3" y1="6" x2="21" y2="6" />
                                                <path d="M16 10a4 4 0 0 1-8 0" />
                                            </svg>
                                        </div>
                                        <span className={styles.orderNumber}>
                                            Pesanan #{order.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <span className={styles.headerDivider}>·</span>
                                        <span className={styles.orderDate}>
                                            {formatOrderDate(order.createdAt)}
                                        </span>
                                    </div>
                                    <span className={`${styles.statusBadge} ${cfg.className || styles.statusPending}`}>
                                        {cfg.label}
                                    </span>
                                </div>

                                {/* Order Items with Thumbnails */}
                                <div className={styles.cardItemsList}>
                                    {order.items.map(item => {
                                        const itemImg = getOrderItemImage(item);
                                        const itemName = item.customName || item.product?.name || 'Produk';
                                        return (
                                            <div key={item.id} className={styles.cardItemRow}>
                                                <div className={styles.cardItemMain}>
                                                    <OrderItemImage src={itemImg} alt={itemName} />
                                                    <div className={styles.itemMeta}>
                                                        {item.productId ? (
                                                            <Link href={`/produk/${item.productId}`} className={styles.itemTitle} title={`Lihat detail ${itemName}`}>
                                                                {itemName}
                                                            </Link>
                                                        ) : (
                                                            <span className={styles.itemTitle}>
                                                                {itemName}
                                                            </span>
                                                        )}
                                                        <div className={styles.itemSubtext}>
                                                            {item.selectedSize && (
                                                                <span className={styles.sizeBadge}>Ukuran: {item.selectedSize}</span>
                                                            )}
                                                            <span>× {item.quantity}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={styles.itemPrice}>
                                                    {fmt(item.price * item.quantity)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Order Summary (Shipping & Total) */}
                                <div className={styles.cardSummaryRow}>
                                    <div className={styles.shippingInfoCol}>
                                        <div className={styles.shippingCourier}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" />
                                                <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" />
                                                <circle cx="7" cy="18" r="2" />
                                                <circle cx="17" cy="18" r="2" />
                                            </svg>
                                            <span>{order.shippingCourier || 'Kurir Reguler'} {order.shippingService ? `(${order.shippingService})` : ''}</span>
                                            {order.trackingNumber && (
                                                <span className={styles.waybillBadge}>Resi: {order.trackingNumber}</span>
                                            )}
                                        </div>
                                        <div className={styles.shippingAddress} title={`${order.name} · ${order.streetAddress}, ${order.city}`}>
                                            Penerima: {order.name} · {order.city || order.province}
                                        </div>
                                    </div>
                                    <div className={styles.totalCol}>
                                        <span className={styles.totalLabel}>Total Pesanan</span>
                                        <span className={styles.totalAmount}>{fmt(order.total)}</span>
                                    </div>
                                </div>

                                {/* Proportional Actions Bar */}
                                <div className={styles.actionsBar}>
                                    {/* Left Utility Actions: Invoice & Bantuan */}
                                    <div className={styles.actionsGroupLeft}>
                                        <Link
                                            href={`/invoice/${order.id}`}
                                            className={`${styles.btnAction} ${styles.btnSecondary}`}
                                            title="Lihat dan cetak invoice pembayaran"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                            </svg>
                                            <span>Invoice</span>
                                        </Link>
                                        <button
                                            type="button"
                                            className={`${styles.btnAction} ${styles.btnSecondary}`}
                                            onClick={() => handleHelpOrder(order)}
                                            title="Tanya Admin seputar pesanan ini"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                            </svg>
                                            <span>Bantuan</span>
                                        </button>
                                    </div>

                                    {/* Right Transactional Actions */}
                                    <div className={styles.actionsGroupRight}>
                                        {order.status === 'PENDING' && (
                                            <>
                                                <button
                                                    type="button"
                                                    className={`${styles.btnAction} ${styles.btnCancel}`}
                                                    onClick={() => handleCancelOrder(order.id)}
                                                    disabled={payingOrderId === order.id || cancellingOrderId === order.id}
                                                    title="Batalkan pesanan ini"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <line x1="15" y1="9" x2="9" y2="15" />
                                                        <line x1="9" y1="9" x2="15" y2="15" />
                                                    </svg>
                                                    <span>{cancellingOrderId === order.id ? 'Membatalkan...' : 'Batalkan'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${styles.btnAction} ${styles.btnPay}`}
                                                    onClick={() => handlePayNow(order.id)}
                                                    disabled={payingOrderId === order.id || cancellingOrderId === order.id}
                                                    title="Lanjutkan pembayaran melalui DOKU"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <rect x="2" y="5" width="20" height="14" rx="2" />
                                                        <line x1="2" y1="10" x2="22" y2="10" />
                                                    </svg>
                                                    <span>{payingOrderId === order.id ? 'Memproses...' : 'Bayar Sekarang'}</span>
                                                </button>
                                            </>
                                        )}

                                        {order.trackingNumber && (
                                            <button 
                                                type="button"
                                                className={`${styles.btnAction} ${styles.btnTrack} ${trackingData[order.id] ? styles.btnTrackActive : ''}`} 
                                                onClick={() => handleTrack(order)}
                                                disabled={trackingLoading[order.id]}
                                                title="Lacak posisi pengiriman paket kurir"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <rect x="1" y="3" width="15" height="13" />
                                                    <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                                                    <circle cx="5.5" cy="18.5" r="2.5" />
                                                    <circle cx="18.5" cy="18.5" r="2.5" />
                                                </svg>
                                                <span>{trackingLoading[order.id] ? 'Melacak...' : trackingData[order.id] ? 'Tutup Pelacakan' : 'Lacak Pesanan'}</span>
                                            </button>
                                        )}

                                        {order.status === 'COMPLETED' && (
                                            <Link
                                                href="/produk"
                                                className={`${styles.btnAction} ${styles.btnReorder}`}
                                                title="Beli produk lainnya"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                                                    <line x1="3" y1="6" x2="21" y2="6" />
                                                    <path d="M16 10a4 4 0 0 1-8 0" />
                                                </svg>
                                                <span>Beli Lagi</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Shipment Tracking History Accordion */}
                                {trackingData[order.id] && (
                                    <div className={styles.trackerWrapper}>
                                        <ShipmentTracker
                                            history={trackingData[order.id].history || []}
                                            waybill={order.trackingNumber}
                                            courier={order.shippingCourier}
                                            link={trackingData[order.id]?.link}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
