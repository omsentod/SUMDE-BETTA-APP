'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canUser, getFirstAccessibleAdminRoute } from '@/lib/permission-utils';
import OrderSourceBadge from '@/components/admin/OrderSourceBadge';
import AdminCheckbox from '@/components/admin/AdminCheckbox';
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

const iconPdf = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// Checkbox Aksesibel Khusus (Identik di seluruh modul admin)
const CartStyleCheckbox = AdminCheckbox;

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
  if (order?.tiktokAccountName) {
    const raw = order.tiktokAccountName.trim();
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => (p.startsWith('@') ? p : `@${p}`)).join(' + ');
    }
    if (parts.length === 1) {
      const p = parts[0];
      if (p.startsWith('@')) return p;
      const match = p.match(/Akun\s+Live\s+(\d+)/i);
      if (match) return `@sumdebetta.live${match[1]}`;
      return `@${p.toLowerCase().replace(/\s+/g, '.')}`;
    }
  }
  if (order?.tiktokLiveBasket?.tiktokAccount?.handle) {
    const h = order.tiktokLiveBasket.tiktokAccount.handle.trim();
    return h.startsWith('@') ? h : `@${h}`;
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
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('dateFilter') || 'all');

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
  const [counts, setCounts] = useState({ bagging: 0, boxing: 0, ready: 0, pendingTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Mode Seleksi Baris & Bulk Action
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  // Pop Up Modal Konfirmasi Pemunduran Pos / Tahapan Packing
  const [revertModal, setRevertModal] = useState({
    isOpen: false,
    orderIds: [],
    fromStage: '',
    isSingle: false,
    orderLabel: '',
    targetPosName: '',
    targetStatusLabel: '',
    warningNote: '',
  });

  const canAccess = canUser(currentUser, [
    'shipping:packing',
    'shipping:manage',
    'orders:view',
  ]);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login');
      } else if (!canAccess) {
        const fallback = getFirstAccessibleAdminRoute((p) => canUser(currentUser, p));
        router.push(fallback || '/customer/dashboard');
      }
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
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await loadOrders();
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [loadOrders]);

  // Listener keyboard Escape untuk menutup pop up modal konfirmasi pemunduran pos
  useEffect(() => {
    if (!revertModal.isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isBulkBusy) {
        setRevertModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revertModal.isOpen, isBulkBusy]);

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

  // Unduh / Cetak Lembar Manifest Packing PDF
  const handleDownloadPdf = () => {
    if (selectedIds.size === 0) {
      toast.warning('Pilih minimal satu pesanan untuk mencetak lembar manifest.');
      return;
    }

    let orderIdList = [];
    if (activeTab === 'bagging') {
      const selectedRows = baggingRows.filter((r) => selectedIds.has(r.id));
      const idSet = new Set();
      selectedRows.forEach((r) => {
        if (Array.isArray(r.orderIds)) {
          r.orderIds.forEach((id) => idSet.add(id));
        } else if (r.orderIds instanceof Set) {
          r.orderIds.forEach((id) => idSet.add(id));
        } else if (r.orderId) {
          idSet.add(r.orderId);
        }
      });
      orderIdList = Array.from(idSet);
    } else {
      orderIdList = Array.from(selectedIds);
    }

    if (orderIdList.length === 0) {
      toast.warning('Tidak ada pesanan valid yang terpilih untuk dicetak.');
      return;
    }

    const url = `/admin/packing/manifest?stage=${activeTab}&ids=${orderIdList.join(',')}&autoPrint=1`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Salin Nomor Resi 1-klik ke Clipboard
  const handleCopyWaybill = (waybill) => {
    if (!waybill) return;
    navigator.clipboard.writeText(waybill);
    toast.success(`Nomor resi ${waybill} disalin!`);
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

        // Petakan tiap item ikan secara terstruktur agar tersusun vertikal (anti-human-error, tanpa koma)
        const claimItems = (order.items || []).map((it) => ({
          id: it.id,
          name: it.customName || it.product?.name || 'Ikan Betta',
          quantity: it.quantity || 1,
          selectedSize: it.selectedSize,
          variantText: formatVariantLabel(it.selectedSize) || null,
          image:
            it.customImage ||
            it.variant?.imageUrl ||
            it.product?.image ||
            '/img/betta-1.png',
        }));

        rows.push({
          id: `claim_${order.id}`,
          type: 'claim',
          orderId: order.id,
          orderIds: [order.id],
          items: claimItems,
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
      const varLabel = formatVariantLabel(grp.selectedSize) || null;
      rows.push({
        id: grp.id,
        type: 'sample',
        name: grp.name,
        selectedSize: grp.selectedSize,
        variantText: varLabel,
        subtitle: `Pos Kolam / Rak • ${ids.length} paket`,
        originBadgeText: 'Kolam Sampel',
        originType: 'WEB',
        totalQty: grp.totalQty,
        orderIds: ids,
        image: grp.image,
        items: [
          {
            id: grp.id,
            name: grp.name,
            quantity: grp.totalQty,
            selectedSize: grp.selectedSize,
            variantText: varLabel,
            image: grp.image,
          },
        ],
        actionLabel: `Selesai (${grp.totalQty} Ekor)`,
      });
    });

    // Urutkan: sampel kolam dulu agar tim bungkus kolam efisien, lalu soliter live
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

  // Buka Pop Up Konfirmasi Pemunduran Pos Packing (Aksi Massal / Bulk)
  const openBulkRevertModal = () => {
    if (selectedIds.size === 0) return;

    if (activeTab === 'boxing') {
      setRevertModal({
        isOpen: true,
        orderIds: Array.from(selectedIds),
        fromStage: 'boxing',
        isSingle: false,
        orderLabel: `${selectedIds.size} pesanan terpilih`,
        targetPosName: 'Pos 1 (Bungkus Ikan)',
        targetStatusLabel: 'PENDING (Antrean Bungkus)',
        warningNote:
          'Status packing pesanan akan dimundurkan ke antrean awal. Ikan harus dikeluarkan/ditahan dari antrean meja kardus dan dicek ulang di kolam atau soliter.',
      });
    } else if (activeTab === 'ready') {
      setRevertModal({
        isOpen: true,
        orderIds: Array.from(selectedIds),
        fromStage: 'ready',
        isSingle: false,
        orderLabel: `${selectedIds.size} paket terpilih`,
        targetPosName: 'Pos 2 (Antrean Pack Box)',
        targetStatusLabel: 'BAGGED (Meja Kardus)',
        warningNote:
          'Paket ditarik dari rak siap jemput kurir ekspedisi. Status siap pickup dicabut, dan tim kardus perlu memeriksa fisik paket & mencocokkan ulang resi.',
      });
    }
  };

  // Buka Pop Up Konfirmasi Pemunduran Pos Packing (Aksi Individual per Baris Pesanan)
  const openSingleRevertModal = (order) => {
    const isReady = order.packingStatus === 'READY_FOR_PICKUP';
    const fromStage = isReady ? 'ready' : 'boxing';
    const targetPosName = isReady ? 'Pos 2 (Antrean Pack Box)' : 'Pos 1 (Bungkus Ikan)';
    const targetStatusLabel = isReady ? 'BAGGED (Meja Kardus)' : 'PENDING (Antrean Bungkus)';
    const warningNote = isReady
      ? 'Paket ditarik dari rak siap jemput kurir ekspedisi. Status siap pickup dicabut dan pesanan kembali ke meja antrean kardus.'
      : 'Ikan pesanan ini dikembalikan ke antrean bungkus plastik oksigen di kolam/soliter.';

    setRevertModal({
      isOpen: true,
      orderIds: [order.id],
      fromStage,
      isSingle: true,
      orderLabel: `Pesanan #${order.id.slice(0, 8).toUpperCase()} (${order.name})`,
      targetPosName,
      targetStatusLabel,
      warningNote,
    });
  };

  const closeRevertModal = () => {
    if (isBulkBusy) return;
    setRevertModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Eksekusi Pemunduran Pos Packing Setelah Dikonfirmasi via Pop Up Modal
  const handleExecuteRevert = async () => {
    if (!revertModal.orderIds || revertModal.orderIds.length === 0) return;
    setIsBulkBusy(true);

    try {
      const res = await fetch('/api/admin/packing/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'undo',
          fromStage: revertModal.fromStage,
          orderIds: revertModal.orderIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memindahkan pesanan ke pos sebelumnya.');

      toast.success(
        data.message ||
          `${revertModal.orderIds.length} pesanan berhasil dikembalikan ke ${revertModal.targetPosName}!`
      );

      // Reset pilihan jika aksi dilakukan dari mode seleksi bulk
      if (!revertModal.isSingle) {
        setSelectedIds(new Set());
      }

      setRevertModal((prev) => ({ ...prev, isOpen: false }));
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
            Manajemen alur bungkus plastik ikan, kemas box, dan scan resi fisik ekspedisi.
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
              {totalBaggingFish > 0 ? `(${totalBaggingFish} Ekor)` : 'Perlu Dibungkus'}
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
      </div>

      {/* 3. Strip Panduan Tahap Aktif (Clean Standalone Banner) */}
      <div className={styles.stageInfoBar}>
        <span
          className={`${styles.stageDot} ${
            activeTab === 'bagging'
              ? styles.stageDotBagging
              : activeTab === 'boxing'
              ? styles.stageDotBoxing
              : styles.stageDotReady
          }`.trim()}
        />
        <span className={styles.stageInfoText}>
          {activeTab === 'bagging'
            ? 'Tahap 1: Fokus bungkus plastik ikan per jenis & soliter live. ID pesanan diproses di Tahap 2 saat masuk kardus.'
            : activeTab === 'boxing'
            ? 'Tahap 2: Masukkan ikan yang sudah dibungkus ke dalam box, cocokkan item fisik dengan nomor resi.'
            : 'Tahap 3: Paket sudah dikemas rapi & resi di-scan, siap dijemput kurir ekspedisi.'}
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
                  onClick={openBulkRevertModal}
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
                  onClick={openBulkRevertModal}
                  disabled={isBulkBusy}
                  className={styles.bulkBtnWarning}
                  title="Kembalikan paket terpilih ke Pos 2 (Antrean Pack Box)"
                >
                  {iconUndo}
                  <span>{isBulkBusy ? 'Memproses...' : `Kembalikan ke Pos 2 (${selectedIds.size})`}</span>
                </button>
              </>
            )}

            {/* Tombol Cetak PDF yang Disesuaikan per Tahap */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className={styles.bulkBtnPdf}
              title={
                activeTab === 'bagging'
                  ? 'Cetak lembar daftar bungkus plastik ikan'
                  : activeTab === 'boxing'
                  ? 'Cetak daftar pack box & verifikasi resi (Packing List)'
                  : 'Cetak lembar manifest penjemputan kurir'
              }
            >
              {iconPdf}
              <span>
                {activeTab === 'bagging'
                  ? `Cetak Lembar Bungkus Ikan (${selectedIds.size})`
                  : activeTab === 'boxing'
                  ? `Cetak Daftar Pack Box (${selectedIds.size})`
                  : `Cetak Manifest Siap Kurir (${selectedIds.size})`}
              </span>
            </button>

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
                  <th className={styles.thIndex}>No.</th>
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
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdLoadingText}>
                      Memuat daftar ikan yang perlu dibungkus...
                    </td>
                  </tr>
                ) : baggingRows.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>{iconCheck}</div>
                        <h2 className={styles.emptyTitle}>Tidak Ada Ikan Menunggu Dibungkus</h2>
                        <p className={styles.emptyDesc}>
                          Semua ikan telah selesai dibungkus plastik oksigen.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  baggingRows.map((row, index) => {
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
                        <td className={styles.tdIndex}>{index + 1}</td>

                        {/* 1. Foto Ikan Thumbnail (Tersusun vertikal jika pesanan TikTok memiliki multi-item) */}
                        <td className={styles.tdFishThumb}>
                          {row.items && row.items.length > 1 ? (
                            <div className={styles.verticalThumbList}>
                              {row.items.map((it, i) => (
                                <div key={i} className={styles.verticalThumbItem}>
                                  {it.image ? (
                                    <Image
                                      src={it.image}
                                      alt={it.name}
                                      width={38}
                                      height={38}
                                      className={styles.fishThumbImg}
                                      unoptimized
                                    />
                                  ) : (
                                    <div className={styles.fishThumbPlaceholder}>{iconFish}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (row.items?.[0]?.image || row.image) ? (
                            <Image
                              src={row.items?.[0]?.image || row.image}
                              alt={row.items?.[0]?.name || row.name}
                              width={44}
                              height={44}
                              className={styles.fishThumbImg}
                              unoptimized
                            />
                          ) : (
                            <div className={styles.fishThumbPlaceholder}>{iconFish}</div>
                          )}
                        </td>

                        {/* 2. Nama Jenis Ikan Bersih (Tersusun vertikal per item tanpa koma) */}
                        <td>
                          <div className={styles.fishInfoCol}>
                            {row.items && row.items.length > 1 ? (
                              <div className={styles.verticalFishList}>
                                {row.items.map((it, i) => (
                                  <div key={i} className={styles.verticalFishRow}>
                                    <span className={styles.fishItemQty}>{it.quantity}x</span>
                                    <span className={styles.fishName}>{it.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className={styles.fishName}>
                                {row.items?.[0]?.quantity && row.type === 'claim' ? `${row.items[0].quantity}x ` : ''}
                                {row.items?.[0]?.name || row.name}
                              </span>
                            )}
                            <span className={styles.fishMetaText}>{row.subtitle}</span>
                          </div>
                        </td>

                        {/* 3. Kolom Khusus Varian (Tersusun vertikal berpasangan dengan nama ikan) */}
                        <td className={styles.tdVariant}>
                          {row.items && row.items.length > 1 ? (
                            <div className={styles.verticalVariantList}>
                              {row.items.map((it, i) => (
                                <div key={i} className={styles.verticalVariantRow}>
                                  {it.variantText ? (
                                    <span className={styles.variantBadge}>
                                      {it.variantText}
                                    </span>
                                  ) : (
                                    <span className={styles.variantPlain}>-</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : formatVariantLabel(row.items?.[0]?.variantText || row.selectedSize || row.variantText) ? (
                            <span className={styles.variantBadge}>
                              {formatVariantLabel(row.items?.[0]?.variantText || row.selectedSize || row.variantText)}
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
                            title="Selesai bungkus plastik"
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
                  <th className={styles.thIndex}>No.</th>
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
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdLoadingText}>
                      Memuat antrean packing...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={isSelectMode ? 8 : 7} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                          {activeTab === 'ready' ? iconCheck : iconBox}
                        </div>
                        <h2 className={styles.emptyTitle}>
                          {activeTab === 'boxing'
                            ? 'Tidak Ada Antrean Pack Box'
                            : 'Semua Paket Sudah Dijemput Kurir'}
                        </h2>
                        <p className={styles.emptyDesc}>
                          {activeTab === 'boxing'
                            ? 'Menunggu ikan selesai dibungkus dari Tahap 1.'
                            : 'Tidak ada paket menunggu di rak jemput. Seluruh paket telah berhasil diserahkan ke kurir ekspedisi.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => {
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
                          <td className={styles.tdIndex}>{index + 1}</td>

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
                            <td colSpan={isSelectMode ? 8 : 7} className={styles.tdZeroPadding}>
                              <div className={styles.expandContent}>
                                {order.orderSource === 'TIKTOK_LIVE' && (
                                  <div className={styles.orderSourceContextRow}>
                                    <span>Pos Akun Live: <strong>{resolveTikTokHost(order) || '-'}</strong></span>
                                    {order.tiktokUsername && (
                                      <span>Stiker Tangki Pembeli: <strong>@{order.tiktokUsername.replace(/^@+/, '')}</strong></span>
                                    )}
                                  </div>
                                )}

                                {/* Rincian Item Barang Pesanan (Untuk Kontrol & Verifikasi Visual Isi Box) */}
                                <div className={styles.itemsSection}>
                                  <h5 className={styles.itemsSectionTitle}>Rincian Isi Paket ({totalQty} item)</h5>
                                  <div className={styles.itemsList}>
                                    {order.items?.map((it, idx) => {
                                      const itemImg = it.customImage || it.variant?.imageUrl || it.product?.image;
                                      const variant = formatVariantLabel(it.selectedSize);

                                      return (
                                        <div key={it.id || idx} className={styles.itemRow}>
                                          <div className={styles.itemLeft}>
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
                                            <span className={styles.itemName}>
                                              {it.customName || it.product?.name || 'Ikan Betta Hias'}
                                            </span>
                                          </div>
                                          {variant && (
                                            <span className={styles.itemSize}>{variant}</span>
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
                                      <span>
                                        Nomor Resi: <strong>{order.trackingNumber}</strong>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyWaybill(order.trackingNumber)}
                                          className={styles.copyWaybillInlineBtn}
                                          title="Salin nomor resi ke clipboard"
                                        >
                                          {iconCopy}
                                          <span>Salin</span>
                                        </button>
                                      </span>
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
                                          onClick={() => openSingleRevertModal(order)}
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
                                        onClick={() => openSingleRevertModal(order)}
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

      {/* Pop Up Modal Konfirmasi Pemunduran Tahapan Packing */}
      {revertModal.isOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={closeRevertModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revert-modal-title"
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalIconWarning}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className={styles.modalHeaderText}>
                <h3 id="revert-modal-title" className={styles.modalTitle}>
                  Mundurkan ke {revertModal.targetPosName}?
                </h3>
                <p className={styles.modalSubtitle}>
                  {revertModal.orderLabel}
                </p>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalWarningCard}>
                <div className={styles.modalWarningTitle}>
                  Keterhubungan Status Pesanan:
                </div>
                <div className={styles.modalStatusChangeRow}>
                  <span className={styles.stageChipFrom}>
                    {revertModal.fromStage === 'ready'
                      ? 'Pos 3 (Siap Jemput)'
                      : 'Pos 2 (Pack Box)'}
                  </span>
                  <span className={styles.stageArrow}>➔</span>
                  <span className={styles.stageChipTo}>
                    {revertModal.targetPosName}
                  </span>
                </div>
                <p className={styles.modalWarningDesc}>
                  {revertModal.warningNote}
                </p>
              </div>

              <p className={styles.modalPromptText}>
                Apakah Anda yakin ingin memundurkan tahapan ini? Tindakan ini akan memperbarui status packing secara langsung di sistem.
              </p>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={closeRevertModal}
                disabled={isBulkBusy}
                className={styles.modalBtnCancel}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRevert}
                disabled={isBulkBusy}
                className={styles.modalBtnConfirm}
              >
                {isBulkBusy ? 'Memproses...' : 'Lanjut Kembalikan'}
              </button>
            </div>
          </div>
        </div>
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
