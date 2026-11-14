'use client';

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getMethodLabel } from '@/lib/paymentFee';
import { useToast } from '@/context/ToastContext';
import { canUser, getFirstAccessibleAdminRoute } from '@/lib/permission-utils';
import ShipmentTracker, { getCourierTrackingUrl } from '@/app/customer/orders/ShipmentTracker';
import OrderSourceBadge from '@/components/admin/OrderSourceBadge';
import AdminCheckbox from '@/components/admin/AdminCheckbox';
import OrderSelect from './OrderSelect';
import styles from './orders.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const SOURCE_OPTIONS = [
  { value: 'All', label: 'Semua Sumber' },
  { value: 'WEB', label: 'Website Reguler', dotTone: 'web' },
  { value: 'TIKTOK_LIVE', label: 'TikTok Live', dotTone: 'tiktok' },
  { value: 'TELEGRAM', label: 'Telegram Drop', dotTone: 'telegram' },
];

const STATUS_OPTIONS = [
  { value: 'All', label: 'Semua Status' },
  // "NEW" adalah pseudo-status yang menggabungkan PENDING + PAID — dipakai
  // untuk halaman "Pesanan Baru" di sidebar.
  { value: 'NEW', label: 'Pesanan Baru' },
  { value: 'PENDING', label: 'Belum Bayar', dotTone: 'pending' },
  { value: 'PAID', label: 'Lunas', dotTone: 'paid' },
  { value: 'PROCESSING', label: 'Diproses', dotTone: 'processing' },
  { value: 'READY_FOR_PICKUP', label: 'Menunggu Kurir', dotTone: 'processing' },
  { value: 'SHIPPED', label: 'Dikirim', dotTone: 'shipped' },
  { value: 'COMPLETED', label: 'Selesai', dotTone: 'completed' },
  { value: 'CANCELLED', label: 'Dibatalkan', dotTone: 'cancelled' },
  { value: 'RETURNED', label: 'Retur', dotTone: 'returned' },
];

// Subset dropdown untuk halaman "Pesanan Baru" — hanya izinkan zoom antara
// NEW (gabungan) atau salah satu sub-status-nya.
const NEW_PAGE_OPTIONS = [
  { value: 'NEW', label: 'Semua Pesanan Baru' },
  { value: 'PENDING', label: 'Belum Bayar', dotTone: 'pending' },
  { value: 'PAID', label: 'Lunas', dotTone: 'paid' },
];

// Pilihan status untuk modal Ubah Status Bulk — selaras dengan label kolom Status di tabel
const BULK_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Belum Bayar', dotTone: 'pending' },
  { value: 'PAID', label: 'Lunas', dotTone: 'paid' },
  { value: 'PROCESSING', label: 'Diproses', dotTone: 'processing' },
  { value: 'READY_FOR_PICKUP', label: 'Menunggu Kurir', dotTone: 'processing' },
  { value: 'SHIPPED', label: 'Dikirim', dotTone: 'shipped' },
  { value: 'COMPLETED', label: 'Selesai', dotTone: 'completed' },
  { value: 'CANCELLED', label: 'Dibatalkan', dotTone: 'cancelled' },
  { value: 'RETURNED', label: 'Retur', dotTone: 'returned' },
];

const iconChannel = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const iconStatusFilter = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// Kalau URL sudah membawa status spesifik (dari klik sidebar), dropdown
// tidak perlu tampil — konteks sudah jelas dari halaman.
const SINGLE_STATUS_PAGES = new Set(['PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED']);

const VALID_STATUSES = new Set([
  'NEW', 'PENDING', 'PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'RETURNED',
]);

// Pseudo-status "NEW" → real statuses yang di-include saat filter.
const NEW_ORDER_STATUSES = new Set(['PENDING', 'PAID']);

