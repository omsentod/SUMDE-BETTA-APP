'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import styles from './adminDashboard.module.css';

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const formatOrderId = (id) => (id ? `#${String(id).slice(-6).toUpperCase()}` : '');

const statusBadge = (status) => {
  switch (status) {
    case 'PENDING':
      return { label: 'Menunggu', cls: styles.badgeWarning };
    case 'PROCESSING':
      return { label: 'Diproses', cls: styles.badgeInfo };
    case 'SHIPPED':
      return { label: 'Dikirim', cls: styles.badgeInfo };
    case 'COMPLETED':
      return { label: 'Selesai', cls: styles.badgeSuccess };
    case 'CANCELLED':
      return { label: 'Batal', cls: styles.badgeDanger };
    case 'RETURNED':
      return { label: 'Retur', cls: styles.badgeDanger };
    default:
      return { label: status || '-', cls: styles.badgeMuted };
  }
};

export default function AdminDashboard() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { products, isLoading: productsLoading } = useProducts();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    let cancelled = false;
    (async () => {
      try {
        const [uRes, oRes] = await Promise.all([fetch('/api/users'), fetch('/api/orders')]);
        if (cancelled) return;
        if (uRes.ok) setUsers(await uRes.json());
        if (oRes.ok) setOrders(await oRes.json());
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  const kpi = useMemo(() => {
    const totalRevenue = orders
      .filter((o) => o.status === 'PROCESSING' || o.status === 'SHIPPED' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
    const lowStockCount = products.filter((p) => p.quantity <= 2).length;
    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrdersCount,
      totalProducts: products.length,
      lowStockCount,
      totalUsers: users.length,
    };
  }, [orders, products, users]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.quantity <= 2).slice(0, 6),
    [products]
  );

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas Admin...</h2>
      </div>
    );
  }

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Otoritas Tertinggi</span>
            <h1 className={styles.headerTitle}>Admin Dashboard</h1>
          </div>
        </div>

        {/* KPI Metrics Cards Grid */}
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Total Omset</span>
              <div className={styles.kpiIconWrapper}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(kpi.totalRevenue)}</div>
            <div className={styles.kpiSubtext}>Dari transaksi berstatus diproses/selesai</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Total Pesanan</span>
              <div className={styles.kpiIconWrapper}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
              </div>
            </div>
            <div className={styles.kpiValue}>{kpi.totalOrders}</div>
            <div className={styles.kpiSubtext}>
              {kpi.pendingOrdersCount > 0 ? (
                <span style={{ color: '#F59E0B', fontWeight: '600' }}>
                  ⚠️ {kpi.pendingOrdersCount} Pesanan PENDING
                </span>
              ) : (
                <span>Semua transaksi diproses</span>
              )}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Katalog Produk</span>
              <div className={styles.kpiIconWrapper}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
            </div>
            <div className={styles.kpiValue}>{kpi.totalProducts}</div>
            <div className={styles.kpiSubtext}>
              {kpi.lowStockCount > 0 ? (
                <span style={{ color: '#EF4444', fontWeight: '600' }}>
                  {kpi.lowStockCount} Produk Stok Menipis/Habis
                </span>
              ) : (
                <span>Stok aman tersedia</span>
              )}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiTitle}>Total Pengguna</span>
              <div className={styles.kpiIconWrapper}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
            </div>
            <div className={styles.kpiValue}>{kpi.totalUsers}</div>
            <div className={styles.kpiSubtext}>Pelanggan & Admin terdaftar</div>
          </div>
        </div>

        {/* Recent Orders */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Pesanan Terbaru
            </h2>
            <Link href="/admin/orders" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
              Lihat Semua →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Belum ada pesanan.
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Pelanggan</th>
                    <th className={styles.hideOnMobile}>Item</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th className={styles.hideOnMobile} style={{ textAlign: 'right' }}>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const badge = statusBadge(o.status);
                    const itemCount = (o.items || []).reduce((n, it) => n + (it.quantity || 1), 0);
                    return (
                      <tr key={o.id} className={styles.tableRow}>
                        <td style={{ fontWeight: 600 }}>
                          <Link href={`/admin/orders?highlight=${o.id}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                            {formatOrderId(o.id)}
                          </Link>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.user?.name || 'Guest'}</div>
                          <div className={styles.hideOnMobile} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.user?.email || '-'}</div>
                        </td>
                        <td className={styles.hideOnMobile} style={{ color: 'var(--text-muted)' }}>{itemCount} item</td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(o.total)}</td>
                        <td>
                          <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className={styles.hideOnMobile} style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {o.createdAt ? new Date(o.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Stok Menipis / Habis
            </h2>
            <Link href="/admin/products" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
              Kelola Produk →
            </Link>
          </div>

          {productsLoading ? (
            <p style={{ color: 'var(--text-muted)' }}>Memuat produk...</p>
          ) : lowStockProducts.length === 0 ? (
            <div className={styles.tableCard} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Semua stok aman ✓
            </div>
          ) : (
            <div className={styles.tableCard}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.hideOnMobile}>Gambar</th>
                    <th>Nama Produk</th>
                    <th className={styles.hideOnMobile}>Kategori</th>
                    <th>Stok</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((p) => (
                    <tr key={p.id} className={styles.tableRow}>
                      <td className={styles.hideOnMobile}>
                        <div className={styles.productThumb}>
                          <Image src={p.image} alt={p.name} fill style={{ objectFit: 'cover' }} />
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className={styles.hideOnMobile} style={{ color: 'var(--text-muted)' }}>{p.form} ({p.gender})</td>
                      <td>
                        {p.quantity > 0 ? (
                          <span className={`${styles.badge} ${styles.badgeWarning}`}>Stok: {p.quantity}</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeDanger}`}>Habis</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href="/admin/products"
                          className="btn btn-outline"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', borderRadius: '8px', textDecoration: 'none' }}
                        >
                          Restok
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
