'use client';

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMethodLabel } from '@/lib/paymentFee';
import styles from './orders.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const STATUS_OPTIONS = [
  { value: 'All', label: 'Semua Status' },
  // "NEW" adalah pseudo-status yang menggabungkan PENDING + PAID — dipakai
  // untuk halaman "Pesanan Baru" di sidebar.
  { value: 'NEW', label: 'Pesanan Baru (Pending + Lunas)' },
  { value: 'PENDING', label: 'Menunggu Bayar' },
  { value: 'PAID', label: 'Lunas (Belum Diproses)' },
  { value: 'PROCESSING', label: 'Diproses (Resi Dipanggil)' },
  { value: 'SHIPPED', label: 'Dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
  { value: 'RETURNED', label: 'Retur' },
];

// Subset dropdown untuk halaman "Pesanan Baru" — hanya izinkan zoom antara
// NEW (gabungan) atau salah satu sub-status-nya.
const NEW_PAGE_OPTIONS = [
  { value: 'NEW', label: 'Semua Pesanan Baru' },
  { value: 'PENDING', label: 'Menunggu Bayar' },
  { value: 'PAID', label: 'Lunas' },
];

// Kalau URL sudah membawa status spesifik (dari klik sidebar), dropdown
// tidak perlu tampil — konteks sudah jelas dari halaman.
const SINGLE_STATUS_PAGES = new Set(['PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED']);

const VALID_STATUSES = new Set([
  'NEW', 'PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED',
]);

// Pseudo-status "NEW" → real statuses yang di-include saat filter.
const NEW_ORDER_STATUSES = new Set(['PENDING', 'PAID']);

// Statuses where the shipping label still represents an active shipment.
// PAID / PROCESSING: admin sering perlu cetak label lebih dulu untuk prep
// packaging — labelnya render badge "MENUNGGU NOMOR RESI" kalau AWB belum
// ada. Admin akan cetak ulang begitu AWB turun. CANCELLED / RETURNED
// dieksklusi karena reprint label bekas cancel bisa nyasar paket.
const PRINTABLE_STATUSES = new Set(['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED']);

const STATUS_BADGE_CLASS = {
  PENDING: styles.badgePending,
  PAID: styles.badgePaid,
  PROCESSING: styles.badgeProcessing,
  SHIPPED: styles.badgeShipped,
  COMPLETED: styles.badgeCompleted,
  CANCELLED: styles.badgeCancelled,
  RETURNED: styles.badgeReturned,
};

// Human-readable label untuk badge status, dipakai konsisten di
// tampilan desktop DAN mobile — hindari mismatch enum vs short label.
const STATUS_LABEL = {
  PENDING: 'Belum Bayar',
  PAID: 'Lunas',
  PROCESSING: 'Diproses',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Retur',
};