// Statuses where the shipping label still represents an active shipment.
// PAID / PROCESSING: admin sering perlu cetak label lebih dulu untuk prep
// packaging — labelnya render badge "MENUNGGU NOMOR RESI" kalau AWB belum
// ada. Admin akan cetak ulang begitu AWB turun. CANCELLED / RETURNED
// dieksklusi karena reprint label bekas cancel bisa nyasar paket.
const PRINTABLE_STATUSES = new Set(['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED']);

// Statuses where the shipment can be actively tracked.
// PENDING: belum bayar (belum ada pengiriman/resi)
// PAID: lunas tapi belum dipanggil kurir (belum ada resi)
// CANCELLED: dibatalkan
// PROCESSING, SHIPPED, COMPLETED, RETURNED: kurir sudah dipanggil, resi AWB tersedia dan dapat dilacak.
const TRACKABLE_STATUSES = new Set(['PROCESSING', 'SHIPPED', 'COMPLETED', 'RETURNED']);
const isOrderTrackable = (order) => Boolean(order?.trackingNumber && TRACKABLE_STATUSES.has(order?.status));

const STATUS_BADGE_CLASS = {
  PENDING: styles.badgePending,
  PAID: styles.badgePaid,
  PROCESSING: styles.badgeProcessing,
  READY_FOR_PICKUP: styles.badgeProcessing,
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
  READY_FOR_PICKUP: 'Menunggu Kurir',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Retur',
};

function AdminOrdersPageInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const urlStatus = searchParams.get('status');
  const highlightParam =
    searchParams.get('highlightOrder') ||
    searchParams.get('highlight') ||
    searchParams.get('orderId') ||
    (searchParams.get('search') && !searchParams.get('search').includes(' ') ? searchParams.get('search') : null);
  const initialStatus = urlStatus && VALID_STATUSES.has(urlStatus) ? urlStatus : 'All';

  const canView = canUser(currentUser, 'orders:view');
  const canLabel = canUser(currentUser, 'shipping:label');
  const canUpdateStatus = canUser(currentUser, 'orders:update');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(highlightParam);
  // Mode pemilihan (Selection Mode): checkbox tersembunyi sampai tombol 'Pilih' diklik
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, target: '' });
  const [trackingModal, setTrackingModal] = useState({
    open: false,
    order: null,
    loading: false,
    error: null,
    data: null,
    copied: false,
  });

  const openTrackingModal = async (order) => {
    if (!order || !order.trackingNumber) return;
    setTrackingModal({
      open: true,
      order,
      loading: true,
      error: null,
      data: null,
      copied: false,
    });

    try {
      const courier = order.shippingCourier || '';
      const res = await fetch(`/api/shipping/track?waybill=${encodeURIComponent(order.trackingNumber)}&courier=${encodeURIComponent(courier)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil informasi pelacakan.');
      setTrackingModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
      loadOrders(true);
    } catch (err) {
      setTrackingModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Gagal melacak pesanan.',
      }));
    }
  };

  const closeTrackingModal = () => {
    setTrackingModal({
      open: false,
      order: null,
      loading: false,
      error: null,
      data: null,
      copied: false,
    });
  };

  const handleCopyTrackingNumber = (trackingNumber) => {
    if (!trackingNumber) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(trackingNumber);
    }
    setTrackingModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setTrackingModal((prev) => ({ ...prev, copied: false }));
    }, 2000);
  };

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login');
      } else if (!canView) {
        const fallback = getFirstAccessibleAdminRoute((p) => canUser(currentUser, p));
        router.push(fallback || '/customer/dashboard');
      }
    }
  }, [currentUser, authLoading, canView, router]);

  // Auto-scroll dan highlight baris pesanan saat admin diarahkan dari link chat (?highlightOrder=...)
  useEffect(() => {
    if (!highlightParam || loading || orders.length === 0) return;

    const targetOrder = orders.find(
      (o) => o.id === highlightParam || o.id.startsWith(highlightParam)
    );

    if (targetOrder) {
      // Pastikan filter status tidak menyembunyikan order ini
      if (statusFilter !== 'All' && statusFilter !== targetOrder.status) {
        const isMatchNew = statusFilter === 'NEW' && NEW_ORDER_STATUSES.has(targetOrder.status);
        if (!isMatchNew) {
          setStatusFilter('All');
        }
      }

      setHighlightedId(targetOrder.id);
      setExpandedId(targetOrder.id);

      // Scroll otomatis ke posisi baris tabel
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById(`order-row-${targetOrder.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);

      // Hilangkan pulse highlight setelah 4.5 detik
      const clearTimer = setTimeout(() => {
        setHighlightedId(null);
      }, 4500);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightParam, orders, loading, statusFilter]);

  const inFlightRef = useRef(false);
  const lastLoadedRef = useRef(Date.now());

  const loadOrders = async (silent = false) => {
    if (inFlightRef.current) return;
    // Jangan polling jika tab sedang di latar belakang (background tab)
    if (silent && typeof document !== 'undefined' && document.hidden) return;

    inFlightRef.current = true;
    if (!silent) setLoading(true);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      const res = await fetch('/api/orders', { signal: controller?.signal });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.status === 401 || res.status === 403) {
        return;
      }
      if (res.ok) {
        setOrders(await res.json());
        lastLoadedRef.current = Date.now();
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error(err);
    } finally {
      inFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    loadOrders(false);

    // 35 detik polling aman (Ably realtime juga tetap aktif mendengarkan event baru)
    const POLL_ORDERS_MS = 35_000;
    const timer = setInterval(() => {
      loadOrders(true);
    }, POLL_ORDERS_MS);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && Date.now() - lastLoadedRef.current >= 5_000) {
        loadOrders(true);
      }
    };
    const onWindowFocus = () => {
      if (Date.now() - lastLoadedRef.current >= 5_000) {
        loadOrders(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [canView]);

  useEffect(() => {
    if (!currentUser?.id || !canView) return;
    let client = null;
    let channel = null;
    let cancelled = false;

    const setup = async () => {
      try {
        const res = await fetch('/api/ably/status');
        if (!res.ok || cancelled) return;
        const { enabled } = await res.json();
        if (!enabled || cancelled) return;

        const Ably = await import('ably');
        if (cancelled) return;

        client = new Ably.Realtime({ authUrl: '/api/ably/auth', authMethod: 'GET' });
        client.connection.on(['failed', 'suspended', 'disconnected', 'closed'], () => {});

        if (cancelled) {
          try { client.close(); } catch {}
          return;
        }

        channel = client.channels.get(`user:${currentUser.id}`);
        channel.subscribe('notification', () => {
          loadOrders(true);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        }).catch(() => {});
      } catch (err) {
        console.warn('Admin orders Ably setup failed:', err.message);
      }
    };

    setup();
    return () => {
      cancelled = true;
      if (channel) {
        try { channel.unsubscribe(); } catch {}
      }
      if (client) {
        try { client.close(); } catch {}
      }
    };
  }, [currentUser?.id, canView]);

  useEffect(() => {
    setStatusFilter(urlStatus && VALID_STATUSES.has(urlStatus) ? urlStatus : 'All');
  }, [urlStatus]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch =
        o.id.toLowerCase().includes(q) ||
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.email && o.email.toLowerCase().includes(q)) ||
        (o.tiktokUsername && o.tiktokUsername.toLowerCase().includes(q)) ||
        (o.tiktokAccountName && o.tiktokAccountName.toLowerCase().includes(q));
      let matchStatus;
      if (statusFilter === 'All') matchStatus = true;
      else if (statusFilter === 'NEW') matchStatus = NEW_ORDER_STATUSES.has(o.status);
      else if (statusFilter === 'READY_FOR_PICKUP') {
        matchStatus = o.status === 'PROCESSING' && o.packingStatus === 'READY_FOR_PICKUP';
      } else if (statusFilter === 'PROCESSING') {
        matchStatus = o.status === 'PROCESSING' && o.packingStatus !== 'READY_FOR_PICKUP';
      } else {
        matchStatus = o.status === statusFilter;
      }
      const src = o.orderSource === 'TIKTOK_LIVE'
        ? 'TIKTOK_LIVE'
        : (o.orderSource === 'TELEGRAM' || o.telegramUsername)
          ? 'TELEGRAM'
          : 'WEB';
      const matchSource = sourceFilter === 'All' || src === sourceFilter;
      return matchSearch && matchStatus && matchSource;
    });
  }, [orders, search, statusFilter, sourceFilter]);

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

  // Label bisa dicetak selama status aktif (PAID+). Tidak wajib punya AWB —
  // LabelContent otomatis tampilkan badge "MENUNGGU NOMOR RESI" saat kosong.
  const eligiblePrint = selectedOrders.filter((o) => PRINTABLE_STATUSES.has(o.status)).length;

  const handleBulkPrint = () => {
    const eligibleOrders = selectedOrders.filter((o) => PRINTABLE_STATUSES.has(o.status));
    const ids = eligibleOrders.map((o) => o.id);
    if (ids.length === 0) {
      toast.warning('Tidak ada order yang bisa dicetak resinya. Hanya order PAID, PROCESSING, SHIPPED, atau COMPLETED yang eligible.');
      return;
    }

    // Buka tab pratinjau resi batch secara decoupled (noopener) agar thread utama tidak terblokir
    window.open(`/admin/orders/labels-batch?ids=${ids.join(',')}`, '_blank', 'noopener,noreferrer');

    // Trigger transisi otomatis: pesanan berstatus PAID langsung berpindah ke PROCESSING
    const paidIds = eligibleOrders.filter((o) => o.status === 'PAID').map((o) => o.id);
    if (paidIds.length > 0) {
      const paidSet = new Set(paidIds);
      // Optimistic update agar langsung pindah ke 'Diproses' dan keluar dari filter 'Pesanan Baru'
      setOrders((prev) =>
        prev.map((o) => (paidSet.has(o.id) ? { ...o, status: 'PROCESSING' } : o))
      );

      fetch('/api/admin/orders/bulk/mark-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: paidIds }),
      })
        .then((res) => {
          if (res.ok) {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        })
        .catch((err) => {
          console.error('Gagal memperbarui status order batch ke PROCESSING:', err);
        });

      toast.info(`Membuka ${ids.length} resi. ${paidIds.length} pesanan diubah ke Diproses.`);
    }

    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const handlePrintSingle = (order) => {
    if (!order) return;

    // Buka tab pratinjau resi dengan noopener agar thread browser utama tetap lancar (anti-freeze)
    window.open(`/admin/orders/${order.id}/label`, '_blank', 'noopener,noreferrer');

    // Jika status masih PAID, langsung trigger transisi ke PROCESSING saat tombol ditekan
    if (order.status === 'PAID') {
      // Optimistic update agar langsung pindah ke 'Diproses' dan keluar dari filter 'Pesanan Baru'
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'PROCESSING' } : o))
      );

      fetch('/api/admin/orders/bulk/mark-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [order.id] }),
      })
        .then((res) => {
          if (res.ok) {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        })
        .catch((err) => {
          console.error('Gagal memperbarui status order ke PROCESSING:', err);
        });

      toast.info('Membuka resi. Status pesanan diubah ke Diproses.');
    }
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
      const failed = data.results.length - ok;
      const targetLabel = STATUS_LABEL[statusModal.target] || statusModal.target;
      if (failed > 0) {
        toast.warning(`${ok} pesanan diubah ke ${targetLabel}, ${failed} gagal.`);
      } else {
        toast.success(`${ok} pesanan berhasil diubah ke status ${targetLabel}.`);
      }
      setStatusModal({ open: false, target: '' });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      loadOrders();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if ((authLoading && !currentUser) || (!authLoading && (!currentUser || !canView))) {
    return (
      <div className={styles.loading}>
        Memuat pesanan...
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Manajemen Pesanan</h1>
        <p className={styles.subtitle}>Klik baris untuk lihat detail. Klik Pilih untuk bulk action.</p>
      </div>

      <div className={styles.controlBar}>
        <input
          type="text"
          placeholder="Cari ID Pesanan, Nama, Email, atau Username TikTok..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <OrderSelect
          value={sourceFilter}
          onChange={setSourceFilter}
          options={SOURCE_OPTIONS}
          ariaLabel="Filter sumber pesanan"
          leadingIcon={iconChannel}
          isFiltered={sourceFilter !== 'All'}
        />
        {/* Dropdown status: konteks halaman menentukan opsi yang muncul.
         *  - `?status=NEW`     → hanya PENDING/PAID (dan reset ke NEW)
         *  - single-status page → tidak render (redundant)
         *  - "Semua"/default  → full options
         */}
        {SINGLE_STATUS_PAGES.has(urlStatus) ? null : (
          <OrderSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={urlStatus === 'NEW' ? NEW_PAGE_OPTIONS : STATUS_OPTIONS}
            ariaLabel="Filter status pesanan"
            leadingIcon={iconStatusFilter}
            isFiltered={statusFilter !== initialStatus}
            menuAlign="right"
          />
        )}
        {(canLabel || canUpdateStatus) && (
          <button
            type="button"
            onClick={() => {
              if (isSelectMode) {
                setIsSelectMode(false);
                setSelectedIds(new Set());
              } else {
                setIsSelectMode(true);
              }
            }}
            className={`${styles.refreshBtn} ${isSelectMode ? styles.selectActiveBtn : ''}`.trim()}
            title={isSelectMode ? 'Selesai memilih' : 'Pilih pesanan untuk bulk action'}
            aria-pressed={isSelectMode}
          >
            {isSelectMode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Selesai
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Pilih
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => loadOrders(false)}
          className={styles.refreshBtn}
          title="Segarkan data pesanan"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Segarkan
        </button>
      </div>

      {isSelectMode && selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkBarCount}>{selectedIds.size} terpilih</span>
          {canLabel && (
            <button
              className={styles.bulkBtn}
              onClick={handleBulkPrint}
              disabled={busy || eligiblePrint === 0}
            >
              Cetak Resi ({eligiblePrint})
            </button>
          )}
          {canUpdateStatus && (
            <button
              className={`${styles.bulkBtn} ${styles.bulkBtnOutline}`}
              onClick={() => setStatusModal({ open: true, target: '' })}
              disabled={busy}
            >
              Ubah Status
            </button>
          )}
          <button
            className={`${styles.bulkBtn} ${styles.bulkBtnGhost}`}
            onClick={() => {
              setSelectedIds(new Set());
              setIsSelectMode(false);
            }}
          >
            Batal
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Memuat pesanan...</div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.empty}>
          <span>
            {search.trim() || sourceFilter !== 'All' || statusFilter !== initialStatus
              ? 'Tidak ada pesanan yang cocok dengan filter aktif.'
              : statusFilter === 'All'
                ? 'Belum ada pesanan.'
                : statusFilter === 'READY_FOR_PICKUP'
                  ? 'Tidak ada pesanan yang sedang menunggu kurir.'
                  : `Tidak ada pesanan berstatus ${statusFilter === 'NEW' ? 'Pesanan Baru' : (STATUS_LABEL[statusFilter] || statusFilter)}.`}
          </span>
          {(search.trim() || sourceFilter !== 'All' || statusFilter !== initialStatus) && (
            <button
              type="button"
              className={styles.emptyResetBtn}
              onClick={() => {
                setSearch('');
                setSourceFilter('All');
                setStatusFilter(initialStatus);
              }}
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isSelectMode && (
                    <th className={styles.tdCheck}>
                      <AdminCheckbox
                        checked={allFilteredSelected}
                        onChange={toggleAllSelect}
                        ariaLabel="Pilih semua"
                      />
                    </th>
                  )}
                  <th className={styles.thIndex}>No.</th>
                  <th>ID</th>
                  <th>Sumber</th>
                  <th className={styles.hideOnMobile}>Tanggal</th>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Status</th>
                  <th className={styles.hideOnMobile} style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => {
                  const isExpanded = expandedId === order.id;
                  const isSelected = isSelectMode && selectedIds.has(order.id);
                  return (
                    <Fragment key={order.id}>
                      <tr
                        id={`order-row-${order.id}`}
                        className={`${isSelected ? styles.rowSelected : ''} ${isExpanded ? styles.rowExpanded : ''} ${highlightedId === order.id ? styles.rowHighlight : ''}`.trim()}
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      >
                        {isSelectMode && (
                          <td className={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
                            <AdminCheckbox
                              checked={isSelected}
                              onChange={() => toggleRowSelect(order.id)}
                              ariaLabel={`Pilih order ${order.id.slice(0, 8)}`}
                            />
                          </td>
                        )}
                        <td className={styles.tdIndex}>{index + 1}</td>
                        <td className={styles.tdId}>#{order.id.slice(0, 8)}</td>
                        <td>
                          <OrderSourceBadge order={order} showAccountSubtext />
                        </td>
                        <td className={styles.tdDate}>{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className={styles.tdCustomer}>
                          <div className={styles.tdCustomerName}>{order.name}</div>
                          <div className={styles.tdCustomerEmail}>
                            {order.orderSource === 'TIKTOK_LIVE' && order.tiktokUsername
                              ? `@${order.tiktokUsername}`
                              : order.telegramUsername
                                ? `@${order.telegramUsername}`
                                : order.email}
                          </div>
                        </td>
                        <td className={styles.tdTotal}>{formatIDR(order.total)}</td>
                        <td>
                          <span className={`${styles.badge} ${STATUS_BADGE_CLASS[order.status] || styles.badgeCancelled}`}>
                            {order.status === 'PROCESSING' && order.packingStatus === 'READY_FOR_PICKUP'
                              ? 'Menunggu Kurir'
                              : (STATUS_LABEL[order.status] || order.status)}
                          </span>
                        </td>
                        <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                          {PRINTABLE_STATUSES.has(order.status) && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handlePrintSingle(order)}
                              title="Cetak Resi Pengiriman"
                            >
                              Resi
                            </button>
                          )}
                          {isOrderTrackable(order) && (
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => openTrackingModal(order)}
                              title="Lacak Pengiriman"
                            >
                              Lacak
                            </button>
                          )}
                          <button className={styles.actionBtn} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                            {isExpanded ? 'Tutup' : 'Detail'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className={styles.expandRow}>
                          <td colSpan={isSelectMode ? 9 : 8}>
                            <div className={styles.expandGrid}>
                              <div className={styles.expandSection}>
                                <h5>Produk</h5>
                                {order.items.map((it) => (
                                  <div key={it.id} className={styles.itemRow}>
                                    <span>{it.customName || it.product?.name || 'Produk dihapus'} {it.selectedSize ? `(${it.selectedSize})` : ''} × {it.quantity}</span>
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
                                    {isOrderTrackable(order) && (
                                      <button
                                        type="button"
                                        className={styles.trackLinkBtn}
                                        onClick={() => openTrackingModal(order)}
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="1" y="3" width="15" height="13" rx="1" />
                                          <path d="M16 8h4l3 3v5h-7z" />
                                          <circle cx="5.5" cy="18.5" r="2.5" />
                                          <circle cx="18.5" cy="18.5" r="2.5" />
                                        </svg>
                                        Lacak Pesanan
                                      </button>
                                    )}
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
              {selectedIds.size} pesanan terpilih akan diubah statusnya. Aksi ini <b>admin override</b> —
              tidak memicu restock atau notifikasi.
            </div>
            <div className={styles.modalField}>
              <label htmlFor="bulk-status-select" className={styles.modalFieldLabel}>
                Status Tujuan
              </label>
              <OrderSelect
                id="bulk-status-select"
                value={statusModal.target}
                onChange={(nextTarget) => setStatusModal({ ...statusModal, target: nextTarget })}
                options={BULK_STATUS_OPTIONS}
                placeholder="Pilih status tujuan"
                ariaLabel="Pilih status tujuan"
                fullWidth
              />
            </div>
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

      {trackingModal.open && trackingModal.order && (
        <div className={styles.trackingModalBackdrop} onClick={closeTrackingModal}>
          <div className={styles.trackingModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.trackingModalHeader}>
              <div className={styles.trackingModalTitleGroup}>
                <h4 className={styles.trackingModalTitle}>
                  Lacak Pesanan #{trackingModal.order.id.slice(0, 8).toUpperCase()}
                </h4>
                <span className={styles.trackingModalSubtitle}>
                  Status: {STATUS_LABEL[trackingModal.order.status] || trackingModal.order.status} · Penerima: {trackingModal.order.name}
                </span>
              </div>
              <button
                type="button"
                className={styles.trackingModalCloseBtn}
                onClick={closeTrackingModal}
                aria-label="Tutup modal pelacakan"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.trackingModalBody}>
              <div className={styles.trackingMetaCard}>
                <div className={styles.trackingMetaGroup}>
                  <span className={styles.trackingMetaLabel}>Kurir & Layanan</span>
                  <span className={styles.trackingMetaValue}>
                    {(trackingModal.order.shippingCourier || 'Kurir').toUpperCase()} {trackingModal.order.shippingService ? `(${trackingModal.order.shippingService})` : ''}
                  </span>
                </div>
                <div className={styles.trackingMetaGroup}>
                  <span className={styles.trackingMetaLabel}>Nomor Resi (AWB)</span>
                  <div className={styles.trackingMetaValue}>
                    <span>{trackingModal.order.trackingNumber}</span>
                    <button
                      type="button"
                      className={styles.trackingCopyBtn}
                      onClick={() => handleCopyTrackingNumber(trackingModal.order.trackingNumber)}
                    >
                      {trackingModal.copied ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Tersalin
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Salin
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {trackingModal.loading ? (
                <div className={styles.trackingLoadingState}>
                  <div className={styles.trackingSpinner} />
                  <span>Menghubungkan ke sistem ekspedisi...</span>
                </div>
              ) : trackingModal.error ? (
                <div className={styles.trackingErrorState}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{trackingModal.error}</span>
                  <button
                    type="button"
                    className={styles.trackingRetryBtn}
                    onClick={() => openTrackingModal(trackingModal.order)}
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : (
                <ShipmentTracker
                  history={trackingModal.data?.history || []}
                  waybill={trackingModal.order.trackingNumber}
                  courier={trackingModal.order.shippingCourier}
                  plain={true}
                  hideHeader={true}
                  hideExternalLink={true}
                />
              )}
            </div>

            <div className={styles.trackingModalFooter}>
              <a
                href={getCourierTrackingUrl(trackingModal.order.shippingCourier, trackingModal.order.trackingNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.trackingExternalBtn}
                onClick={() => {
                  if (trackingModal.order.trackingNumber && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(trackingModal.order.trackingNumber).catch(() => {});
                  }
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Lacak Lengkap di Cekresi ({String(trackingModal.order.shippingCourier || 'Kurir').toUpperCase()})
              </a>
              <button
                type="button"
                className={styles.trackingCloseActionBtn}
                onClick={closeTrackingModal}
              >
                Tutup
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
