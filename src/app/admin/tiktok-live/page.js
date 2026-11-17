'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canUser, getFirstAccessibleAdminRoute } from '@/lib/permission-utils';
import AccountsModal from './AccountsModal';
import AddDealModal from './AddDealModal';
import LiveSelect from './LiveSelect';
import {
  formatWhatsAppDisplay,
  normalizeWhatsAppNumber,
  buildBuyerCheckoutMessage,
  buildBuyerWhatsAppUrl,
} from '@/lib/tiktokLive';
import styles from './tiktokLive.module.css';

const STORAGE_ACCOUNT_KEY = 'sumde_tiktok_live_account_id';

const iconStatusFilter = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
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

const iconChannel = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const iconWhatsApp = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const iconReset = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

// Memformat angka string mentah menjadi format ribuan dengan titik (misal 100000 -> 100.000, mulai 1.000)
function formatThousands(val) {
  if (val === null || val === undefined || val === '') return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Mengambil nilai angka integer murni dari string berformat ribuan
function parseThousands(val) {
  if (val === null || val === undefined || val === '') return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? Number(clean) : 0;
}

function formatShortTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEffectiveStatus(basket) {
  if (basket.status === 'OPEN') return 'OPEN';
  if (basket.order?.status) return basket.order.status;
  if (basket.status === 'CHECKED_OUT') return 'PENDING';
  return basket.status || 'OPEN';
}

function getBasketAccounts(basket) {
  if (!basket) return [];
  const map = new Map();
  if (basket.tiktokAccount) {
    const key = basket.tiktokAccount.id || basket.tiktokAccount.handle || 'primary';
    map.set(key, basket.tiktokAccount);
  }
  (basket.items || []).forEach((it) => {
    if (it.tiktokAccount) {
      const key = it.tiktokAccount.id || it.tiktokAccount.handle || `item-${it.id}`;
      map.set(key, it.tiktokAccount);
    }
  });
  return Array.from(map.values());
}

function getStatusBadge(effectiveStatus) {
  switch (effectiveStatus) {
    case 'OPEN':
      return { label: 'Keep Aktif', className: styles.badgeOpen };
    case 'PENDING':
      return { label: 'Menunggu Bayar', className: styles.badgePending };
    case 'PAID':
      return { label: 'Lunas', className: styles.badgePaid };
    case 'PROCESSING':
      return { label: 'Diproses', className: styles.badgeDone };
    case 'SHIPPED':
      return { label: 'Dikirim', className: styles.badgeDone };
    case 'COMPLETED':
      return { label: 'Selesai', className: styles.badgePaid };
    case 'CANCELLED':
    case 'EXPIRED':
      return { label: effectiveStatus === 'CANCELLED' ? 'Dibatalkan' : 'Kedaluwarsa', className: styles.badgeMuted };
    default:
      return { label: effectiveStatus, className: styles.badgeMuted };
  }
}

function toLocalDateStr(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = monthNames[monthIdx] || m;
  return `${parseInt(d, 10)} ${monthName}`;
}

function formatReadableDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = monthNames[monthIdx] || m;
  return `${parseInt(d, 10)} ${monthName} ${y}`;
}

function getEmptyCopy(statusFilter, hasSearchOrAccount, waFilter, dateFilter) {
  if (waFilter === 'UNSENT') {
    return {
      title: 'Semua pembeli sudah dikirimi WA',
      desc: 'Bagus! Tidak ada pembeli aktif yang terlewat untuk dikirimi link checkout.',
    };
  }
  if (hasSearchOrAccount || (dateFilter && dateFilter !== 'ALL')) {
    return {
      title: 'Tidak ada data yang cocok',
      desc: 'Coba ubah kata kunci pencarian, filter akun TikTok, status, atau rentang tanggal.',
    };
  }
  switch (statusFilter) {
    case 'OPEN':
      return {
        title: 'Belum ada keep aktif saat ini',
        desc: 'Klik "+ Input Deal Live" untuk mencatat ikan yang baru deal di sesi live streaming.',
      };
    case 'PENDING':
      return {
        title: 'Tidak ada pesanan yang menunggu pembayaran',
        desc: 'Pesanan akan muncul di sini setelah pembeli checkout melalui halaman /live.',
      };
    case 'PAID':
      return {
        title: 'Belum ada order live yang lunas',
        desc: 'Pesanan yang sudah dibayar via DOKU otomatis masuk ke tab ini dan halaman Pesanan.',
      };
    default:
      return {
        title: 'Belum ada data transaksi TikTok Live',
        desc: 'Catat deal pembeli saat live berlangsung dengan tombol "+ Input Deal Live".',
      };
  }
}