function AdminOrdersPageInner() {
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status');
  const initialStatus = urlStatus && VALID_STATUSES.has(urlStatus) ? urlStatus : 'All';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, target: '' });

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    loadOrders();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL param
    setStatusFilter(urlStatus && VALID_STATUSES.has(urlStatus) ? urlStatus : 'All');
  }, [urlStatus]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        o.id.toLowerCase().includes(q) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.email && o.email.toLowerCase().includes(q));
      let matchStatus;
      if (statusFilter === 'All') matchStatus = true;
      else if (statusFilter === 'NEW') matchStatus = NEW_ORDER_STATUSES.has(o.status);
      else matchStatus = o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const allFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));

  const toggleRowSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllSelect = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  // Only PAID orders can call the courier — status advances to PROCESSING
  // once pickup is booked, so PROCESSING is the "already called" state.
  const eligiblePickup = selectedOrders.filter((o) => o.status === 'PAID' && !o.biteshipShipmentId).length;
  // Label bisa dicetak selama status aktif (PAID+). Tidak wajib punya AWB —
  // LabelContent otomatis tampilkan badge "MENUNGGU NOMOR RESI" saat kosong.
  const eligiblePrint = selectedOrders.filter((o) => PRINTABLE_STATUSES.has(o.status)).length;

  const handleBulkPickup = async () => {
    if (eligiblePickup === 0) {
      alert('Tidak ada order yang bisa di-pickup. Hanya order LUNAS (PAID) tanpa shipment yang eligible.');
      return;
    }
    const confirmed = window.confirm(
      `Panggil kurir untuk ${eligiblePickup} order?\n` +
      'Order non-PAID atau yang sudah punya shipment akan di-skip.'
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders/bulk/pickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal bulk pickup');
      const ok = data.results.filter((r) => r.ok).length;
      const failed = data.results.filter((r) => !r.ok).length;
      alert(`Selesai: ${ok} sukses, ${failed} gagal.\n${failed > 0 ? 'Cek order gagal di daftar (status tidak berubah).' : ''}`);
      setSelectedIds(new Set());
      loadOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBulkPrint = () => {
    const ids = selectedOrders
      .filter((o) => PRINTABLE_STATUSES.has(o.status))
      .map((o) => o.id);
    if (ids.length === 0) {
      alert('Tidak ada order yang bisa dicetak resinya. Hanya order PAID, PROCESSING, SHIPPED, atau COMPLETED yang eligible.');
      return;
    }
    window.open(`/admin/orders/labels-batch?ids=${ids.join(',')}`, '_blank');
  };

  const handleBulkStatus = async () => {
    if (!statusModal.target) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/orders/bulk/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedIds), status: statusModal.target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal update status');
      const ok = data.results.filter((r) => r.ok).length;
      alert(`Selesai: ${ok} order status di-update ke ${statusModal.target}.`);
      setStatusModal({ open: false, target: '' });
      setSelectedIds(new Set());
      loadOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Manajemen Pesanan</h1>
        <p className={styles.subtitle}>Klik baris untuk lihat detail. Pilih multiple untuk bulk action.</p>
      </div>

      <div className={styles.controlBar}>
        <input
          type="text"
          placeholder="Cari ID Pesanan, Nama, atau Email Pembeli..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        {/* Dropdown status: konteks halaman menentukan opsi yang muncul.
         *  - `?status=NEW`     → hanya PENDING/PAID (dan reset ke NEW)
         *  - single-status page → tidak render (redundant)
         *  - "Semua"/default  → full options
         */}
        {SINGLE_STATUS_PAGES.has(urlStatus) ? null : (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.selectInput}
          >
            {(urlStatus === 'NEW' ? NEW_PAGE_OPTIONS : STATUS_OPTIONS).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkBarCount}>{selectedIds.size} terpilih</span>
          <button
            className={styles.bulkBtn}
            onClick={handleBulkPickup}
            disabled={busy || eligiblePickup === 0}
            title={eligiblePickup === 0 ? 'Tidak ada order eligible untuk pickup' : ''}
          >
            Panggil Kurir ({eligiblePickup})
          </button>
          <button
            className={`${styles.bulkBtn} ${styles.bulkBtnOutline}`}
            onClick={handleBulkPrint}
            disabled={busy || eligiblePrint === 0}
          >
            Cetak Resi ({eligiblePrint})
          </button>
          <button
            className={`${styles.bulkBtn} ${styles.bulkBtnOutline}`}
            onClick={() => setStatusModal({ open: true, target: '' })}
            disabled={busy}
          >
            Ubah Status
          </button>
          <button
            className={`${styles.bulkBtn} ${styles.bulkBtnGhost}`}
            onClick={() => setSelectedIds(new Set())}
          >
            Batal
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Memuat pesanan...</div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.empty}>
          {statusFilter === 'All' ? 'Belum ada pesanan.' : `Tidak ada pesanan berstatus ${statusFilter}.`}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.tdCheck}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllSelect}
                      aria-label="Pilih semua"
                    />
                  </th>
                  <th>ID</th>
                  <th className={styles.hideOnMobile}>Tanggal</th>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th className={styles.hideOnMobile} style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const isSelected = selectedIds.has(order.id);
                  return (
                    <Fragment key={order.id}>
                      <tr
                        className={`${isSelected ? styles.rowSelected : ''} ${isExpanded ? styles.rowExpanded : ''}`.trim()}
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      >
                        <td className={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelect(order.id)}
                            aria-label={`Pilih order ${order.id.slice(0, 8)}`}
                          />
                        </td>
                        <td className={styles.tdId}>#{order.id.slice(0, 8)}</td>
                        <td className={styles.tdDate}>{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className={styles.tdCustomer}>
                          <div className={styles.tdCustomerName}>{order.name}</div>
                          <div className={styles.tdCustomerEmail}>{order.email}</div>
                        </td>
                        <td className={styles.tdTotal}>{formatIDR(order.total)}</td>
                        <td>
                          <span className={`${styles.badge} ${STATUS_BADGE_CLASS[order.status] || styles.badgeCancelled}`}>
                            {STATUS_LABEL[order.status] || order.status}
                          </span>
                        </td>
                        <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                          {PRINTABLE_STATUSES.has(order.status) && (
                            <a
                              href={`/admin/orders/${order.id}/label`}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.actionBtn}
                            >
                              Resi
                            </a>
                          )}
                          <button className={styles.actionBtn} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                            {isExpanded ? 'Tutup' : 'Detail'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={styles.expandRow}>
                          <td colSpan={7}>
                            <div className={styles.expandGrid}>
                              <div className={styles.expandSection}>
                                <h5>Produk</h5>
                                {order.items.map((it) => (
                                  <div key={it.id} className={styles.itemRow}>
                                    <span>{it.product?.name || 'Produk dihapus'} {it.selectedSize ? `(${it.selectedSize})` : ''} × {it.quantity}</span>
                                    <span>{formatIDR(it.price * it.quantity)}</span>
                                  </div>
                                ))}
                                <div className={styles.itemRow} style={{ marginTop: '0.5rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                                  <span>{formatIDR(order.subtotal)}</span>
                                </div>
                                <div className={styles.itemRow}>
                                  <span style={{ color: 'var(--text-muted)' }}>Ongkir</span>
                                  <span>{formatIDR(order.shippingFee)}</span>
                                </div>
                                <div className={styles.itemRow}>
                                  <span style={{ color: 'var(--text-muted)' }}>
                                    Biaya Admin {order.paymentMethod ? `(${getMethodLabel(order.paymentMethod)})` : ''}
                                  </span>
                                  <span>{formatIDR(order.paymentFee)}</span>
                                </div>
                                <div className={styles.itemRow} style={{ marginTop: '0.5rem', fontWeight: 700 }}>
                                  <span>Total</span>
                                  <span style={{ color: 'var(--primary)' }}>{formatIDR(order.total)}</span>
                                </div>
                              </div>
                              <div className={styles.expandSection}>
                                <h5>Pengiriman</h5>
                                <div className={styles.customerDetail}>
                                  <div><strong>{order.name}</strong></div>
                                  <div>{order.phone}</div>
                                  <div>{order.streetAddress}, {order.rtRw}</div>
                                  <div>Kel. {order.village}, Kec. {order.district}</div>
                                  <div>{order.city}, {order.province} {order.postalCode}</div>
                                </div>
                                {order.trackingNumber && (
                                  <div className={styles.awbRow}>
                                    <span className={styles.awbLabel}>AWB:</span>
                                    <strong>{order.trackingNumber}</strong>
                                    {order.biteshipStatus && <span style={{ color: 'var(--text-muted)' }}> · {order.biteshipStatus}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statusModal.open && (
        <div className={styles.modalBackdrop} onClick={() => setStatusModal({ open: false, target: '' })}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Ubah Status Bulk</div>
            <div className={styles.modalDesc}>
              {selectedIds.size} order akan diubah statusnya. Aksi ini <b>admin override</b> —
              tidak trigger restock atau notifikasi. Untuk cancel dengan restock, gunakan flow webhook.
            </div>
            <select
              value={statusModal.target}
              onChange={(e) => setStatusModal({ ...statusModal, target: e.target.value })}
              className={styles.selectInput}
              style={{ width: '100%' }}
            >
              <option value="">— pilih status —</option>
              {STATUS_OPTIONS.filter((o) => o.value !== 'All').map((o) => (
                <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button className={`${styles.bulkBtn} ${styles.bulkBtnGhost}`} onClick={() => setStatusModal({ open: false, target: '' })}>
                Batal
              </button>
              <button
                className={styles.bulkBtn}
                onClick={handleBulkStatus}
                disabled={!statusModal.target || busy}
              >
                {busy ? 'Menyimpan...' : 'Ubah Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className={styles.page}><p className={styles.loading}>Memuat...</p></div>}>
      <AdminOrdersPageInner />
    </Suspense>
  );
}
