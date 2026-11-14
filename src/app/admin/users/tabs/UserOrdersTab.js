'use client';

import Link from 'next/link';
import styles from '../users.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const STATUS_LABELS = {
  PENDING: 'Belum Bayar',
  PAID: 'Lunas',
  PROCESSING: 'Diproses',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Retur',
};

const STATUS_COLORS = {
  PENDING: '#F59E0B',
  PAID: '#10B981',
  PROCESSING: '#3B82F6',
  SHIPPED: '#8B5CF6',
  COMPLETED: '#059669',
  CANCELLED: '#EF4444',
  RETURNED: '#EC4899',
};

export default function UserOrdersTab({ orders = [] }) {
  if (!orders || orders.length === 0) {
    return (
      <div className={styles.tabEmptyState}>
        <svg className={styles.tabEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        <h4 className={styles.tabEmptyTitle}>Belum Ada Riwayat Pesanan</h4>
        <p className={styles.tabEmptyDesc}>
          Pengguna ini belum pernah melakukan checkout atau transaksi pemesanan di website.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.orderCardList}>
      {orders.map((order) => {
        const statusColor = STATUS_COLORS[order.status] || '#8E8E93';
        const statusText = STATUS_LABELS[order.status] || order.status;

        return (
          <div key={order.id} className={styles.orderCard}>
            <div className={styles.orderCardHeader}>
              <div className={styles.orderMetaLeft}>
                <span className={styles.orderIdText}>#{order.id.slice(0, 8)}</span>
                <span className={styles.orderDateText}>
                  {new Date(order.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                </span>
                {order.orderSource && order.orderSource !== 'WEB' && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 107, 53, 0.1)',
                      color: 'var(--primary)',
                    }}
                  >
                    {order.orderSource}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: `${statusColor}18`,
                    color: statusColor,
                    border: `1px solid ${statusColor}33`,
                  }}
                >
                  {statusText}
                </span>

                <Link
                  href={`/admin/orders?highlightOrder=${encodeURIComponent(order.id)}`}
                  target="_blank"
                  className={styles.btnSecondarySmall}
                  style={{ textDecoration: 'none' }}
                >
                  Lihat Order
                </Link>
              </div>
            </div>

            <div className={styles.orderItemsWrapper}>
              {order.items &&
                order.items.map((it) => (
                  <div key={it.id} className={styles.orderItemRow}>
                    <div className={styles.orderItemLeft}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.customImage || it.product?.image || '/img/betta-1.png'}
                        alt={it.customName || it.product?.name || 'Ikan'}
                        className={styles.orderItemThumb}
                        onError={(e) => {
                          e.target.src = '/img/betta-1.png';
                        }}
                      />
                      <div className={styles.orderItemDetails}>
                        <div className={styles.orderItemName}>
                          {it.customName || it.product?.name || 'Produk'}{' '}
                          {it.selectedSize ? `(${it.selectedSize})` : ''}
                        </div>
                        <div className={styles.orderItemMeta}>
                          {it.quantity} ekor × {formatIDR(it.price)}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatIDR(it.price * it.quantity)}
                    </span>
                  </div>
                ))}
            </div>

            <div className={styles.orderCardFooter}>
              <div style={{ color: 'var(--text-muted)' }}>
                {order.shippingCourier ? `${order.shippingCourier.toUpperCase()} (${order.shippingService || 'Reguler'})` : 'Ekspedisi'}
                {order.trackingNumber && (
                  <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                    • No. Resi: {order.trackingNumber}
                  </span>
                )}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.4rem' }}>Total:</span>
                <span className={styles.orderTotalVal}>{formatIDR(order.total)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
