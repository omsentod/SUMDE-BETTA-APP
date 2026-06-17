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

const fmt = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

export default function OrdersPage() {
    const { currentUser, isLoading: authLoading, fetchMyOrders } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL');

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [authLoading, currentUser, router]);

    useEffect(() => {
        if (!currentUser) return;
        fetchMyOrders().then(data => { setOrders(data); setLoading(false); });
    }, [currentUser]);

    const filtered = activeTab === 'ALL' ? orders : orders.filter(o => o.status === activeTab);

    if (authLoading || !currentUser) {
        return <div className="pageContainer" style={{ paddingTop: '120px', textAlign: 'center' }}><h2 style={{ color: 'var(--text-muted)' }}>Memverifikasi akun...</h2></div>;
    }

    return (
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '900px', paddingBottom: '5rem' }}>

                {/* Header */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Customer Area</span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontStyle: 'italic', marginTop: '0.4rem', color: 'var(--text-main)' }}>Pesanan Saya</h1>
                </div>

                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    {TABS.map(tab => {
                        const count = tab.key === 'ALL' ? orders.length : orders.filter(o => o.status === tab.key).length;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    borderRadius: '20px',
                                    border: activeTab === tab.key ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                                    color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {tab.label} {count > 0 && <span style={{ opacity: 0.75 }}>({count})</span>}
                            </button>
                        );
                    })}
                </div>

                {/* Orders List */}
                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Memuat pesanan...</p>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 0', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '3rem' }}>🐟</span>
                        <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-main)' }}>Belum ada pesanan</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Mulai belanja koleksi ikan betta eksklusif kami.</p>
                        <Link href="/produk" className="btn btn-primary" style={{ cursor: 'pointer' }}>Jelajahi Produk</Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {filtered.map(order => {
                            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                            return (
                                <div key={order.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                                    {/* Order Header */}
                                    <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        <div>
                                            <h4 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-main)', fontWeight: '600' }}>
                                                Pesanan <span style={{ color: 'var(--primary)' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                                            </h4>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.9rem', borderRadius: '20px', border: `1px solid ${cfg.border}`, background: cfg.bg, color: cfg.color, fontWeight: '700', whiteSpace: 'nowrap' }}>
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {/* Order Items */}
                                    <div style={{ padding: '1.25rem 1.5rem' }}>
                                        {order.items.map(item => (
                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                <span>{item.product?.name || 'Produk dihapus'} <span style={{ color: 'var(--text-muted)' }}>× {item.quantity}</span></span>
                                                <span style={{ fontWeight: '600' }}>{fmt(item.price * item.quantity)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', fontWeight: '700', color: 'var(--text-main)' }}>
                                            <span>Total</span>
                                            <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{fmt(order.total)}</span>
                                        </div>
                                    </div>

                                    {/* Shipping Info */}
                                    <div style={{ padding: '0.75rem 1.5rem 1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{order.name}</span>
                                        {' · '}{order.streetAddress}, {order.rtRw}, Kel. {order.village}, Kec. {order.district}, {order.city}, {order.province} {order.postalCode}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
