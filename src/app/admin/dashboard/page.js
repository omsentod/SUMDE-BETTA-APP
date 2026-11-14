'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { canUser, getFirstAccessibleAdminRoute } from '@/lib/permission-utils';
import OrderSourceBadge from '@/components/admin/OrderSourceBadge';
import styles from './adminDashboard.module.css';

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const formatOrderId = (id) => (id ? `#${String(id).slice(-6).toUpperCase()}` : '');

const statusBadge = (status, order = null) => {
  if (status === 'PROCESSING' && order?.packingStatus === 'READY_FOR_PICKUP') {
    return { label: 'Menunggu Kurir', cls: styles.badgeInfo };
  }
  switch (status) {
    case 'PENDING':
      return { label: 'Menunggu', cls: styles.badgeWarning };
    case 'PAID':
      return { label: 'Lunas', cls: styles.badgeInfo };
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

  const can = useCallback((perm) => canUser(currentUser, perm), [currentUser]);

  const canViewDashboard = can('dashboard:view');
  const canKpiRevenue = can('dashboard:kpi_revenue');
  const canKpiOrders = can('dashboard:kpi_orders');
  const canKpiProducts = can('dashboard:kpi_products');
  const canKpiUsers = can('dashboard:kpi_users');
  const canViewOrders = can('orders:view');
  const canViewProducts = can('products:view');
  const needUsers = canKpiUsers || can('users:view');
  const needOrders = canKpiOrders || canKpiRevenue || canViewOrders;

  // Proteksi hak akses menu dashboard
  useEffect(() => {
    if (!authLoading && currentUser) {
      if (!canViewDashboard) {
        // Alihkan ke menu pertama yang diizinkan untuk staf ini secara dinamis
        const dest = getFirstAccessibleAdminRoute(can);
        if (dest && dest !== '/admin/dashboard') {
          router.push(dest);
        } else {
          router.push('/customer/dashboard');
        }
      }
    } else if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, canViewDashboard, can, router]);

  useEffect(() => {
    if (!currentUser || !canViewDashboard) return;
    let cancelled = false;

    (async () => {
      try {
        const promises = [];

        if (needUsers) promises.push(fetch('/api/users').then((r) => (r.ok ? r.json() : [])));
        else promises.push(Promise.resolve([]));

        if (needOrders) promises.push(fetch('/api/orders').then((r) => (r.ok ? r.json() : [])));
        else promises.push(Promise.resolve([]));

        const [uData, oData] = await Promise.all(promises);
        if (cancelled) return;
        setUsers(uData || []);
        setOrders(oData || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, canViewDashboard, needUsers, needOrders]);

  const kpi = useMemo(() => {
    const totalRevenue = orders
      .filter((o) => o.status === 'PAID' || o.status === 'PROCESSING' || o.status === 'SHIPPED' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING' || o.status === 'PAID').length;
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

  const hasAnyKpi = canKpiRevenue || canKpiOrders || canKpiProducts || canKpiUsers;

  if ((authLoading && !currentUser) || (!authLoading && (!currentUser || !canViewDashboard))) {
    return (
      <div className={styles.dashboardLoading}>
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Memuat dashboard...</span>
      </div>
    );
  }

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <h1 className={styles.headerTitle}>Dashboard</h1>
            <p className={styles.headerSubtitle}>
              Ringkasan performa penjualan, status pesanan, dan ketersediaan stok
            </p>
          </div>
          <div className={styles.headerQuickActions}>
            <Link href="/admin/orders?status=PENDING" className={styles.quickActionBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>Pesanan Masuk</span>
            </Link>
            <Link href="/admin/chat" className={styles.quickActionBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Live Chat</span>
            </Link>
            <Link href="/admin/products" className={styles.quickActionPrimaryBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Kelola Produk</span>
            </Link>
          </div>
        </div>

        {/* KPI Metrics Cards Grid */}
        {hasAnyKpi && (
          <div className={styles.kpiGrid}>
            {canKpiRevenue && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiTitle}>Total Omset</span>
                  <div className={styles.kpiIconWrapper}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                </div>
                <div className={styles.kpiValue}>{formatCurrency(kpi.totalRevenue)}</div>
                <div className={styles.kpiSubtext}>Dari transaksi diproses/selesai</div>
              </div>
            )}

            {canKpiOrders && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiTitle}>Total Pesanan</span>
                  <div className={styles.kpiIconWrapper}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                </div>
                <div className={styles.kpiValue}>{kpi.totalOrders}</div>
                <div className={styles.kpiSubtext}>
                  {kpi.pendingOrdersCount > 0 ? (
                    <span className={styles.subtextWarning}>
                      {kpi.pendingOrdersCount} Pesanan Baru
                    </span>
                  ) : (
                    <span className={styles.subtextMuted}>Semua transaksi diproses</span>
                  )}
                </div>
              </div>
            )}

            {canKpiProducts && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiTitle}>Katalog Produk</span>
                  <div className={styles.kpiIconWrapper}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                </div>
                <div className={styles.kpiValue}>{kpi.totalProducts}</div>
                <div className={styles.kpiSubtext}>
                  {kpi.lowStockCount > 0 ? (
                    <span className={styles.subtextDanger}>
                      {kpi.lowStockCount} Produk Stok Menipis/Habis
                    </span>
                  ) : (
                    <span className={styles.subtextMuted}>Stok aman tersedia</span>
                  )}
                </div>
              </div>
            )}

            {canKpiUsers && (
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiTitle}>Total Pengguna</span>
                  <div className={styles.kpiIconWrapper}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>
                <div className={styles.kpiValue}>{kpi.totalUsers}</div>
                <div className={styles.kpiSubtext}>Pelanggan & Admin terdaftar</div>
              </div>
            )}
          </div>
        )}

        {/* Recent Orders */}
        {canViewOrders && (
          <div className={styles.dashboardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Pesanan Terbaru
              </h2>
              <Link href="/admin/orders" className={styles.sectionLink}>
                Lihat Semua &rarr;
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className={styles.tableCard}>
                <div className={styles.emptyState}>
                  <svg className={styles.emptyIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <div className={styles.emptyTitle}>Belum Ada Pesanan</div>
                  <div className={styles.emptyDesc}>Pesanan baru dari website dan live checkout akan tercatat otomatis di sini.</div>
                </div>
              </div>
            ) : (
              <div className={styles.tableCard}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th className={styles.thIndex}>No.</th>
                      <th>ID</th>
                      <th>Sumber</th>
                      <th>Pelanggan</th>
                      <th className={styles.hideOnMobile}>Item</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th className={`${styles.hideOnMobile} ${styles.thTime}`}>Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o, index) => {
                      const badge = statusBadge(o.status, o);
                      const itemCount = (o.items || []).reduce((n, it) => n + (it.quantity || 1), 0);
                      return (
                        <tr key={o.id} className={styles.tableRow}>
                          <td className={styles.tdIndex}>{index + 1}</td>
                          <td>
                            <Link href={`/admin/orders?highlightOrder=${o.id}`} className={styles.orderIdLink}>
                              {formatOrderId(o.id)}
                            </Link>
                          </td>
                          <td>
                            <OrderSourceBadge order={o} />
                          </td>
                          <td>
                            <div className={styles.customerName}>{o.name || o.user?.name || 'Guest'}</div>
                            <div className={`${styles.hideOnMobile} ${styles.customerMeta}`}>
                              {o.orderSource === 'TIKTOK_LIVE' && o.tiktokUsername
                                ? `@${o.tiktokUsername}`
                                : (o.email || o.user?.email || '-')}
                            </div>
                          </td>
                          <td className={`${styles.hideOnMobile} ${styles.itemCountCol}`}>{itemCount} item</td>
                          <td className={styles.orderTotalCol}>{formatCurrency(o.total)}</td>
                          <td>
                            <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
                          </td>
                          <td className={`${styles.hideOnMobile} ${styles.orderTimeCol}`}>
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
        )}

        {/* Low Stock Alert */}
        {canViewProducts && (
          <div className={styles.dashboardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Stok Menipis / Habis
              </h2>
              <Link href="/admin/products" className={styles.sectionLink}>
                Kelola Produk &rarr;
              </Link>
            </div>

            {productsLoading ? (
              <div className={styles.tableCard}>
                <div className={styles.emptyState}>
                  <div className={styles.loadingSpinner} />
                  <span className={styles.loadingText}>Memuat produk...</span>
                </div>
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className={styles.tableCard}>
                <div className={styles.emptyState}>
                  <svg className={styles.emptyIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div className={styles.emptyTitle}>Stok Tersedia Aman</div>
                  <div className={styles.emptyDesc}>Semua produk memiliki stok di atas batas minimum.</div>
                </div>
              </div>
            ) : (
              <div className={styles.tableCard}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th className={styles.thIndex}>No.</th>
                      <th className={styles.hideOnMobile}>Gambar</th>
                      <th>Nama Produk</th>
                      <th className={styles.hideOnMobile}>Kategori</th>
                      <th>Stok</th>
                      <th className={styles.thAction}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map((p, index) => (
                      <tr key={p.id} className={styles.tableRow}>
                        <td className={styles.tdIndex}>{index + 1}</td>
                        <td className={styles.hideOnMobile}>
                          <div className={styles.productThumb}>
                            {p.image ? (
                              <Image src={p.image} alt={p.name} fill className={styles.productThumbImg} />
                            ) : (
                              <div className={styles.productThumbFallback}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                  <circle cx="9" cy="9" r="2" />
                                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={styles.productNameCol}>{p.name}</td>
                        <td className={`${styles.hideOnMobile} ${styles.productCategoryCol}`}>{p.form || p.category}</td>
                        <td>
                          {p.quantity > 0 ? (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>Stok: {p.quantity}</span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeDanger}`}>Habis</span>
                          )}
                        </td>
                        <td className={styles.tdAction}>
                          <Link
                            href="/admin/products"
                            className={styles.tableActionBtn}
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
        )}
      </div>
    </div>
  );
}