export default function AdminTikTokLivePage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canView = canUser(currentUser, ['events:tiktok', 'events:view', 'events:manage', 'orders:view', 'orders:manage', 'products:view']);

  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      const fallback = getFirstAccessibleAdminRoute((p) => canUser(currentUser, p)) || '/customer/dashboard';
      router.push(fallback);
    }
  }, [currentUser, authLoading, canView, router]);

  const [accounts, setAccounts] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [baskets, setBaskets] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Persisted Akun TikTok untuk form input deal (tidak reset saat submit)
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Table filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toLocalDateStr(d);
  });
  const [customEndDate, setCustomEndDate] = useState(() => toLocalDateStr(new Date()));
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toLocalDateStr(d);
  });
  const [draftEndDate, setDraftEndDate] = useState(() => toLocalDateStr(new Date()));
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [waFilter, setWaFilter] = useState('ALL'); // 'ALL' | 'UNSENT'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBasketId, setExpandedBasketId] = useState(null);

  // Modals
  const [dealModalState, setDealModalState] = useState({ open: false, initialUsername: '' });
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [waModal, setWaModal] = useState({
    open: false,
    basket: null,
    phoneInput: '',
    error: '',
    submitting: false,
    autoOpenWa: false,
  });

  // Inline item editor inside expanded row
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemDraft, setEditItemDraft] = useState({ name: '', price: '', quantity: '1', note: '' });
  const [savingItem, setSavingItem] = useState(false);

  const handlePersistAccount = useCallback((nextId) => {
    setSelectedAccountId(nextId);
    try {
      if (nextId) {
        window.localStorage.setItem(STORAGE_ACCOUNT_KEY, nextId);
      } else {
        window.localStorage.removeItem(STORAGE_ACCOUNT_KEY);
      }
    } catch {
      // Ignore storage restriction
    }
  }, []);

  const loadData = useCallback(async (withSpinner = false) => {
    if (withSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/tiktok-live', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data TikTok Live');

      const nextAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(nextAccounts);
      setTeamUsers(Array.isArray(data.teamUsers) ? data.teamUsers : []);
      setBaskets(Array.isArray(data.baskets) ? data.baskets : []);
      setCatalogProducts(Array.isArray(data.catalogProducts) ? data.catalogProducts : []);

      setSelectedAccountId((prev) => {
        if (prev && nextAccounts.some((a) => a.id === prev)) return prev;
        try {
          const saved = window.localStorage.getItem(STORAGE_ACCOUNT_KEY);
          if (saved && nextAccounts.some((a) => a.id === saved)) return saved;
        } catch {
          // Ignore storage error
        }
        const firstActive = nextAccounts.find((a) => a.isActive) || nextAccounts[0];
        return firstActive?.id || '';
      });
    } catch (err) {
      toastRef.current.error(err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser || !canView) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) loadData(false);
    }, 0);
    const poll = setInterval(() => {
      if (active) loadData(false);
    }, 30000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [authLoading, currentUser, canView, loadData]);

  const dateFilteredBaskets = useMemo(() => {
    if (dateFilter === 'ALL') return baskets;
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    return baskets.filter((b) => {
      const bDateStr = toLocalDateStr(b.createdAt || b.updatedAt);
      if (!bDateStr) return false;

      if (dateFilter === 'TODAY') {
        return bDateStr === todayStr;
      }
      if (dateFilter === 'YESTERDAY') {
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return bDateStr === toLocalDateStr(yesterday);
      }
      if (dateFilter === '7DAYS') {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        const startStr = toLocalDateStr(sevenDaysAgo);
        return bDateStr >= startStr && bDateStr <= todayStr;
      }
      if (dateFilter === '30DAYS') {
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        const startStr = toLocalDateStr(thirtyDaysAgo);
        return bDateStr >= startStr && bDateStr <= todayStr;
      }
      if (dateFilter === 'CUSTOM') {
        let start = customStartDate;
        let end = customEndDate;
        if (start && end && start > end) [start, end] = [end, start];
        if (start && bDateStr < start) return false;
        if (end && bDateStr > end) return false;
        return true;
      }
      return true;
    });
  }, [baskets, dateFilter, customStartDate, customEndDate]);

  const tabCounts = useMemo(() => {
    const counts = { ALL: dateFilteredBaskets.length, OPEN: 0, PENDING: 0, PAID: 0 };
    for (const b of dateFilteredBaskets) {
      const eff = getEffectiveStatus(b);
      if (eff === 'OPEN') counts.OPEN += 1;
      else if (eff === 'PENDING') counts.PENDING += 1;
      else if (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(eff)) counts.PAID += 1;
    }
    return counts;
  }, [dateFilteredBaskets]);

  const waCounts = useMemo(() => {
    let unsent = 0;
    let sent = 0;
    for (const b of dateFilteredBaskets) {
      const eff = getEffectiveStatus(b);
      if (eff === 'OPEN' || eff === 'PENDING') {
        if (b.waSentAt) {
          sent += 1;
        } else {
          unsent += 1;
        }
      }
    }
    return { unsent, sent };
  }, [dateFilteredBaskets]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: `Semua Status (${tabCounts.ALL})` },
      { value: 'OPEN', label: `Keep Aktif (${tabCounts.OPEN})` },
      { value: 'PENDING', label: `Menunggu Bayar (${tabCounts.PENDING})` },
      { value: 'PAID', label: `Lunas / Selesai (${tabCounts.PAID})` },
    ],
    [tabCounts],
  );

  const customDatePreview = useMemo(() => {
    let s = draftStartDate;
    let e = draftEndDate;
    if (!s && !e) return 'Pilih tanggal mulai dan tanggal selesai';
    if (!s) return `Hingga ${formatReadableDate(e)}`;
    if (!e) return `Mulai ${formatReadableDate(s)}`;
    if (s > e) [s, e] = [e, s];
    if (s === e) {
      return `Menampilkan transaksi 1 hari: ${formatReadableDate(s)}`;
    }
    const d1 = new Date(s);
    const d2 = new Date(e);
    const days = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    return `Menampilkan transaksi: ${formatReadableDate(s)} – ${formatReadableDate(e)} (${days} hari)`;
  }, [draftStartDate, draftEndDate]);

  const handleDateFilterChange = useCallback((val) => {
    if (val === 'CUSTOM') {
      setDraftStartDate(customStartDate || toLocalDateStr(new Date()));
      setDraftEndDate(customEndDate || toLocalDateStr(new Date()));
      setShowCustomDateModal(true);
      return;
    }
    setDateFilter(val);
  }, [customStartDate, customEndDate]);

  const applyDatePreset = useCallback((key) => {
    const now = new Date();
    const todayStr = toLocalDateStr(now);

    if (key === 'today') {
      setDraftStartDate(todayStr);
      setDraftEndDate(todayStr);
    } else if (key === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yStr = toLocalDateStr(y);
      setDraftStartDate(yStr);
      setDraftEndDate(yStr);
    } else if (key === '7d') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setDraftStartDate(toLocalDateStr(past));
      setDraftEndDate(todayStr);
    } else if (key === '30d') {
      const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setDraftStartDate(toLocalDateStr(past));
      setDraftEndDate(todayStr);
    } else if (key === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDraftStartDate(toLocalDateStr(firstDay));
      setDraftEndDate(todayStr);
    }
  }, []);

  const handleApplyCustomDate = useCallback(() => {
    let s = draftStartDate;
    let e = draftEndDate;
    if (!s && !e) {
      toast.warning('Silakan tentukan tanggal');
      return;
    }
    if (!s) s = e;
    if (!e) e = s;
    if (s > e) [s, e] = [e, s];

    setCustomStartDate(s);
    setCustomEndDate(e);
    setDateFilter('CUSTOM');
    setShowCustomDateModal(false);

    const summary = s === e ? formatReadableDate(s) : `${formatShortDate(s)} – ${formatShortDate(e)}`;
    toast.success(`Filter rentang tanggal aktif: ${summary}`);
  }, [draftStartDate, draftEndDate, toast]);

  const dateFilterOptions = useMemo(() => {
    let customLabel = 'Pilih Tanggal';
    let s = customStartDate;
    let e = customEndDate;
    if (s && e && s > e) [s, e] = [e, s];

    if (s && e) {
      if (s === e) {
        customLabel = formatReadableDate(s);
      } else {
        customLabel = `${formatShortDate(s)} – ${formatShortDate(e)}`;
      }
    } else if (s) {
      customLabel = `Mulai ${formatShortDate(s)}`;
    } else if (e) {
      customLabel = `Sampai ${formatShortDate(e)}`;
    }

    return [
      { value: 'ALL', label: 'Semua Tanggal' },
      { value: 'TODAY', label: 'Hari Ini' },
      { value: 'YESTERDAY', label: 'Kemarin' },
      { value: '7DAYS', label: '7 Hari Terakhir' },
      { value: '30DAYS', label: '30 Hari Terakhir' },
      {
        value: 'CUSTOM',
        label: dateFilter === 'CUSTOM' ? `Kustom: ${customLabel}` : 'Kustom Tanggal...',
        sublabel: dateFilter === 'CUSTOM' ? 'Klik untuk mengubah rentang tanggal' : 'Pilih rentang tanggal kustom',
      },
    ];
  }, [dateFilter, customStartDate, customEndDate]);

  const filteredBaskets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    return dateFilteredBaskets.filter((b) => {
      const eff = getEffectiveStatus(b);
      if (statusFilter === 'OPEN' && eff !== 'OPEN') return false;
      if (statusFilter === 'PENDING' && eff !== 'PENDING') return false;
      if (statusFilter === 'PAID' && !['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(eff)) {
        return false;
      }
      if (accountFilter !== 'ALL') {
        const matchesBasketAccount = b.tiktokAccountId === accountFilter;
        const matchesItemAccount = (b.items || []).some((it) => it.tiktokAccount?.id === accountFilter);
        if (!matchesBasketAccount && !matchesItemAccount) return false;
      }
      if (waFilter === 'UNSENT') {
        if (b.waSentAt) return false;
      }
      if (q) {
        const inUser = (b.tiktokUsername || '').toLowerCase().includes(q);
        const inCode = (b.claimCode || '').toLowerCase().includes(q);
        const inOrder = (b.order?.id || '').toLowerCase().includes(q);
        const inWa = (b.whatsappNumber || '').toLowerCase().includes(q);
        const inItem = (b.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
        if (!inUser && !inCode && !inOrder && !inWa && !inItem) return false;
      }
      return true;
    });
  }, [dateFilteredBaskets, statusFilter, accountFilter, waFilter, searchQuery]);

  const handleCopyBuyerLink = async (basket) => {
    if (!basket?.claimToken) {
      toast.warning('Token link belum tersedia, coba segarkan data');
      return;
    }
    const url = `${window.location.origin}/live/${basket.claimToken}`;
    const dmText = buildBuyerCheckoutMessage({
      basket,
      appOrigin: window.location.origin,
    });

    try {
      await navigator.clipboard.writeText(dmText);
      toast.success(`Format pesan DM untuk @${basket.tiktokUsername} disalin ke clipboard`);
    } catch {
      toast.info(`Link live @${basket.tiktokUsername}: ${url}`);
    }
  };

  const openWhatsAppModal = (basket, autoOpen = false) => {
    setWaModal({
      open: true,
      basket,
      phoneInput: basket.whatsappNumber || '',
      error: '',
      submitting: false,
      autoOpenWa: autoOpen,
    });
  };

  const handleSendWhatsApp = async (basket) => {
    if (!basket?.claimToken) {
      toast.warning('Token link belum tersedia, coba segarkan data');
      return;
    }
    if (!basket.whatsappNumber) {
      openWhatsAppModal(basket, true);
      return;
    }
    const waUrl = buildBuyerWhatsAppUrl({
      basket,
      appOrigin: window.location.origin,
    });
    if (!waUrl) {
      toast.error('Nomor WhatsApp tidak valid. Silakan periksa kembali.');
      return;
    }
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Membuka WhatsApp untuk @${basket.tiktokUsername}`);

    // Optimistic update status terkirim
    const now = new Date().toISOString();
    setBaskets((prev) =>
      prev.map((b) =>
        b.id === basket.id
          ? {
              ...b,
              waSentAt: now,
              waSentCount: (b.waSentCount || 0) + 1,
            }
          : b
      )
    );

    try {
      await fetch(`/api/admin/tiktok-live/baskets/${basket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markWaSent: true }),
      });
    } catch (err) {
      console.error('Failed to update waSent in background:', err);
    }
  };

  const handleToggleWaSent = async (basket, e) => {
    e?.stopPropagation();
    const nextVal = !basket.waSentAt;
    const now = new Date().toISOString();

    // Optimistic update
    setBaskets((prev) =>
      prev.map((b) =>
        b.id === basket.id
          ? {
              ...b,
              waSentAt: nextVal ? now : null,
              waSentCount: nextVal ? (b.waSentCount || 0) + 1 : Math.max(0, (b.waSentCount || 1) - 1),
            }
          : b
      )
    );

    try {
      const res = await fetch(`/api/admin/tiktok-live/baskets/${basket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleWaSent: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status WA');
      toast.success(
        nextVal
          ? `@${basket.tiktokUsername} ditandai sudah dikirim WA`
          : `@${basket.tiktokUsername} ditandai belum dikirim WA`
      );
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah status');
      // Revert on error
      setBaskets((prev) =>
        prev.map((b) =>
          b.id === basket.id
            ? { ...b, waSentAt: basket.waSentAt, waSentCount: basket.waSentCount }
            : b
        )
      );
    }
  };

  const handleSaveWhatsApp = async (e) => {
    e?.preventDefault();
    if (!waModal.basket) return;

    const trimmed = waModal.phoneInput.trim();
    if (!trimmed) {
      setWaModal((prev) => ({ ...prev, error: 'Nomor WhatsApp wajib diisi.' }));
      return;
    }

    const norm = normalizeWhatsAppNumber(trimmed);
    if (!norm.ok) {
      setWaModal((prev) => ({ ...prev, error: norm.error }));
      return;
    }

    setWaModal((prev) => ({ ...prev, submitting: true, error: '' }));
    try {
      const patchBody = {
        whatsappNumber: norm.normalized,
        ...(waModal.autoOpenWa ? { markWaSent: true } : {}),
      };

      const res = await fetch(`/api/admin/tiktok-live/baskets/${waModal.basket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nomor WhatsApp.');

      const now = new Date().toISOString();
      // Update state
      setBaskets((prev) =>
        prev.map((b) =>
          b.id === waModal.basket.id
            ? {
                ...b,
                whatsappNumber: norm.normalized,
                ...(waModal.autoOpenWa
                  ? {
                      waSentAt: now,
                      waSentCount: (b.waSentCount || 0) + 1,
                    }
                  : {}),
              }
            : b
        )
      );

      toast.success(`Nomor WhatsApp @${waModal.basket.tiktokUsername} tersimpan.`);

      if (waModal.autoOpenWa) {
        const updatedBasket = { ...waModal.basket, whatsappNumber: norm.normalized };
        const waUrl = buildBuyerWhatsAppUrl({
          basket: updatedBasket,
          appOrigin: window.location.origin,
        });
        if (waUrl) {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        }
      }

      setWaModal({
        open: false,
        basket: null,
        phoneInput: '',
        error: '',
        submitting: false,
        autoOpenWa: false,
      });
    } catch (err) {
      setWaModal((prev) => ({ ...prev, error: err.message, submitting: false }));
    }
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemDraft({
      name: item.name || '',
      price: formatThousands(item.price || ''),
      quantity: String(item.quantity || 1),
      note: item.note || '',
    });
  };

  const handleSaveItemEdit = async (itemId) => {
    const numericPrice = parseThousands(editItemDraft.price);
    const numericQty = Math.max(1, parseInt(editItemDraft.quantity, 10) || 1);
    if (!editItemDraft.name.trim()) {
      toast.warning('Nama item wajib diisi');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 1000) {
      toast.warning('Harga minimal Rp 1.000');
      return;
    }

    setSavingItem(true);
    try {
      const res = await fetch(`/api/admin/tiktok-live/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editItemDraft.name.trim(),
          price: numericPrice,
          quantity: numericQty,
          note: editItemDraft.note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui item');
      setEditingItemId(null);
      await loadData(false);
      toast.success('Item keep diperbarui');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui item');
    } finally {
      setSavingItem(false);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      const endpoint =
        confirmState.type === 'item'
          ? `/api/admin/tiktok-live/items/${confirmState.id}`
          : `/api/admin/tiktok-live/baskets/${confirmState.id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data');
      setConfirmState(null);
      await loadData(false);
      toast.success(confirmState.type === 'item' ? 'Item dihapus dari keranjang' : 'Keranjang keep dihapus');
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus');
    } finally {
      setConfirmBusy(false);
    }
  };

  const accountFilterOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Semua Akun TikTok' },
      ...accounts.map((acc) => {
        const hostInfo = acc.hostUser?.name || acc.hostName;
        return {
          value: acc.id,
          label: acc.name,
          sublabel: hostInfo ? `${acc.handle} • Host: ${hostInfo}` : acc.handle,
        };
      }),
    ],
    [accounts],
  );

  const emptyCopy = getEmptyCopy(
    statusFilter,
    Boolean(searchQuery.trim() || accountFilter !== 'ALL'),
    waFilter,
    dateFilter,
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    dateFilter !== 'ALL' ||
    accountFilter !== 'ALL' ||
    waFilter !== 'ALL' ||
    Boolean(searchQuery.trim());

  const handleResetFilters = useCallback(() => {
    setStatusFilter('ALL');
    setDateFilter('ALL');
    setAccountFilter('ALL');
    setWaFilter('ALL');
    setSearchQuery('');
  }, []);

  const renderBasketDetail = (basket, effStatus) => {
    const items = basket.items || [];
    const totalQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const itemSubtotal = items.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0,
    );

    return (
      <div className={styles.expandInner}>
        <div className={styles.expandTop}>
          <div className={styles.expandSectionTitle}>
            <span>Daftar Ikan Keep ({items.length} item • {totalQty} ekor)</span>
          </div>

          <div className={styles.rowActions}>
            {basket.claimToken && (
              <a
                href={`/live/${basket.claimToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnSmallGhost}
                title="Buka portal checkout pembeli di tab baru"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Buka Portal Live
              </a>
            )}
          </div>
        </div>

        <div className={styles.expandItems}>
          {items.map((item) => (
            <div key={item.id} className={styles.expandItemRow}>
              {editingItemId === item.id ? (
                <div className={styles.editInlineRow}>
                  <input
                    type="text"
                    className={styles.input}
                    value={editItemDraft.name}
                    onChange={(e) =>
                      setEditItemDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Nama item"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={styles.input}
                    value={editItemDraft.price}
                    onChange={(e) =>
                      setEditItemDraft((d) => ({ ...d, price: formatThousands(e.target.value) }))
                    }
                    placeholder="Contoh: 150.000"
                  />
                  <input
                    type="number"
                    min="1"
                    className={styles.input}
                    value={editItemDraft.quantity}
                    onChange={(e) =>
                      setEditItemDraft((d) => ({ ...d, quantity: e.target.value }))
                    }
                    placeholder="Qty"
                  />
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.btnSmallPrimary}
                      disabled={savingItem}
                      onClick={() => handleSaveItemEdit(item.id)}
                    >
                      {savingItem ? '...' : 'Simpan'}
                    </button>
                    <button
                      type="button"
                      className={styles.btnSmall}
                      onClick={() => setEditingItemId(null)}
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.expandItemLeft}>
                    <img
                      src={item.image || '/images/placeholder.png'}
                      alt={item.name}
                      className={styles.itemThumb}
                    />
                    <div className={styles.expandItemInfo}>
                      <span className={styles.expandItemName}>{item.name}</span>
                      <div className={styles.expandItemMeta}>
                        <span>
                          {item.quantity} × {formatRupiah(item.price)}
                        </span>
                        {item.selectedSize && <span>Ukuran: {item.selectedSize}</span>}
                        {item.tiktokAccount && (
                          <span>Dari {item.tiktokAccount.handle}</span>
                        )}
                        {item.note && <span>Catatan: {item.note}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={styles.expandItemRight}>
                    <span className={styles.expandItemPrice}>
                      {formatRupiah((Number(item.price) || 0) * (Number(item.quantity) || 1))}
                    </span>
                    {basket.status === 'OPEN' && (
                      <>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => startEditItem(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.btnDangerSmall}
                          onClick={() =>
                            setConfirmState({
                              type: 'item',
                              id: item.id,
                              title: 'Hapus Item Keep?',
                              desc: `Hapus "${item.name}" dari keranjang @${basket.tiktokUsername}?`,
                            })
                          }
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className={styles.orderFooter}>
          <div>
            {basket.order ? (
              <span>
                Order #{basket.order.id.slice(0, 8)}
                {basket.order.trackingNumber ? (
                  <span> • Resi: <strong>{basket.order.trackingNumber}</strong></span>
                ) : null}
                {' '}• Subtotal {formatRupiah(basket.order.subtotal)} + Ongkir{' '}
                {formatRupiah(basket.order.shippingFee)} ={' '}
                <strong>{formatRupiah(basket.order.total)}</strong>
              </span>
            ) : (
              <span>
                Total sementara {totalQty} item:{' '}
                <strong>{formatRupiah(itemSubtotal)}</strong> (belum termasuk ongkir saat pembeli checkout di /live)
              </span>
            )}
          </div>

          {basket.order && (
            <div className={styles.orderLinks}>
              <Link
                href={`/admin/orders?highlightOrder=${encodeURIComponent(basket.order.id)}`}
                className={styles.btnSmall}
              >
                Buka di Pesanan
              </Link>
              {['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(effStatus) && (
                <Link
                  href={`/admin/orders/${basket.order.id}/label`}
                  target="_blank"
                  className={styles.btnSmallPrimary}
                >
                  Cetak Label
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>TikTok Live</h1>
          <p className={styles.subtitle}>
            Catat deal pembeli per username. Setiap pemenang otomatis punya 1 link klaim unik untuk semua ikannya agar aman dan cukup bayar 1x ongkir.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => setShowAccountsModal(true)}
          >
            Kelola Akun ({accounts.length})
          </button>
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Menyegarkan...' : 'Segarkan'}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setDealModalState({ open: true, initialUsername: '' })}
          >
            + Input Deal Live
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div
          className={`${styles.kpiCard} ${styles.kpiCardOpen} ${statusFilter === 'OPEN' ? styles.kpiCardActive : ''}`}
          onClick={() => setStatusFilter((prev) => (prev === 'OPEN' ? 'ALL' : 'OPEN'))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setStatusFilter((prev) => (prev === 'OPEN' ? 'ALL' : 'OPEN'));
            }
          }}
          title={statusFilter === 'OPEN' ? 'Klik untuk menampilkan semua status' : 'Klik untuk menyaring Keep Aktif'}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <span className={`${styles.kpiDot} ${styles.kpiDotOpen}`} aria-hidden="true" />
              <span className={styles.kpiLabel}>Keep Aktif</span>
            </div>
            <span className={`${styles.kpiBadge} ${styles.badgeOpen}`}>Aktif</span>
          </div>
          <span className={styles.kpiValue}>{tabCounts.OPEN}</span>
          <span className={styles.kpiSub}>
            <span className={styles.kpiSubDesktop}>Pembeli belum checkout</span>
            <span className={styles.kpiSubMobile}>Belum checkout</span>
          </span>
        </div>

        <div
          className={`${styles.kpiCard} ${styles.kpiCardPending} ${statusFilter === 'PENDING' ? styles.kpiCardActive : ''}`}
          onClick={() => setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'));
            }
          }}
          title={statusFilter === 'PENDING' ? 'Klik untuk menampilkan semua status' : 'Klik untuk menyaring Menunggu Bayar'}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <span className={`${styles.kpiDot} ${styles.kpiDotPending}`} aria-hidden="true" />
              <span className={styles.kpiLabel}>
                <span className={styles.kpiLabelDesktop}>Menunggu Bayar</span>
                <span className={styles.kpiLabelMobile}>Tunggu Bayar</span>
              </span>
            </div>
            <span className={`${styles.kpiBadge} ${styles.badgePending}`}>Pending</span>
          </div>
          <span className={styles.kpiValue}>{tabCounts.PENDING}</span>
          <span className={styles.kpiSub}>
            <span className={styles.kpiSubDesktop}>Sudah checkout di /live</span>
            <span className={styles.kpiSubMobile}>Menunggu transfer</span>
          </span>
        </div>

        <div
          className={`${styles.kpiCard} ${styles.kpiCardUnsent} ${waFilter === 'UNSENT' ? styles.kpiCardActive : ''}`}
          onClick={() => setWaFilter((prev) => (prev === 'UNSENT' ? 'ALL' : 'UNSENT'))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setWaFilter((prev) => (prev === 'UNSENT' ? 'ALL' : 'UNSENT'));
            }
          }}
          title={waFilter === 'UNSENT' ? 'Klik untuk menampilkan semua pembeli' : 'Klik untuk menyaring Belum di-WA'}
        >
          <div className={styles.kpiTop}>
            <div className={styles.kpiTitleGroup}>
              <span className={`${styles.kpiDot} ${styles.kpiDotUnsent}`} aria-hidden="true" />
              <span className={styles.kpiLabel}>Belum di-WA</span>
            </div>
            <span className={`${styles.kpiBadge} ${styles.kpiBadgeWa}`}>
              <span className={styles.waQuickFilterDot} />
              Belum WA
            </span>
          </div>
          <span className={styles.kpiValue}>{waCounts.unsent}</span>
          <span className={styles.kpiSub}>
            <span className={styles.kpiSubDesktop}>Perlu dikirimi link WA</span>
            <span className={styles.kpiSubMobile}>Perlu kirim WA</span>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={styles.controlBar}>
        {/* Field pencarian di paling kiri */}
        <div className={styles.searchInputWrap}>
          <svg
            className={styles.searchIcon}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sebelah kanan: tombol filter-filter dengan ikon */}
        <div className={styles.tabRow}>
          {/* Status Filter Dropdown */}
          <div className={styles.filterSelectWrap}>
            <LiveSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Semua Status"
              size="sm"
              ariaLabel="Filter status transaksi"
              leadingIcon={iconStatusFilter}
            />
          </div>

          {/* Date Filter Dropdown */}
          <div className={styles.filterSelectWrap}>
            <LiveSelect
              value={dateFilter}
              onChange={handleDateFilterChange}
              options={dateFilterOptions}
              placeholder="Semua Tanggal"
              size="sm"
              ariaLabel="Filter rentang tanggal"
              leadingIcon={iconCalendar}
            />
          </div>

          {/* Custom Date Range Picker (Muncul saat opsi 'CUSTOM' aktif) */}
          {dateFilter === 'CUSTOM' && (
            <div className={styles.customDateRange} title="Pilih rentang tanggal transaksi">
              <button
                type="button"
                className={styles.calendarIconBtn}
                onClick={() => {
                  setDraftStartDate(customStartDate || toLocalDateStr(new Date()));
                  setDraftEndDate(customEndDate || toLocalDateStr(new Date()));
                  setShowCustomDateModal(true);
                }}
                title="Buka kalender & preset rentang tanggal"
                aria-label="Buka kalender & preset rentang tanggal"
              >
                {iconCalendar}
              </button>
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

          {/* Akun TikTok Filter Dropdown */}
          <div className={styles.filterSelectWrap}>
            <LiveSelect
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountFilterOptions}
              placeholder="Semua Akun TikTok"
              size="sm"
              ariaLabel="Filter akun TikTok"
              leadingIcon={iconChannel}
            />
          </div>

          {/* Standalone Belum di-WA Filter Button (Terpisah, tidak dicampur) */}
          <button
            type="button"
            className={`${styles.waQuickFilterBtn} ${waFilter === 'UNSENT' ? styles.waQuickFilterActive : ''}`}
            onClick={() => setWaFilter((prev) => (prev === 'UNSENT' ? 'ALL' : 'UNSENT'))}
            title={
              waFilter === 'UNSENT'
                ? 'Klik untuk kembali menampilkan semua pembeli'
                : 'Filter pembeli aktif yang belum dikirimi WA link checkout'
            }
          >
            <span className={styles.filterBtnIcon} aria-hidden="true">
              {iconWhatsApp}
            </span>
            <span className={styles.waQuickFilterDot} />
            <span>Belum di-WA</span>
            <span className={styles.waQuickFilterCount}>{waCounts.unsent}</span>
          </button>

          {/* Reset Filter Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className={styles.resetFiltersBtn}
              onClick={handleResetFilters}
              title="Reset semua filter ke default"
            >
              <span className={styles.filterBtnIcon} aria-hidden="true">
                {iconReset}
              </span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard Table */}
      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyDesc}>Memuat data transaksi TikTok Live...</p>
          </div>
        ) : filteredBaskets.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>{emptyCopy.title}</h3>
            <p className={styles.emptyDesc}>{emptyCopy.desc}</p>
            {hasActiveFilters && (
              <button
                type="button"
                className={styles.emptyResetBtn}
                onClick={handleResetFilters}
              >
                Reset Semua Filter
              </button>
            )}
            {statusFilter === 'OPEN' || statusFilter === 'ALL' ? (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setDealModalState({ open: true, initialUsername: '' })}
              >
                + Input Deal Live
              </button>
            ) : null}
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={`${styles.thIndex} ${styles.colIndex}`}>No.</th>
                  <th className={styles.colCode}>Kode</th>
                  <th className={styles.colBuyer}>Pembeli</th>
                  <th className={styles.colAccount}>Akun Live</th>
                  <th className={styles.colItem}>Ringkasan Item</th>
                  <th className={`${styles.thRight} ${styles.colTotal}`}>Total</th>
                  <th className={styles.colStatus}>Status</th>
                  <th className={`${styles.thTime} ${styles.colTime}`}>Update</th>
                  <th className={`${styles.thActions} ${styles.colActions}`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredBaskets.map((basket, index) => {
                  const isExpanded = expandedBasketId === basket.id;
                  const effStatus = getEffectiveStatus(basket);
                  const badge = getStatusBadge(effStatus);
                  const items = basket.items || [];
                  const totalQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
                  const itemSubtotal = items.reduce(
                    (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
                    0,
                  );
                  const displayTotal = basket.order?.total ?? itemSubtotal;
                  const leadItem = items[0];

                  return (
                    <Fragment key={basket.id}>
                      <tr
                        className={`${styles.mainRow} ${isExpanded ? styles.mainRowOpen : ''}`}
                        onClick={() =>
                          setExpandedBasketId((prev) => (prev === basket.id ? null : basket.id))
                        }
                      >
                        <td className={`${styles.tdIndex} ${styles.colIndex}`}>{index + 1}</td>
                        <td className={styles.colCode}>
                          <span className={styles.codeCell}>
                            <svg
                              className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            {basket.claimCode}
                          </span>
                        </td>

                        <td className={styles.colBuyer}>
                          <div className={styles.buyerCell}>
                            <div className={styles.buyerHandleRow}>
                              <span className={styles.buyerHandle}>@{basket.tiktokUsername}</span>
                              {basket.order?.name ? (
                                <span className={styles.buyerSub}>({basket.order.name})</span>
                              ) : null}
                              {(() => {
                                const bAccounts = getBasketAccounts(basket);
                                if (bAccounts.length > 1) {
                                  return (
                                    <span className={styles.mobileAccountChip}>
                                      Multi ({bAccounts.length})
                                    </span>
                                  );
                                }
                                if (bAccounts.length === 1) {
                                  return (
                                    <span className={styles.mobileAccountChip}>
                                      {bAccounts[0].handle || bAccounts[0].name}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className={styles.buyerWaRow}>
                              {basket.whatsappNumber ? (
                                <button
                                  type="button"
                                  className={styles.waPhonePill}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsAppModal(basket, false);
                                  }}
                                  title="Klik untuk ubah No. WhatsApp"
                                >
                                  <svg
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.005a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                  <span>{formatWhatsAppDisplay(basket.whatsappNumber)}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.addWaBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWhatsAppModal(basket, false);
                                  }}
                                  title="Tambahkan No. WhatsApp pembeli"
                                >
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  <span>No. WA</span>
                                </button>
                              )}

                              {basket.waSentAt ? (
                                <button
                                  type="button"
                                  className={styles.waStatusBadgeSent}
                                  onClick={(e) => handleToggleWaSent(basket, e)}
                                  title={`Terkirim: ${formatShortTime(basket.waSentAt)}${basket.waSentCount > 1 ? ` (${basket.waSentCount}x)` : ''}. Klik untuk tandai belum dikirim.`}
                                >
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Sudah WA</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.waStatusBadgePending}
                                  onClick={(e) => handleToggleWaSent(basket, e)}
                                  title="Belum dikirim WA. Klik untuk tandai sudah dikirim manual."
                                >
                                  <span className={styles.waDotPending} />
                                  <span>Belum WA</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className={styles.colAccount}>
                          {(() => {
                            const accounts = getBasketAccounts(basket);
                            if (accounts.length > 1) {
                              return (
                                <div className={styles.accountCol}>
                                  <span className={styles.multiAccountBadge}>
                                    Multi-Akun ({accounts.length})
                                  </span>
                                  <span className={styles.accountHostSub}>
                                    {accounts.map((a) => a.handle || a.name).join(' · ')}
                                  </span>
                                </div>
                              );
                            }
                            if (accounts.length === 1) {
                              return (
                                <div className={styles.accountCol}>
                                  <span className={styles.accountChip}>{accounts[0].name}</span>
                                  {accounts[0].hostName ? (
                                    <span className={styles.accountHostSub}>Host: {accounts[0].hostName}</span>
                                  ) : (
                                    <span className={styles.accountHostSub}>{accounts[0].handle}</span>
                                  )}
                                </div>
                              );
                            }
                            return <span className={styles.buyerSub}>-</span>;
                          })()}
                        </td>

                        <td className={styles.colItem}>
                          <div className={styles.itemSummary}>
                            <span className={styles.itemLead}>
                              {leadItem ? `${leadItem.name} ×${leadItem.quantity}` : 'Keranjang kosong'}
                            </span>
                            {items.length > 1 ? (
                              <span className={styles.itemMore}>
                                +{items.length - 1} item lain ({totalQty} qty total)
                              </span>
                            ) : (
                              <span className={styles.itemMore}>{totalQty} qty</span>
                            )}
                          </div>
                        </td>

                        <td className={`${styles.tdRight} ${styles.priceCell} ${styles.colTotal}`}>
                          <span className={styles.priceValue}>{formatRupiah(displayTotal)}</span>
                          <span className={styles.mobileItemSub}>
                            {totalQty} qty ({items.length} item)
                          </span>
                        </td>

                        <td className={styles.colStatus}>
                          <span className={badge.className}>{badge.label}</span>
                        </td>

                        <td className={`${styles.timeCell} ${styles.colTime}`}>{formatShortTime(basket.updatedAt)}</td>

                        <td className={`${styles.tdActions} ${styles.colActions}`} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.rowActions}>
                            {basket.claimToken && (basket.status === 'OPEN' || effStatus === 'PENDING') && (
                              <>
                                {basket.whatsappNumber ? (
                                  <button
                                    type="button"
                                    className={`${styles.btnActionIcon} ${basket.waSentAt ? styles.btnActionWaSent : styles.btnActionWa}`}
                                    onClick={() => handleSendWhatsApp(basket)}
                                    title={
                                      basket.waSentAt
                                        ? `Kirim ulang WA ke ${formatWhatsAppDisplay(basket.whatsappNumber)} (sudah dikirim ${basket.waSentCount || 1}x, terakhir ${formatShortTime(basket.waSentAt)})`
                                        : `Kirim link checkout ke WhatsApp ${formatWhatsAppDisplay(basket.whatsappNumber)}`
                                    }
                                    aria-label="Kirim ke WhatsApp"
                                  >
                                    <svg
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      aria-hidden="true"
                                    >
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.005a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${styles.btnActionIcon} ${styles.btnActionWaGhost}`}
                                    onClick={() => openWhatsAppModal(basket, true)}
                                    title="Input No. WA & kirim link checkout"
                                    aria-label="Input No. WA & kirim"
                                  >
                                    <svg
                                      width="13"
                                      height="13"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      aria-hidden="true"
                                    >
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.005a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className={styles.btnActionIcon}
                                  onClick={() => handleCopyBuyerLink(basket)}
                                  title="Salin template format DM TikTok ke clipboard"
                                  aria-label="Salin DM"
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                              </>
                            )}

                            {basket.status === 'OPEN' && (
                              <>
                                <button
                                  type="button"
                                  className={`${styles.btnActionIcon} ${styles.btnActionPlus}`}
                                  onClick={() =>
                                    setDealModalState({
                                      open: true,
                                      initialUsername: `@${basket.tiktokUsername}`,
                                    })
                                  }
                                  title={`Tambah ikan ke keranjang @${basket.tiktokUsername}`}
                                  aria-label="Tambah Item"
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                </button>

                                <button
                                  type="button"
                                  className={`${styles.btnActionIcon} ${styles.btnActionDanger}`}
                                  onClick={() =>
                                    setConfirmState({
                                      type: 'basket',
                                      id: basket.id,
                                      title: 'Hapus Keranjang Keep?',
                                      desc: `Keranjang ${basket.claimCode} milik @${basket.tiktokUsername} beserta ${items.length} item akan dihapus.`,
                                    })
                                  }
                                  title={`Hapus keranjang ${basket.claimCode}`}
                                  aria-label="Hapus Keranjang"
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </>
                            )}

                            {basket.order?.id && (
                              <Link
                                href={`/admin/orders?highlightOrder=${encodeURIComponent(basket.order.id)}`}
                                className={`${styles.btnActionIcon} ${styles.btnActionOrder}`}
                                title={`Buka di Pesanan (#${basket.order.id.slice(0, 8)})`}
                                aria-label="Buka di Pesanan"
                              >
                                <svg
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={styles.expandRow}>
                          <td colSpan={9}>
                            {renderBasketDetail(basket, effStatus)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deal Input Modal */}
      {dealModalState.open && (
        <AddDealModal
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={handlePersistAccount}
          catalogProducts={catalogProducts}
          initialUsername={dealModalState.initialUsername}
          onClose={() => setDealModalState({ open: false, initialUsername: '' })}
          onSaved={async () => {
            await loadData(false);
          }}
        />
      )}

      {/* Manage TikTok Accounts Modal */}
      {showAccountsModal && (
        <AccountsModal
          accounts={accounts}
          teamUsers={teamUsers}
          onClose={() => setShowAccountsModal(false)}
          onSaved={() => loadData(false)}
        />
      )}

      {/* Clean Minimalist Confirm Dialog */}
      {confirmState && (
        <div className={styles.modalBackdrop} onClick={() => !confirmBusy && setConfirmState(null)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{confirmState.title}</h3>
            <p className={styles.cardDesc}>{confirmState.desc}</p>
            <div className={styles.confirmFooter}>
              <button
                type="button"
                className={styles.btnOutline}
                disabled={confirmBusy}
                onClick={() => setConfirmState(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                disabled={confirmBusy}
                onClick={executeConfirmAction}
              >
                {confirmBusy ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Input / Edit Nomor WhatsApp */}
      {waModal.open && waModal.basket && (
        <div
          className={styles.modalBackdrop}
          onClick={() =>
            !waModal.submitting &&
            setWaModal((prev) => ({ ...prev, open: false }))
          }
        >
          <div
            className={styles.modalCardSmall}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-modal-title"
          >
            <div className={styles.modalHead}>
              <div className={styles.modalHeadText}>
                <h3 id="wa-modal-title" className={styles.modalTitle}>
                  {waModal.autoOpenWa ? 'Kirim Rekap via WhatsApp' : 'Nomor WhatsApp Pembeli'}
                </h3>
                <p className={styles.modalSub}>
                  Pemenang: <strong>@{waModal.basket.tiktokUsername}</strong> ({waModal.basket.claimCode})
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() =>
                  !waModal.submitting &&
                  setWaModal((prev) => ({ ...prev, open: false }))
                }
                aria-label="Tutup modal"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveWhatsApp} className={styles.formStack}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="wa-phone-input">
                  Nomor WhatsApp
                </label>
                <input
                  id="wa-phone-input"
                  type="tel"
                  inputMode="tel"
                  className={styles.input}
                  placeholder="Contoh: 081234567890 atau 6281234567890"
                  value={waModal.phoneInput}
                  onChange={(e) =>
                    setWaModal((prev) => ({ ...prev, phoneInput: e.target.value, error: '' }))
                  }
                  autoFocus
                  required
                />
                <p className={styles.fieldHint}>
                  Format Indonesia (08xx / 628xx). Tersimpan untuk keranjang ini & otomatis mengisi No. HP saat checkout.
                </p>
              </div>

              {waModal.error && (
                <div className={styles.errorBanner} role="alert">
                  {waModal.error}
                </div>
              )}

              <div className={styles.modalFooterClean}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={waModal.submitting}
                  onClick={() => setWaModal((prev) => ({ ...prev, open: false }))}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`${styles.btnSmall} ${styles.btnWhatsAppSolid}`}
                  disabled={waModal.submitting}
                >
                  {waModal.submitting
                    ? 'Menyimpan...'
                    : waModal.autoOpenWa
                    ? 'Simpan & Buka WhatsApp'
                    : 'Simpan Nomor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kustom Tanggal Transaksi */}
      {showCustomDateModal && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowCustomDateModal(false)}
        >
          <div
            className={styles.modalCardSmall}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-date-modal-title"
          >
            <div className={styles.modalHead}>
              <div className={styles.modalHeadText}>
                <h3 id="custom-date-modal-title" className={styles.modalTitle}>
                  Filter Kustom Tanggal
                </h3>
                <p className={styles.modalSub}>
                  Pilih rentang tanggal transaksi deal live TikTok
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowCustomDateModal(false)}
                aria-label="Tutup modal kustom tanggal"
              >
                &times;
              </button>
            </div>

            <div className={styles.formStack}>
              {/* Presets Cepat */}
              <div className={styles.field}>
                <label className={styles.label}>Pilihan Cepat (Preset)</label>
                <div className={styles.datePresetGroup}>
                  <button
                    type="button"
                    className={styles.datePresetBtn}
                    onClick={() => applyDatePreset('today')}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    className={styles.datePresetBtn}
                    onClick={() => applyDatePreset('yesterday')}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    className={styles.datePresetBtn}
                    onClick={() => applyDatePreset('7d')}
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    className={styles.datePresetBtn}
                    onClick={() => applyDatePreset('30d')}
                  >
                    30 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    className={styles.datePresetBtn}
                    onClick={() => applyDatePreset('thisMonth')}
                  >
                    Bulan Ini
                  </button>
                </div>
              </div>

              {/* Input Tanggal Mulai & Selesai */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="custom-date-start">
                    Dari Tanggal
                  </label>
                  <input
                    id="custom-date-start"
                    type="date"
                    className={styles.input}
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="custom-date-end">
                    Sampai Tanggal
                  </label>
                  <input
                    id="custom-date-end"
                    type="date"
                    className={styles.input}
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Shortcut 1 Hari Saja */}
              <div className={styles.dateSingleDayWrap}>
                <button
                  type="button"
                  className={styles.dateSingleDayBtn}
                  onClick={() => setDraftEndDate(draftStartDate)}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Filter 1 Hari Saja (Sama dengan Tanggal Mulai)</span>
                </button>
              </div>

              {/* Pratinjau Rentang */}
              <div className={styles.dateRangePreview}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{customDatePreview}</span>
              </div>

              <div className={styles.modalFooterClean}>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => setShowCustomDateModal(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleApplyCustomDate}
                >
                  Terapkan Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
