'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canUser } from '@/lib/permission-utils';
import OrderSourceBadge from '@/components/admin/OrderSourceBadge';
import CameraScannerModal from './CameraScannerModal';
import styles from './packing.module.css';

// Ikon SVG monokrom bersih tanpa dependensi luar
const iconCamera = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const iconFish = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" />
    <path d="M18 12v.5" />
    <path d="M16 17.93a11.94 11.94 0 0 1-3.5 1.57c-2.1.48-4.39-.02-6-1.5" />
    <path d="M2 16l4.5-4L2 8" />
  </svg>
);

const iconTag = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" />
  </svg>
);

const iconBox = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const iconTruck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const iconCheck = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const iconChevron = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const iconSearch = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const iconCalendar = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const iconRefresh = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const iconSelect = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const iconClose = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const iconCopy = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const iconUndo = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

// Checkbox Aksesibel Khusus (Identik dengan Checkbox Keranjang Customer)
function CartStyleCheckbox({ checked, onChange, ariaLabel, id, disabled }) {
  return (
    <label className={styles.checkboxWrapper} onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        id={id}
        checked={!!checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.checkboxInput}
        aria-label={ariaLabel}
      />
      <span className={styles.customCheckbox} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </label>
  );
}

// Format YYYY-MM-DD untuk input HTML date
const toDateInputValue = (d) => {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function resolveTikTokHost(order) {
  if (order?.tiktokLiveBasket?.tiktokAccount?.handle) {
    const h = order.tiktokLiveBasket.tiktokAccount.handle.trim();
    return h.startsWith('@') ? h : `@${h}`;
  }
  if (order?.tiktokAccountName) {
    const raw = order.tiktokAccountName.trim();
    if (raw.startsWith('@')) return raw;
    const match = raw.match(/Akun\s+Live\s+(\d+)/i);
    if (match) return `@sumdebetta.live${match[1]}`;
    return `@${raw.toLowerCase().replace(/\s+/g, '.')}`;
  }
  return null;
}

// Format varian bersih tanpa redundansi kata "Size"
function formatVariantLabel(variantStr) {
  if (!variantStr) return null;
  const raw = String(variantStr).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^size\s+/i, '').trim();
  return cleaned || raw;
}

