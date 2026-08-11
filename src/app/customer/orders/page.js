'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STATUS_CONFIG = {
    PENDING:    { label: 'Belum Dibayar', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: '#F59E0B' },
    PROCESSING: { label: 'Dalam Proses',  color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: '#3B82F6' },
    SHIPPED:    { label: 'Dikirim',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  border: '#8B5CF6' },
    COMPLETED:  { label: 'Selesai',       color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: '#10B981' },
    CANCELLED:  { label: 'Dibatalkan',    color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: '#EF4444' },
};

const TABS = [
    { key: 'ALL',       label: 'Semua' },
    { key: 'PENDING',   label: 'Belum Dibayar' },
    { key: 'PROCESSING',label: 'Dalam Proses' },
    { key: 'SHIPPED',   label: 'Dikirim' },
    { key: 'COMPLETED', label: 'Selesai' },
];

// Empty-state copy tailored per tab so the message actually reflects the
// active filter — not the same "belum ada pesanan" for every status.
const EMPTY_STATES = {
    ALL:        { title: 'Belum ada pesanan',                desc: 'Mulai belanja koleksi ikan betta eksklusif kami.', showCta: true  },
    PENDING:    { title: 'Tidak ada tagihan menunggu bayar', desc: 'Semua pesanan sudah dibayar, atau kamu belum membuat pesanan baru.', showCta: false },
    PROCESSING: { title: 'Belum ada pesanan diproses',       desc: 'Pesanan yang sudah dibayar akan muncul di sini.', showCta: false },
    SHIPPED:    { title: 'Belum ada pesanan dikirim',        desc: 'Pesanan yang sedang dalam perjalanan akan muncul di sini.', showCta: false },
    COMPLETED:  { title: 'Belum ada pesanan selesai',        desc: 'Pesanan yang sudah diterima akan muncul di sini.', showCta: false },
};

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

