'use client';

import { useEffect, useMemo, useState } from 'react';
// Cross-route CSS import for card/list styling shared with the admin
// dashboard. Owned classes for this page live in `orders.module.css`.
import dashStyles from '../dashboard/adminDashboard.module.css';
import styles from './orders.module.css';

const formattedCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const STATUS_OPTIONS = [
  { value: 'All', label: 'Semua Status' },
  { value: 'PROCESSING', label: 'Lunas / Diproses (PROCESSING)' },
  { value: 'SHIPPED', label: 'Dikirim (SHIPPED)' },
  { value: 'COMPLETED', label: 'Selesai (COMPLETED)' },
  { value: 'PENDING', label: 'Menunggu Pembayaran (PENDING)' },
  { value: 'CANCELLED', label: 'Dibatalkan (CANCELLED)' },
  { value: 'RETURNED', label: 'Dikembalikan (RETURNED)' },
];

function statusBadgeClass(status) {
  if (status === 'PROCESSING' || status === 'COMPLETED') return dashStyles.badgeSuccess;
  if (status === 'PENDING' || status === 'SHIPPED') return dashStyles.badgeWarning;
  return dashStyles.badgeDanger; // CANCELLED, RETURNED, or unknown
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [pickingUpId, setPickingUpId] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) setOrders(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        o.id.toLowerCase().includes(q) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.email && o.email.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const handleRequestPickup = async (order) => {
    const confirmed = window.confirm(
      `Panggil kurir untuk pesanan #${order.id.slice(0, 8)}?\n` +
      `Biteship akan generate AWB otomatis. Aksi ini akan menyalakan tarif kurir.`
    );
    if (!confirmed) return;

    setPickingUpId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipment`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memanggil kurir');
      if (data._meta?.awaitingWaybill) {
        alert('Pickup dibuat. AWB belum keluar dari Biteship — akan otomatis muncul saat kurir alokasi paket.');
      } else {
        alert('Pickup berhasil dijadwalkan!\nAWB: ' + data.trackingNumber);
      }
      loadOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setPickingUpId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Manajemen Pesanan</h1>
        <p className={styles.subtitle}>Kelola pengiriman, panggil kurir, cetak resi.</p>
      </div>

      <div className={dashStyles.controlBar}>
        <div className={dashStyles.searchBox}>
          <svg className={dashStyles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari ID Pesanan, Nama, atau Email Pembeli..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={dashStyles.searchInput}
          />
        </div>

        <div className={dashStyles.filterGroup}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={dashStyles.selectInput}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className={styles.loading}>Memuat transaksi...</p>
      ) : filteredOrders.length === 0 ? (
        <div className={`${dashStyles.tableCard} ${styles.emptyState}`}>
          {statusFilter === 'All'
            ? 'Belum ada transaksi.'
            : `Tidak ada pesanan berstatus ${statusFilter}.`}
        </div>
      ) : (
        <div className={dashStyles.orderList}>
          {filteredOrders.map((order) => (
            <div key={order.id} className={dashStyles.orderCard}>
              <div className={dashStyles.orderHeader}>
                <div>
                  <h4 className={dashStyles.orderId}>Pesanan #{order.id.slice(0, 8)}</h4>
                  <span className={dashStyles.orderDate}>{new Date(order.createdAt).toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className={`${dashStyles.badge} ${statusBadgeClass(order.status)}`}>{order.status}</span>
                </div>
              </div>

              <div className={dashStyles.orderInnerGrid}>
                <div>
                  <h5 className={dashStyles.orderSectionTitle}>Produk Dibeli</h5>
                  {order.items.map((item) => (
                    <div key={item.id} className={dashStyles.orderItemRow}>
                      <span>{item.product?.name || 'Produk dihapus'} (x{item.quantity})</span>
                      <span>{formattedCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className={dashStyles.orderTotalRow}>
                    <span>Total Tagihan</span>
                    <span className={styles.totalHighlight}>{formattedCurrency(order.total)}</span>
                  </div>
                </div>

                <div>
                  <h5 className={dashStyles.orderSectionTitle}>Pelanggan &amp; Tujuan Pengiriman</h5>
                  <div className={dashStyles.customerInfo}>
                    <div className={dashStyles.customerName}>{order.name}</div>
                    <div>Email: {order.email}</div>
                    <div>Telp: {order.phone}</div>
                    <div className={styles.addressLine}>
                      Alamat: {order.streetAddress}, {order.rtRw}, Kel. {order.village}, Kec. {order.district}, {order.city}, {order.province}, {order.postalCode}
                    </div>
                    {order.trackingNumber && (
                      <div className={styles.trackingLine}>
                        AWB: <strong>{order.trackingNumber}</strong>
                        {order.biteshipStatus && <span className={styles.biteshipHint}> · {order.biteshipStatus}</span>}
                      </div>
                    )}
                  </div>

                  <div className={styles.actionsRow}>
                    {order.status === 'PROCESSING' && !order.biteshipShipmentId && (
                      <button
                        onClick={() => handleRequestPickup(order)}
                        className={`btn btn-primary ${styles.smallBtn}`}
                        disabled={pickingUpId === order.id}
                      >
                        {pickingUpId === order.id ? 'Memanggil...' : 'Panggil Kurir'}
                      </button>
                    )}
                    {order.trackingNumber && (
                      <a
                        href={`/admin/orders/${order.id}/label`}
                        target="_blank"
                        rel="noreferrer"
                        className={`btn btn-outline ${styles.smallBtn}`}
                      >
                        Cetak Resi
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