// Format waktu ramah Indonesia (WIB)
function formatTimeIndo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  if (isToday) return `Hari ini, ${time}`;
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${time}`;
}

function PackingPageInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'bagging');
  // Default filter tanggal: khusus tab shipped default 'today' (real-time monitor pickup kurir hari ini)
  const [dateFilter, setDateFilter] = useState(() => {
    const initialTab = searchParams.get('tab') || 'bagging';
    return searchParams.get('dateFilter') || (initialTab === 'shipped' ? 'today' : 'all');
  });

  // State kalender custom (rentang tanggal pilihan)
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toDateInputValue(d);
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return toDateInputValue(new Date());
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ bagging: 0, boxing: 0, ready: 0, shipped: 0, shippedTotal: 0, pendingTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [checkedChecklist, setCheckedChecklist] = useState({});

  // Mode Seleksi Baris & Bulk Action
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  const canAccess = canUser(currentUser, [
    'shipping:packing',
    'shipping:manage',
    'orders:view',
  ]);

  useEffect(() => {
    if (!authLoading && (!currentUser || !canAccess)) {
      router.push('/admin/dashboard');
    }
  }, [currentUser, authLoading, canAccess, router]);

  const loadOrders = useCallback(async () => {
    if (!currentUser || !canAccess) return;
    try {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('dateFilter', dateFilter);

      if (dateFilter === 'custom') {
        if (customStartDate) params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      }

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/admin/packing?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Gagal memuat antrean packing.');
      }
      const data = await res.json();
      setOrders(data.orders || []);
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memuat data packing.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, dateFilter, customStartDate, customEndDate, searchQuery, currentUser, canAccess, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handler pergantian tab yang bersih dan bebas flicker
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setOrders([]); // Bersihkan data tab lama seketika untuk cegah flicker
    setIsLoading(true);
    setSelectedIds(new Set());
    setExpandedId(null);

    // Tutup kamera otomatis jika berpindah dari tab boxing
    if (newTab !== 'boxing') {
      setIsScannerOpen(false);
    }

    // Otomatis arahkan default filter tanggal saat beralih ke/dari tab pickup
    if (newTab === 'shipped') {
      setDateFilter('today');
    } else if (dateFilter === 'today' && activeTab === 'shipped') {
      setDateFilter('all');
    }
  };

  // Buka inline scanner kamera di atas tabel antrean pack box
  const handleOpenScanner = () => {
    setIsScannerOpen(true);
    setTimeout(() => {
      const el = document.getElementById('inline-barcode-scanner');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 120);
  };

  const handleScanSuccess = useCallback((result) => {
    if (result?.order) {
      toast.success(result.message || 'Paket berhasil di-scan & siap dijemput kurir.');
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    }
  }, [loadOrders, toast]);

  // Aksi: Selesai Bungkus Ikan Sampel (Bulk per jenis ikan dari kolam)
  const handleBulkBagging = async (orderIds, fishLabel) => {
    const key = Array.isArray(orderIds) ? orderIds.join('-') : orderIds;
    setActionLoadingId(key);
    try {
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, fishLabel, action: 'bag' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menandai ikan selesai dibungkus.');

      toast.success(data.message || 'Ikan selesai dibungkus plastik oksigen.');
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Aksi: Selesai Bungkus Ikan Tangki Khusus (TikTok / Telegram per soliter pembeli)
  const handleBaggingComplete = async (orderId, label) => {
    setActionLoadingId(orderId);
    try {
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: orderId, action: 'bag' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menandai ikan selesai dibungkus.');

      toast.success(data.message || `Ikan ${label || ''} selesai dibungkus plastik oksigen.`);
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Aksi: Selesai Pack Box & Tempel Resi (Tahap 2)
  const handleBoxingComplete = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: orderId, action: 'pack' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal konfirmasi selesai pack box.');

      toast.success(data.message || 'Paket siap dijemput kurir.');
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Aksi: Batalkan / Kembalikan ke Antrean Sebelumnya (Undo)
  const handleUndo = async (orderId) => {
    setActionLoadingId(orderId);
    try {
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: orderId, action: 'undo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengembalikan status packing.');

      toast.info(data.message || 'Status dikembalikan.');
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleItemCheck = (key) => {
    setCheckedChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Salin Nomor Resi 1-klik ke Clipboard
  const handleCopyWaybill = (waybill) => {
    if (!waybill) return;
    navigator.clipboard.writeText(waybill);
    toast.success(`Nomor resi ${waybill} disalin!`);
  };

  // Salin Format Rekap Pengiriman WhatsApp (Contextual Template sesuai aturan .agents)
  const handleCopyWhatsappTemplate = (order) => {
    const courier = (order.shippingCourier || 'Ekspedisi').toUpperCase();
    const waybill = order.trackingNumber || 'Sedang diproses';
    const recipient = order.name || 'Pelanggan';

    const text = `Halo Kak ${recipient},\n\nPesanan ikan cupang pilihan Anda di SUMDE BETTA (ID: #${order.id.slice(0, 8).toUpperCase()}) telah diserahkan ke kurir ${courier} dengan nomor resi:\n\n*${waybill}*\n\nPaket dikemas aman berstandar karantina dengan garansi 100% DOA (Death on Arrival). Anda dapat melacak posisi pengiriman berkala.\n\nTerima kasih atas kepercayaannya pada SUMDE BETTA. Salam satu hobi!`;

    navigator.clipboard.writeText(text);
    toast.success(`Format rekap WhatsApp untuk ${recipient} berhasil disalin!`);
  };

  // SATU TABEL TUNGGAL UNTUK TAHAP 1 (Bungkus Plastik Ikan)
  // Guard `if (activeTab !== 'bagging')` mencegah bug flash/flicker saat berpindah dari tab lain!
  const { baggingRows, totalBaggingFish } = useMemo(() => {
    if (activeTab !== 'bagging') {
      return { baggingRows: [], totalBaggingFish: 0 };
    }

    const sampleMap = new Map();
    const rows = [];
    let totalFish = 0;

    orders.forEach((order) => {
      if (order.packingStatus !== 'PENDING') return;

      const isClaim =
        order.orderSource === 'TIKTOK_LIVE' ||
        order.orderSource === 'TELEGRAM' ||
        Boolean(order.tiktokUsername) ||
        Boolean(order.telegramUsername);

      if (isClaim) {
        // Ikan tangki soliter claim (TikTok Live / Telegram)
        const totalQty = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
        totalFish += totalQty;

        const hostAccount = order.orderSource === 'TIKTOK_LIVE' ? resolveTikTokHost(order) : null;
        const buyerTag = order.tiktokUsername
          ? `@${order.tiktokUsername.replace(/^@+/, '')}`
          : order.telegramUsername
          ? `@${order.telegramUsername.replace(/^@+/, '')}`
          : order.name;

        const firstItem = order.items?.[0];
        const thumbImg =
          firstItem?.customImage ||
          firstItem?.variant?.imageUrl ||
          firstItem?.product?.image ||
          '/img/betta-1.png';

        // Nama ikan bersih tanpa ukuran
        const fishNames = (order.items || [])
          .map((it) => `${it.quantity || 1}x ${it.customName || it.product?.name || 'Ikan Betta'}`)
          .join(', ');

        // Kumpulkan varian untuk kolom khusus varian (bersih tanpa redundansi teks 'Size')
        const variantList = (order.items || [])
          .map((it) => formatVariantLabel(it.selectedSize))
          .filter(Boolean);
        const variantText = variantList.length > 0 ? Array.from(new Set(variantList)).join(', ') : null;

        rows.push({
          id: `claim_${order.id}`,
          type: 'claim',
          orderId: order.id,
          orderIds: [order.id],
          name: fishNames,
          variantText,
          subtitle: hostAccount
            ? `Pos: ${hostAccount}`
            : order.orderSource === 'TIKTOK_LIVE'
            ? 'TikTok Live'
            : 'Telegram Drop',
          hostAccount,
          buyerTag,
          originBadgeText: buyerTag,
          originType: order.orderSource,
          totalQty,
          image: thumbImg,
          actionLabel: `Selesai (${totalQty} Ekor)`,
        });
      } else {
        // Ikan sampel web
        order.items?.forEach((item) => {
          const qty = item.quantity || 1;
          totalFish += qty;
          const prodId = item.product?.id || item.productId || item.customName || 'sample';
          const size = item.selectedSize || '';
          const key = `sample_${prodId}__${size}`;

          if (!sampleMap.has(key)) {
            sampleMap.set(key, {
              id: key,
              type: 'sample',
              name: item.product?.name || item.customName || 'Ikan Cupang Sampel',
              selectedSize: size,
              image:
                item.product?.image ||
                item.customImage ||
                item.variant?.imageUrl ||
                '/img/betta-1.png',
              totalQty: 0,
              orderIds: new Set(),
            });
          }

          const grp = sampleMap.get(key);
          grp.totalQty += qty;
          grp.orderIds.add(order.id);
        });
      }
    });

    sampleMap.forEach((grp) => {
      const ids = Array.from(grp.orderIds);
      rows.push({
        id: grp.id,
        type: 'sample',
        name: grp.name,
        selectedSize: grp.selectedSize,
        variantText: formatVariantLabel(grp.selectedSize) || null,
        subtitle: `Pos Kolam / Rak • ${ids.length} paket`,
        originBadgeText: 'Kolam Sampel',
        originType: 'WEB',
        totalQty: grp.totalQty,
        orderIds: ids,
        image: grp.image,
        actionLabel: `Selesai (${grp.totalQty} Ekor)`,
      });
    });

    // Urutkan: sampel kolam dulu agar tim serok kolam efisien, lalu soliter live
    rows.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'sample' ? -1 : 1;
      return b.totalQty - a.totalQty;
    });

    return {
      baggingRows: rows,
      totalBaggingFish: totalFish,
    };
  }, [orders, activeTab]);

  // Logika Pemilihan Checkbox (Select All / Unselect All)
  const currentSelectableIds = useMemo(() => {
    if (activeTab === 'bagging') {
      return baggingRows.map((r) => r.id);
    }
    return orders.map((o) => o.id);
  }, [activeTab, baggingRows, orders]);

  const allSelected =
    currentSelectableIds.length > 0 &&
    currentSelectableIds.every((id) => selectedIds.has(id));

  const toggleSelectRow = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentSelectableIds));
    }
  };

  // Handler Aksi Massal (Bulk Action) sesuai Tab Aktif
  const handleBulkExecute = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkBusy(true);

    try {
      if (activeTab === 'bagging') {
        const targetOrderIds = new Set();
        baggingRows.forEach((r) => {
          if (selectedIds.has(r.id)) {
            r.orderIds?.forEach((id) => targetOrderIds.add(id));
          }
        });

        const idsArray = Array.from(targetOrderIds);
        if (idsArray.length === 0) return;

        const res = await fetch('/api/admin/packing/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bag', orderIds: idsArray }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memproses bulk bungkus plastik.');

        toast.success(data.message || `${idsArray.length} pesanan selesai dibungkus!`);
        setSelectedIds(new Set());
        loadOrders();
      } else if (activeTab === 'boxing') {
        const orderIds = Array.from(selectedIds);
        const res = await fetch('/api/admin/packing/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pack', orderIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memproses bulk pack box.');

        toast.success(data.message || `${orderIds.length} paket siap dijemput kurir!`);
        setSelectedIds(new Set());
        loadOrders();
      } else if (activeTab === 'ready') {
        const resiList = orders
          .filter((o) => selectedIds.has(o.id) && o.trackingNumber)
          .map((o) => `${o.trackingNumber} (${(o.shippingCourier || 'Kurir').toUpperCase()})`);

        if (resiList.length > 0) {
          navigator.clipboard.writeText(resiList.join('\n'));
          toast.success(`${resiList.length} nomor resi kurir berhasil disalin!`);
        } else {
          toast.warning('Tidak ada nomor resi yang tersedia pada paket terpilih.');
        }
      } else if (activeTab === 'shipped') {
        const resiList = orders
          .filter((o) => selectedIds.has(o.id) && o.trackingNumber)
          .map((o) => `${o.trackingNumber} - ${o.name} (${(o.shippingCourier || 'Kurir').toUpperCase()})`);

        if (resiList.length > 0) {
          navigator.clipboard.writeText(resiList.join('\n'));
          toast.success(`${resiList.length} rekap resi pickup berhasil disalin!`);
        } else {
          toast.warning('Tidak ada nomor resi pada paket terpilih.');
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  // Handler Aksi Massal: Kembalikan / Pindahkan ke Pos Sebelumnya
  const handleBulkRevert = async () => {
    if (selectedIds.size === 0) return;

    let targetPosName = 'Pos 1 (Bungkus Ikan)';
    if (activeTab === 'ready') targetPosName = 'Pos 2 (Antrean Pack Box)';
    if (activeTab === 'shipped') targetPosName = 'Pos 3 (Siap Pickup Kurir)';

    const confirmed = window.confirm(
      `Apakah Anda yakin ingin memindahkan ${selectedIds.size} pesanan terpilih ke ${targetPosName}?`
    );
    if (!confirmed) return;

    setIsBulkBusy(true);
    try {
      const orderIds = Array.from(selectedIds);
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo',
          fromStage: activeTab,
          orderIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memindahkan pesanan ke pos sebelumnya.');

      toast.success(data.message || `${orderIds.length} pesanan berhasil dikembalikan ke ${targetPosName}!`);
      setSelectedIds(new Set());
      loadOrders();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
      }
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat memindahkan pos pesanan.');
    } finally {
      setIsBulkBusy(false);
    }
  };

  // Helper render badge status yang akurat dan memprioritaskan status pengiriman riil
  const renderStatusBadge = (order) => {
    if (order.status === 'COMPLETED') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>
          {iconCheck}
          <span>Selesai / Diterima</span>
        </span>
      );
    }
    if (order.status === 'SHIPPED') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusShipped}`}>
          {iconTruck}
          <span>Sudah Pickup</span>
        </span>
      );
    }
    if (order.packingStatus === 'READY_FOR_PICKUP') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusReady}`}>
          {iconCheck}
          <span>Siap Pickup</span>
        </span>
      );
    }
    if (order.packingStatus === 'BAGGED') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBoxing}`}>
          Siap Pack Box
        </span>
      );
    }
    if (order.packingStatus === 'PENDING') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusBagging}`}>
          Perlu Dibungkus
        </span>
      );
    }
    if (order.status === 'PAID') {
      return (
        <span className={`${styles.statusBadge} ${styles.statusPaid}`}>
          Lunas
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.statusDefault}`}>
        {order.status}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      {/* 1. Header Halaman Standar Admin SUMDE-BETTA */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Packing Gudang &amp; Verifikasi Resi</h1>
          <p className={styles.subtitle}>
            Manajemen alur serok ikan, bungkus plastik, kemas box, dan scan resi fisik ekspedisi.
          </p>
        </div>
      </div>

      {/* 2. Kartu Tab Tahap Alur Kerja (Warna Solid Hex per Box, Saat Active SAMA SEMUA) */}
      <div className={styles.kpiStagesGrid}>
        {/* Tahap 1: Bungkus Plastik Ikan (Box Solid Amber) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardBagging} ${activeTab === 'bagging' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => handleTabChange('bagging')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiCardHeader}>
            <span className={styles.kpiStepBadge}>
              Tahap 1 &bull; Kolam &amp; Soliter
            </span>
            {activeTab === 'bagging' && (
              <span className={styles.activeIndicatorPill}>Dipilih</span>
            )}
          </div>
          <span className={styles.kpiTitle}>Bungkus Plastik Ikan</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>
              {counts.bagging}
            </span>
            <span className={styles.kpiUnit}>
              {totalBaggingFish > 0 ? `(${totalBaggingFish} Ekor)` : 'Perlu Serok'}
            </span>
          </div>
        </div>

        {/* Tahap 2: Pack Box & Resi (Box Solid Coral) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardBoxing} ${activeTab === 'boxing' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => handleTabChange('boxing')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiCardHeader}>
            <span className={styles.kpiStepBadge}>
              Tahap 2 &bull; Meja Box
            </span>
            {activeTab === 'boxing' && (
              <span className={styles.activeIndicatorPill}>Dipilih</span>
            )}
          </div>
          <span className={styles.kpiTitle}>Pack Box &amp; Resi</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>
              {counts.boxing}
            </span>
            <span className={styles.kpiUnit}>Siap Box</span>
          </div>
        </div>

        {/* Tahap 3: Menunggu Kurir (Box Solid Emerald) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardReady} ${activeTab === 'ready' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => handleTabChange('ready')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiCardHeader}>
            <span className={styles.kpiStepBadge}>
              Tahap 3 &bull; Rak Jemput
            </span>
            {activeTab === 'ready' && (
              <span className={styles.activeIndicatorPill}>Dipilih</span>
            )}
          </div>
          <span className={styles.kpiTitle}>Menunggu Kurir</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>
              {counts.ready}
            </span>
            <span className={styles.kpiUnit}>Siap Jemput</span>
          </div>
        </div>

        {/* Tahap 4: Pickup Kurir (Box Solid Blue) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardShipped} ${activeTab === 'shipped' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => handleTabChange('shipped')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiCardHeader}>
            <span className={styles.kpiStepBadge}>
              Tahap 4 &bull; Ekspedisi
            </span>
            {activeTab === 'shipped' && (
              <span className={styles.activeIndicatorPill}>Dipilih</span>
            )}
          </div>
          <span className={styles.kpiTitle}>Pickup Kurir</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>
              {counts.shipped}
            </span>
            <span className={styles.kpiUnit}>
              {dateFilter === 'today' ? 'Pickup Hari Ini' : 'Paket'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Strip Panduan Tahap Aktif (Clean Standalone Banner) */}
      <div className={styles.stageInfoBar}>
        <span
          className={`${styles.stageDot} ${
            activeTab === 'bagging'
              ? styles.stageDotBagging
              : activeTab === 'boxing'
              ? styles.stageDotBoxing
              : activeTab === 'ready'
              ? styles.stageDotReady
              : styles.stageDotShipped
          }`.trim()}
        />
        <span className={styles.stageInfoText}>
          {activeTab === 'bagging'
            ? 'Tahap 1: Fokus serok sampel per jenis & soliter live. ID pesanan diproses di Tahap 2 saat masuk kardus.'
            : activeTab === 'boxing'
            ? 'Tahap 2: Masukkan ikan yang sudah dibungkus ke dalam box, cocokkan item fisik dengan nomor resi.'
            : activeTab === 'ready'
            ? 'Tahap 3: Paket sudah dikemas rapi & resi di-scan, siap dijemput kurir ekspedisi.'
            : 'Tahap 4: Monitoring real-time paket yang telah di-pickup kurir ekspedisi.'}
        </span>
      </div>

      {/* 4. Baris Kontrol Bersih (Search, Presets Tanggal, Kalender Custom, & Actions) */}
      <div className={styles.controlBar}>
        <div className={styles.controlBarLeft}>
          <div className={styles.searchBox}>
            {iconSearch}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari penerima, resi, @username..."
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.controlBarRight}>
          {/* Preset Rentang Tanggal */}
          <div className={styles.dateFilterGroup} role="group" aria-label="Preset rentang tanggal">
            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`${styles.dateFilterBtn} ${dateFilter === 'today' ? styles.dateFilterBtnActive : ''}`.trim()}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`${styles.dateFilterBtn} ${dateFilter === 'yesterday' ? styles.dateFilterBtnActive : ''}`.trim()}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('7days')}
              className={`${styles.dateFilterBtn} ${dateFilter === '7days' ? styles.dateFilterBtnActive : ''}`.trim()}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('custom')}
              className={`${styles.dateFilterBtn} ${dateFilter === 'custom' ? styles.dateFilterBtnActive : ''}`.trim()}
              title="Pilih tanggal tertentu lewat kalender"
            >
              Custom
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`${styles.dateFilterBtn} ${dateFilter === 'all' ? styles.dateFilterBtnActive : ''}`.trim()}
            >
              Semua
            </button>
          </div>

          {/* Kalender Date-Picker Custom (Muncul saat opsi 'custom' aktif) */}
          {dateFilter === 'custom' && (
            <div className={styles.customDateRange} title="Pilih rentang tanggal dari kalender">
              {iconCalendar}
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.dateInput}
                aria-label="Tanggal mulai"
              />
              <span className={styles.dateSeparator}>–</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.dateInput}
                aria-label="Tanggal akhir"
              />
            </div>
          )}

          {/* Tombol Mode Pemilihan (Bulk Action) */}
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
            className={`${styles.controlBtn} ${isSelectMode ? styles.controlBtnActive : ''}`.trim()}
            title={isSelectMode ? 'Batalkan mode pemilihan' : 'Pilih beberapa baris untuk aksi massal'}
            aria-pressed={isSelectMode}
          >
            {isSelectMode ? iconClose : iconSelect}
            <span>{isSelectMode ? 'Selesai' : 'Pilih'}</span>
          </button>

          {/* Tombol Segarkan Data */}
          <button
            type="button"
            onClick={() => loadOrders()}
            className={styles.controlBtn}
            title="Muat ulang data antrean"
          >
            {iconRefresh}
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* 5. Sticky Bulk Action Bar */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkBarLeft}>
            <span className={styles.bulkBarCount}>
              {selectedIds.size} baris terpilih
            </span>
          </div>

          <div className={styles.bulkBarActions}>
            {activeTab === 'bagging' && (
              <button
                type="button"
                onClick={handleBulkExecute}
                disabled={isBulkBusy}
                className={styles.bulkBtnPrimary}
              >
                {iconCheck}
                <span>{isBulkBusy ? 'Memproses...' : `Tandai Selesai Dibungkus (${selectedIds.size})`}</span>
              </button>
            )}

            {activeTab === 'boxing' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkExecute}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnPrimary}
                >
                  {iconBox}
                  <span>{isBulkBusy ? 'Memproses...' : `Selesai Pack Box (${selectedIds.size})`}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkRevert}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnWarning}
                  title="Kembalikan pesanan terpilih ke Pos 1 (Bungkus Ikan)"
                >
                  {iconUndo}
                  <span>{isBulkBusy ? 'Memproses...' : `Kembalikan ke Pos 1 (${selectedIds.size})`}</span>
                </button>
              </>
            )}

            {activeTab === 'ready' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkExecute}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnOutline}
                >
                  {iconCopy}
                  <span>Salin No. Resi Terpilih ({selectedIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkRevert}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnWarning}
                  title="Kembalikan paket terpilih ke Pos 2 (Antrean Pack Box)"
                >
                  {iconUndo}
                  <span>{isBulkBusy ? 'Memproses...' : `Kembalikan ke Pos 2 (${selectedIds.size})`}</span>
                </button>
              </>
            )}

            {activeTab === 'shipped' && (
              <>
                <button
                  type="button"
                  onClick={handleBulkExecute}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnOutline}
                >
                  {iconCopy}
                  <span>Salin Rekap Resi Terpilih ({selectedIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkRevert}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnWarning}
                  title="Kembalikan paket terpilih ke Pos 3 (Siap Pickup Kurir)"
                >
                  {iconUndo}
                  <span>{isBulkBusy ? 'Memproses...' : `Kembalikan ke Pos 3 (${selectedIds.size})`}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className={styles.bulkBtnGhost}
            >
              Batalkan Pilihan
            </button>
          </div>
        </div>
      )}

      {/* 6. TAMPILAN TAHAP 1: SATU TABEL TUNGGAL (FOKUS IKAN + KOLOM VARIAN KHUSUS) */}
      {activeTab === 'bagging' && (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isSelectMode && (
                    <th className={styles.thCheckbox}>
                      <CartStyleCheckbox
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        ariaLabel="Pilih semua baris ikan"
                      />
                    </th>
                  )}
                  <th className={styles.thThumb}>Foto</th>
                  <th>Nama Ikan</th>
                  <th className={styles.thVariant}>Varian</th>
                  <th>Asal / Soliter</th>
                  <th className={styles.thQty}>Total Ekor</th>
                  <th className={styles.thAction}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={isSelectMode ? 7 : 6} className={styles.tdLoadingText}>
                      Memuat daftar ikan yang perlu dibungkus...
                    </td>
                  </tr>
                ) : baggingRows.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 7 : 6} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>{iconCheck}</div>
                        <h2 className={styles.emptyTitle}>Tidak Ada Ikan Menunggu Dibungkus</h2>
                        <p className={styles.emptyDesc}>
                          Semua ikan telah selesai diserok dan dibungkus plastik oksigen.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  baggingRows.map((row) => {
                    const isSelected = selectedIds.has(row.id);
                    const isActionLoading =
                      actionLoadingId === row.orderIds.join('-') ||
                      actionLoadingId === row.orderId;

                    return (
                      <tr
                        key={row.id}
                        className={isSelected ? styles.rowSelected : ''}
                      >
                        {isSelectMode && (
                          <td className={styles.tdCheckbox} onClick={(e) => e.stopPropagation()}>
                            <CartStyleCheckbox
                              checked={isSelected}
                              onChange={(e) => toggleSelectRow(row.id, e)}
                              ariaLabel={`Pilih ${row.name}`}
                            />
                          </td>
                        )}

                        {/* 1. Foto Ikan Thumbnail */}
                        <td className={styles.tdFishThumb}>
                          {row.image ? (
                            <Image
                              src={row.image}
                              alt={row.name}
                              width={44}
                              height={44}
                              className={styles.fishThumbImg}
                              unoptimized
                            />
                          ) : (
                            <div className={styles.fishThumbPlaceholder}>{iconFish}</div>
                          )}
                        </td>

                        {/* 2. Nama Jenis Ikan Bersih */}
                        <td>
                          <div className={styles.fishInfoCol}>
                            <span className={styles.fishName}>{row.name}</span>
                            <span className={styles.fishMetaText}>{row.subtitle}</span>
                          </div>
                        </td>

                        {/* 3. Kolom Khusus Varian (Murni nilai varian tanpa redundansi teks "Size") */}
                        <td className={styles.tdVariant}>
                          {formatVariantLabel(row.selectedSize || row.variantText) ? (
                            <span className={styles.variantBadge}>
                              {formatVariantLabel(row.selectedSize || row.variantText)}
                            </span>
                          ) : (
                            <span className={styles.variantPlain}>-</span>
                          )}
                        </td>

                        {/* 4. Lokasi Asal / Soliter */}
                        <td>
                          {row.type === 'sample' ? (
                            <span className={`${styles.tankLocationTag} ${styles.tankLocationWeb}`}>
                              {iconFish}
                              <span>Kolam Sampel</span>
                            </span>
                          ) : row.originType === 'TIKTOK_LIVE' ? (
                            <div className={styles.tankLocationCol}>
                              {row.hostAccount && (
                                <span className={`${styles.tankLocationTag} ${styles.tankLocationTikTokHost}`}>
                                  Pos: {row.hostAccount}
                                </span>
                              )}
                              <span className={styles.soliterBuyerTag}>
                                {iconTag}
                                <span>Tangki: <strong>{row.buyerTag}</strong></span>
                              </span>
                            </div>
                          ) : (
                            <div className={styles.tankLocationCol}>
                              <span className={`${styles.tankLocationTag} ${styles.tankLocationTelegram}`}>
                                Telegram Drop
                              </span>
                              <span className={styles.soliterBuyerTag}>
                                {iconTag}
                                <span>Tangki: <strong>{row.buyerTag}</strong></span>
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 5. Total Ekor */}
                        <td className={styles.fishQtyCell}>
                          <span className={styles.qtyBadgeAmber}>
                            {row.totalQty} Ekor
                          </span>
                        </td>

                        {/* 6. Tombol Selesai Bungkus */}
                        <td className={styles.fishActionCell}>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => {
                              if (row.type === 'sample') {
                                handleBulkBagging(row.orderIds, `${row.name} (${row.totalQty} ekor)`);
                              } else {
                                handleBaggingComplete(row.orderId, row.buyerTag);
                              }
                            }}
                            className={styles.btnBagDone}
                            title="Selesai serok dan bungkus plastik"
                          >
                            {iconCheck}
                            <span>
                              {isActionLoading ? 'Menyimpan...' : row.actionLabel}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. TAMPILAN TAHAP 2 & 3: MEJA PACK BOX & RAK KURIR DENGAN ROW-EXPAND */}
      {(activeTab === 'boxing' || activeTab === 'ready') && (
        <>
          {/* Inline Scanner Kamera Barcode (Hanya di Tahap 2: Pack Box & Resi) */}
          {activeTab === 'boxing' && isScannerOpen && (
            <div id="inline-barcode-scanner">
              <CameraScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
              />
            </div>
          )}

          <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isSelectMode && (
                    <th className={styles.thCheckbox}>
                      <CartStyleCheckbox
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        ariaLabel="Pilih semua pesanan"
                      />
                    </th>
                  )}
                  <th className={styles.thSourceId}>Sumber &amp; ID</th>
                  <th>Penerima &amp; Tujuan</th>
                  <th>Kurir &amp; Box</th>
                  <th>Rincian Ikan</th>
                  <th>Status</th>
                  <th className={styles.thExpand} aria-label="Aksi Buka" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={isSelectMode ? 7 : 6} className={styles.tdLoadingText}>
                      Memuat antrean packing...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 7 : 6} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                          {activeTab === 'ready' ? iconCheck : iconBox}
                        </div>
                        <h2 className={styles.emptyTitle}>
                          {activeTab === 'boxing'
                            ? 'Tidak Ada Antrean Pack Box'
                            : 'Tidak Ada Paket Menunggu Kurir'}
                        </h2>
                        <p className={styles.emptyDesc}>
                          {activeTab === 'boxing'
                            ? 'Menunggu ikan selesai dibungkus dari Tahap 1.'
                            : 'Belum ada paket yang siap dijemput kurir ekspedisi.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    const isExpanded = expandedId === order.id;
                    const totalQty = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
                    const hasLiveFish = order.items?.some((it) => {
                      if (it.product) {
                        return it.product.department?.isLiveFish !== false && !it.product.brand;
                      }
                      return true;
                    });

                    return (
                      <Fragment key={order.id}>
                        {/* Baris Utama Tabel Compact */}
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className={`${styles.clickableRow} ${isExpanded ? styles.rowExpanded : ''} ${isSelected ? styles.rowSelected : ''}`.trim()}
                        >
                          {isSelectMode && (
                            <td className={styles.tdCheckbox} onClick={(e) => e.stopPropagation()}>
                              <CartStyleCheckbox
                                checked={isSelected}
                                onChange={(e) => toggleSelectRow(order.id, e)}
                                ariaLabel={`Pilih pesanan ${order.id}`}
                              />
                            </td>
                          )}

                          <td>
                            <div className={styles.sourceIdCol}>
                              <div className={styles.sourceIdRow}>
                                <OrderSourceBadge order={order} />
                                <span className={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</span>
                              </div>
                              {order.orderSource === 'TIKTOK_LIVE' && resolveTikTokHost(order) && (
                                <span className={styles.hostAccountSubtext}>
                                  Pos: {resolveTikTokHost(order)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className={styles.customerCol}>
                              <span className={styles.customerName}>{order.name}</span>
                              <span className={styles.customerSub}>
                                {order.city ? `${order.city}, ${order.province}` : order.phone}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className={styles.courierBoxCol}>
                              <span className={styles.courierBadge}>
                                {order.shippingCourier || 'Ekspedisi'}
                              </span>
                              <span className={`${styles.boxTypeBadge} ${hasLiveFish ? styles.boxTypeStyro : styles.boxTypeCardboard}`}>
                                {hasLiveFish ? 'Styrofoam' : 'Kardus'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className={styles.customerCol}>
                              <span className={styles.fishSummaryQty}>
                                {totalQty} Item
                              </span>
                              <span className={styles.fishSummaryText}>
                                {order.items?.map((it) => it.customName || it.product?.name).filter(Boolean).join(', ')}
                              </span>
                            </div>
                          </td>

                          <td>
                            {renderStatusBadge(order)}
                          </td>

                          <td className={styles.expandTriggerCell}>
                            <span className={`${styles.chevronIcon} ${isExpanded ? styles.chevronIconRotated : ''}`.trim()}>
                              {iconChevron}
                            </span>
                          </td>
                        </tr>

                        {/* Baris Accordion Terbuka (Checklist Fisik & Resi Kurir) */}
                        {isExpanded && (
                          <tr className={styles.expandRow}>
                            <td colSpan={isSelectMode ? 7 : 6} className={styles.tdZeroPadding}>
                              <div className={styles.expandContent}>
                                {order.orderSource === 'TIKTOK_LIVE' && (
                                  <div className={styles.orderSourceContextRow}>
                                    <span>Pos Akun Live: <strong>{resolveTikTokHost(order) || '-'}</strong></span>
                                    {order.tiktokUsername && (
                                      <span>Stiker Tangki Pembeli: <strong>@{order.tiktokUsername.replace(/^@+/, '')}</strong></span>
                                    )}
                                  </div>
                                )}

                                {/* Checklist Item Barang Pesanan */}
                                <div className={styles.itemsSection}>
                                  <h5 className={styles.itemsSectionTitle}>Checklist Barang Pesanan ({totalQty} item)</h5>
                                  <div className={styles.itemsList}>
                                    {order.items?.map((it, idx) => {
                                      const checkKey = `${order.id}_${it.id || idx}`;
                                      const isChecked = Boolean(checkedChecklist[checkKey]);
                                      const itemImg = it.customImage || it.variant?.imageUrl || it.product?.image;

                                      return (
                                        <div
                                          key={it.id || idx}
                                          className={`${styles.itemRow} ${styles.checkLabelRow}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleItemCheck(checkKey);
                                          }}
                                        >
                                          <div className={styles.itemLeft}>
                                            <CartStyleCheckbox
                                              checked={isChecked}
                                              onChange={() => toggleItemCheck(checkKey)}
                                              ariaLabel={`Ceklis ${it.customName || it.product?.name || 'Item'}`}
                                            />
                                            {itemImg && (
                                              <Image
                                                src={itemImg}
                                                alt={it.customName || it.product?.name || 'Item'}
                                                width={32}
                                                height={32}
                                                className={styles.itemThumbImg}
                                                unoptimized
                                              />
                                            )}
                                            <span className={styles.itemQty}>{it.quantity}x</span>
                                            <span className={`${styles.itemName} ${isChecked ? styles.itemNameChecked : ''}`.trim()}>
                                              {it.customName || it.product?.name || 'Ikan Betta Hias'}
                                            </span>
                                          </div>
                                          {it.selectedSize && (
                                            <span className={styles.itemSize}>{formatVariantLabel(it.selectedSize)}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Footer Aksi & Informasi Resi */}
                                <div className={styles.expandFooter} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.historyInfoGroup}>
                                    {order.baggedAt && (
                                      <span>
                                        Dibungkus: {formatTimeIndo(order.baggedAt)} ({order.baggedBy || 'Tim Kolam'})
                                      </span>
                                    )}
                                    {order.packedAt && (
                                      <span>
                                        Selesai Box: {formatTimeIndo(order.packedAt)} ({order.packedBy || 'Tim Box'})
                                      </span>
                                    )}
                                    {order.trackingNumber && (
                                      <span>Nomor Resi: <strong>{order.trackingNumber}</strong></span>
                                    )}
                                  </div>

                                  <div className={styles.actionButtonGroup}>
                                    {order.packingStatus === 'BAGGED' && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={actionLoadingId === order.id}
                                          onClick={() => handleBoxingComplete(order.id)}
                                          className={styles.btnPrimary}
                                        >
                                          {iconBox}
                                          <span>
                                            {actionLoadingId === order.id ? 'Menyimpan...' : 'Selesai Pack Box'}
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={actionLoadingId === order.id}
                                          onClick={() => handleUndo(order.id)}
                                          className={styles.btnGhost}
                                          title="Kembalikan ke antrean bungkus"
                                        >
                                          Batal Bungkus
                                        </button>
                                      </>
                                    )}

                                    {order.packingStatus === 'READY_FOR_PICKUP' && (
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === order.id}
                                        onClick={() => handleUndo(order.id)}
                                        className={styles.btnGhost}
                                        title="Kembalikan ke antrean pack box"
                                      >
                                        Batal Pack Box
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}

      {/* 8. TAMPILAN TAHAP 4: TABEL KHUSUS PICKUP KURIR / RIWAYAT EKSPEDISI */}
      {activeTab === 'shipped' && (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isSelectMode && (
                    <th className={styles.thCheckbox}>
                      <CartStyleCheckbox
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        ariaLabel="Pilih semua pesanan pickup"
                      />
                    </th>
                  )}
                  <th className={styles.thWaybill}>No. Resi &amp; Ekspedisi</th>
                  <th>Sumber &amp; ID</th>
                  <th>Penerima &amp; Tujuan</th>
                  <th>Waktu Pickup</th>
                  <th>Rincian Paket</th>
                  <th>Status Ekspedisi</th>
                  <th className={styles.thAction}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdLoadingText}>
                      Memuat riwayat pickup kurir...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>{iconTruck}</div>
                        <h2 className={styles.emptyTitle}>
                          {dateFilter === 'today'
                            ? 'Belum Ada Paket Pickup Hari Ini'
                            : 'Tidak Ada Riwayat Pickup'}
                        </h2>
                        <p className={styles.emptyDesc}>
                          {dateFilter === 'today'
                            ? 'Paket yang diserahkan dan di-scan oleh kurir ekspedisi hari ini akan otomatis muncul di sini.'
                            : 'Coba ubah rentang filter tanggal atau gunakan kalender untuk melihat arsip sebelumnya.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    const totalQty = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
                    const hasLiveFish = order.items?.some((it) => {
                      if (it.product) {
                        return it.product.department?.isLiveFish !== false && !it.product.brand;
                      }
                      return true;
                    });

                    return (
                      <tr
                        key={order.id}
                        className={isSelected ? styles.rowSelected : ''}
                      >
                        {isSelectMode && (
                          <td className={styles.tdCheckbox} onClick={(e) => e.stopPropagation()}>
                            <CartStyleCheckbox
                              checked={isSelected}
                              onChange={(e) => toggleSelectRow(order.id, e)}
                              ariaLabel={`Pilih pesanan ${order.id}`}
                            />
                          </td>
                        )}

                        {/* 1. Nomor Resi & Kurir dengan One-Click Copy */}
                        <td>
                          <div className={styles.tdWaybillCol}>
                            <div className={styles.waybillRow}>
                              <span className={styles.waybillCode}>
                                {order.trackingNumber || 'Belum Ada AWB'}
                              </span>
                              {order.trackingNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyWaybill(order.trackingNumber)}
                                  className={styles.copyIconBtn}
                                  title="Salin nomor resi"
                                  aria-label="Salin nomor resi"
                                >
                                  {iconCopy}
                                </button>
                              )}
                            </div>
                            <div className={styles.courierServiceRow}>
                              <span className={styles.courierNameBadge}>
                                {order.shippingCourier || 'Ekspedisi'}
                              </span>
                              {order.shippingService && (
                                <span className={styles.courierServiceText}>
                                  {order.shippingService}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Sumber & ID Pesanan */}
                        <td>
                          <div className={styles.sourceIdCol}>
                            <div className={styles.sourceIdRow}>
                              <OrderSourceBadge order={order} />
                              <span className={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</span>
                            </div>
                            {order.orderSource === 'TIKTOK_LIVE' && resolveTikTokHost(order) && (
                              <span className={styles.hostAccountSubtext}>
                                Pos: {resolveTikTokHost(order)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Penerima & Tujuan */}
                        <td>
                          <div className={styles.customerCol}>
                            <span className={styles.customerName}>{order.name}</span>
                            <span className={styles.customerSub}>
                              {order.city ? `${order.city}, ${order.province}` : order.phone}
                            </span>
                          </div>
                        </td>

                        {/* 4. Waktu Pickup Kurir */}
                        <td>
                          <div className={styles.pickupTimeCol}>
                            <span className={styles.pickupTimePrimary}>
                              {formatTimeIndo(order.updatedAt || order.packedAt)}
                            </span>
                            {order.packedBy && (
                              <span className={styles.pickupTimeSub}>
                                Oleh: {order.packedBy}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Rincian Paket */}
                        <td>
                          <div className={styles.packageSummaryCol}>
                            <div className={styles.packageSummaryTop}>
                              <span className={`${styles.boxTypeBadge} ${hasLiveFish ? styles.boxTypeStyro : styles.boxTypeCardboard}`}>
                                {hasLiveFish ? 'Styrofoam' : 'Kardus'}
                              </span>
                              <span className={styles.fishSummaryQty}>
                                {totalQty} Item
                              </span>
                            </div>
                            <span className={styles.packageItemsPreview}>
                              {order.items?.map((it) => it.customName || it.product?.name).filter(Boolean).join(', ')}
                            </span>
                          </div>
                        </td>

                        {/* 6. Status Pengiriman Ekspedisi */}
                        <td>
                          {renderStatusBadge(order)}
                        </td>

                        {/* 7. Aksi Cepat (Salin Rekap WA) */}
                        <td>
                          <div className={styles.pickupActionCol}>
                            <button
                              type="button"
                              onClick={() => handleCopyWhatsappTemplate(order)}
                              className={styles.btnActionSm}
                              title="Salin rekap pesan konfirmasi untuk dikirimkan ke pelanggan via WhatsApp"
                            >
                              {iconCopy}
                              <span>Salin Rekap</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) Scanner Kamera Smartphone (Hanya tampil di Tahap 2 saat scanner sedang ditutup) */}
      {activeTab === 'boxing' && !isScannerOpen && (
        <button
          type="button"
          onClick={handleOpenScanner}
          className={styles.floatingScannerBtn}
          aria-label="Buka scanner barcode kamera"
        >
          {iconCamera}
          <span>Scan Resi Fisik</span>
        </button>
      )}
    </div>
  );
}

export default function PackingPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.pageFallback}>
          Memuat modul packing...
        </div>
      }
    >
      <PackingPageInner />
    </Suspense>
  );
}