export default function OrdersPage() {
    const { currentUser, isLoading: authLoading, fetchMyOrders } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL');
    const [payingOrderId, setPayingOrderId] = useState(null);
    const [trackingData, setTrackingData] = useState({});
    const [trackingLoading, setTrackingLoading] = useState({});

    const handleTrack = async (order) => {
        if (!order.trackingNumber || !order.shippingCourier) return;
        
        if (trackingData[order.id]) {
            setTrackingData(prev => ({...prev, [order.id]: null}));
            return;
        }

        setTrackingLoading(prev => ({...prev, [order.id]: true}));
        try {
            const res = await fetch(`/api/shipping/track?waybill=${order.trackingNumber}&courier=${order.shippingCourier}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setTrackingData(prev => ({...prev, [order.id]: data}));
        } catch (err) {
            alert(err.message || 'Gagal melacak pesanan');
        } finally {
            setTrackingLoading(prev => ({...prev, [order.id]: false}));
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
            window.location.href = data.paymentUrl;
        } catch (err) {
            console.error('Payment error:', err);
            alert(err.message || 'Gagal memulai pembayaran.');
            setPayingOrderId(null);
        }
    };

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [authLoading, currentUser, router]);

    useEffect(() => {
        if (!currentUser) return;
        fetchMyOrders().then(data => { setOrders(data); setLoading(false); });
    }, [currentUser]);

    const filtered = activeTab === 'ALL' ? orders : orders.filter(o => o.status === activeTab);

    if (authLoading || !currentUser) {
        return <div className="pageContainer pt-[120px] text-center"><h2 className="text-[var(--text-muted)]">Memverifikasi akun...</h2></div>;
    }

    return (
        <div className="pageContainer orders-page-container">
            <div className="container orders-wrapper">

                {/* Header */}
                <div className="orders-header">
                    <span className="text-[var(--primary)] tracking-[0.2rem] text-[0.75rem] font-bold uppercase">Customer Area</span>
                    <h1 className="font-[var(--font-serif)] text-[2.5rem] italic mt-[0.4rem] text-[var(--text-main)]">Pesanan Saya</h1>
                </div>

                {/* Status Tabs */}
                <div className="orders-tabs-wrapper">
                    {TABS.map(tab => {
                        const count = tab.key === 'ALL' ? orders.length : orders.filter(o => o.status === tab.key).length;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`orders-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                            >
                                {tab.label} {count > 0 && <span className="opacity-75">({count})</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Orders List */}
                {loading ? (
                    <p className="text-[var(--text-muted)]">Memuat pesanan...</p>
                ) : filtered.length === 0 ? (
                    (() => {
                        const empty = EMPTY_STATES[activeTab] || EMPTY_STATES.ALL;
                        return (
                            <div className="orders-empty-card">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.6}
                                    stroke="currentColor"
                                    width="52"
                                    height="52"
                                    className="empty-icon"
                                    aria-hidden="true"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338A2.25 2.25 0 0017.088 3.75H6.912a2.25 2.25 0 00-2.152 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                                </svg>
                                <h4>{empty.title}</h4>
                                <p>{empty.desc}</p>
                                {empty.showCta && (
                                    <Link href="/produk" className="btn btn-primary cursor-pointer">Jelajahi Produk</Link>
                                )}
                            </div>
                        );
                    })()
                ) : (
                    <div className="orders-list-container">
                        {filtered.map(order => {
                            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                            return (
                                <div key={order.id} className="order-card">
                                    {/* Order Header */}
                                    <div className="order-card-header">
                                        <div>
                                            <h4 className="order-card-title">
                                                Pesanan <span className="text-[var(--primary)]">#{order.id.slice(0, 8).toUpperCase()}</span>
                                            </h4>
                                            <span className="order-card-date">
                                                {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span 
                                            className="order-status-badge"
                                            style={{ border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color }}
                                        >
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {/* Order Items */}
                                    <div className="order-card-items">
                                        {order.items.map(item => (
                                            <div key={item.id} className="order-item-row">
                                                <span>{item.product?.name || 'Produk dihapus'} <span className="text-[var(--text-muted)]">× {item.quantity}</span></span>
                                                <span className="font-semibold">{fmt(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                        <div className="order-total-row">
                                            <span>Total</span>
                                            <span className="text-[var(--primary)] text-[1.1rem]">{fmt(order.total)}</span>
                                        </div>
                                    </div>

                                    {/* Shipping Info */}
                                    <div className="order-shipping-info">
                                        <span className="text-[var(--text-main)] font-semibold">{order.name}</span>
                                        {' · '}{order.streetAddress}, {order.rtRw}, Kel. {order.village}, Kec. {order.district}, {order.city}, {order.province} {order.postalCode}
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="order-actions-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                        {order.status === 'PENDING' && (
                                            <button 
                                                className="btn btn-primary text-[0.9rem] px-6 py-2" 
                                                onClick={() => handlePayNow(order.id)}
                                                disabled={payingOrderId === order.id}
                                            >
                                                {payingOrderId === order.id ? 'Memproses...' : 'Bayar Sekarang'}
                                            </button>
                                        )}
                                        {order.trackingNumber && (
                                            <button 
                                                className="btn btn-outline text-[0.9rem] px-6 py-2" 
                                                onClick={() => handleTrack(order)}
                                                disabled={trackingLoading[order.id]}
                                            >
                                                {trackingLoading[order.id] ? 'Melacak...' : trackingData[order.id] ? 'Tutup Pelacakan' : 'Lacak Pesanan'}
                                            </button>
                                        )}
                                    </div>

                                    {trackingData[order.id] && (
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <h5 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
                                                Resi: {order.trackingNumber} 
                                                <span className="text-[var(--primary)] ml-2 text-sm uppercase">({order.shippingCourier})</span>
                                            </h5>
                                            {trackingData[order.id].history && trackingData[order.id].history.map((h, idx) => (
                                                <div key={idx} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                                    <div style={{ color: 'var(--text-muted)' }}>{new Date(h.updated_at).toLocaleString('id-ID')}</div>
                                                    <div>{h.note}</div>
                                                </div>
                                            ))}
                                            {(!trackingData[order.id].history || trackingData[order.id].history.length === 0) && (
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Belum ada riwayat pelacakan.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
