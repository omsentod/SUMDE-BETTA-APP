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
import styles from './tiktokLive.module.css';

const STORAGE_ACCOUNT_KEY = 'sumde_tiktok_live_account_id';

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

function getEmptyCopy(statusFilter, hasSearchOrAccount) {
  if (hasSearchOrAccount) {
    return {
      title: 'Tidak ada data yang cocok',
      desc: 'Coba ubah kata kunci pencarian atau pilih filter akun TikTok lainnya.',
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
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBasketId, setExpandedBasketId] = useState(null);

  // Modals
  const [dealModalState, setDealModalState] = useState({ open: false, initialUsername: '' });
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  const kpis = useMemo(() => {
    let openBaskets = 0;
    let openItems = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let paidRevenue = 0;

    for (const b of baskets) {
      const eff = getEffectiveStatus(b);
      if (eff === 'OPEN') {
        openBaskets += 1;
        openItems += (b.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
      } else if (eff === 'PENDING') {
        pendingCount += 1;
      } else if (eff === 'PAID' || eff === 'PROCESSING' || eff === 'SHIPPED' || eff === 'COMPLETED') {
        paidCount += 1;
        paidRevenue += Number(b.order?.total || 0);
      }
    }

    return { openBaskets, openItems, pendingCount, paidCount, paidRevenue };
  }, [baskets]);

  const tabCounts = useMemo(() => {
    const counts = { ALL: baskets.length, OPEN: 0, PENDING: 0, PAID: 0 };
    for (const b of baskets) {
      const eff = getEffectiveStatus(b);
      if (eff === 'OPEN') counts.OPEN += 1;
      else if (eff === 'PENDING') counts.PENDING += 1;
      else if (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(eff)) counts.PAID += 1;
    }
    return counts;
  }, [baskets]);

  const filteredBaskets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    return baskets.filter((b) => {
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
      if (q) {
        const inUser = (b.tiktokUsername || '').toLowerCase().includes(q);
        const inCode = (b.claimCode || '').toLowerCase().includes(q);
        const inOrder = (b.order?.id || '').toLowerCase().includes(q);
        const inItem = (b.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
        if (!inUser && !inCode && !inOrder && !inItem) return false;
      }
      return true;
    });
  }, [baskets, statusFilter, accountFilter, searchQuery]);

  const handleCopyBuyerLink = async (basket) => {
    if (!basket?.claimToken) {
      toast.warning('Token link belum tersedia, coba segarkan data');
      return;
    }
    const totalItems = (basket.items || []).reduce(
      (acc, it) => acc + (Number(it.quantity) || 1),
      0
    );
    const countText = totalItems > 0 ? `${totalItems} ekor ikan` : 'ikan';
    const url = `${window.location.origin}/live/${basket.claimToken}`;

    const accounts = getBasketAccounts(basket);
    const accountNames = accounts.map((a) => a.handle || a.name).join(' & ');
    const liveSourceText = accountNames
      ? `sesi TikTok Live (${accountNames})`
      : 'sesi TikTok Live Sumde Betta';

    const dmText = [
      `Halo kak @${basket.tiktokUsername}!`,
      ``,
      `Terima kasih sudah ikutan ${liveSourceText}.`,
      `Berikut link rekap order & keep kamu (${countText}):`,
      url,
      ``,
      `Silakan buka link di atas untuk cek rincian ikan, lengkapi alamat kirim, dan selesaikan pembayaran ya kak.`,
      `Terima kasih & salam satu air!`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(dmText);
      toast.success(`Format pesan DM untuk @${basket.tiktokUsername} disalin ke clipboard`);
    } catch {
      toast.info(`Link live @${basket.tiktokUsername}: ${url}`);
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
  );

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
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Keep Aktif</span>
          <span className={styles.kpiValue}>{kpis.openBaskets}</span>
          <span className={styles.kpiSub}>Pembeli belum checkout</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Item Keep</span>
          <span className={styles.kpiValue}>{kpis.openItems}</span>
          <span className={styles.kpiSub}>Ekor menunggu diklaim</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Menunggu Bayar</span>
          <span className={styles.kpiValue}>{kpis.pendingCount}</span>
          <span className={styles.kpiSub}>Sudah checkout di /live</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Order Live Lunas</span>
          <span className={styles.kpiValue}>{kpis.paidCount}</span>
          <span className={styles.kpiSub}>Omzet {formatRupiah(kpis.paidRevenue)}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={styles.controlBar}>
        <div className={styles.tabRow}>
          {[
            { key: 'ALL', label: 'Semua', count: tabCounts.ALL },
            { key: 'OPEN', label: 'Keep Aktif', count: tabCounts.OPEN },
            { key: 'PENDING', label: 'Menunggu Bayar', count: tabCounts.PENDING },
            { key: 'PAID', label: 'Lunas / Selesai', count: tabCounts.PAID },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tabBtn} ${statusFilter === tab.key ? styles.tabBtnActive : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <span className={styles.tabCount}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className={styles.searchGroup}>
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
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Cari @username, kode LV-, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.filterSelectWrap}>
            <LiveSelect
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountFilterOptions}
              placeholder="Semua Akun TikTok"
              size="sm"
              ariaLabel="Filter akun TikTok"
            />
          </div>
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
                  <th className={styles.thIndex}>No.</th>
                  <th>Kode</th>
                  <th>Pembeli TikTok</th>
                  <th>Akun Live</th>
                  <th>Ringkasan Item</th>
                  <th className={styles.thRight}>Total</th>
                  <th>Status</th>
                  <th>Update</th>
                  <th className={styles.thActions}>Aksi</th>
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
                        <td className={styles.tdIndex}>{index + 1}</td>
                        <td>
                          <span className={styles.codeCell}>
                            <svg
                              className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                              width="14"
                              height="14"
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

                        <td>
                          <div className={styles.buyerCell}>
                            <span className={styles.buyerHandle}>@{basket.tiktokUsername}</span>
                            {basket.order?.name ? (
                              <span className={styles.buyerSub}>{basket.order.name}</span>
                            ) : null}
                          </div>
                        </td>

                        <td>
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

                        <td>
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

                        <td className={`${styles.tdRight} ${styles.priceCell}`}>
                          {formatRupiah(displayTotal)}
                        </td>

                        <td>
                          <span className={badge.className}>{badge.label}</span>
                        </td>

                        <td className={styles.timeCell}>{formatShortTime(basket.updatedAt)}</td>

                        <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.rowActions}>
                            {basket.claimToken && (basket.status === 'OPEN' || effStatus === 'PENDING') && (
                              <button
                                type="button"
                                className={styles.btnSmall}
                                onClick={() => handleCopyBuyerLink(basket)}
                                title="Salin template format DM TikTok ke clipboard"
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
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                Salin DM
                              </button>
                            )}
                            {basket.status === 'OPEN' && (
                              <>
                                <button
                                  type="button"
                                  className={styles.btnSmallPrimary}
                                  onClick={() =>
                                    setDealModalState({
                                      open: true,
                                      initialUsername: `@${basket.tiktokUsername}`,
                                    })
                                  }
                                >
                                  + Item
                                </button>
                                <button
                                  type="button"
                                  className={styles.btnDangerSmall}
                                  onClick={() =>
                                    setConfirmState({
                                      type: 'basket',
                                      id: basket.id,
                                      title: 'Hapus Keranjang Keep?',
                                      desc: `Keranjang ${basket.claimCode} milik @${basket.tiktokUsername} beserta ${items.length} item akan dihapus.`,
                                    })
                                  }
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                            {basket.order?.id && (
                              <Link
                                href={`/admin/orders?highlightOrder=${encodeURIComponent(basket.order.id)}`}
                                className={styles.btnSmall}
                              >
                                Lihat Order
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={styles.expandRow}>
                          <td colSpan={9}>
                            <div className={styles.expandInner}>
                              <div className={styles.expandTop}>
                                <div className={styles.expandMeta}>
                                  <span>
                                    Kode Claim: <strong>{basket.claimCode}</strong>
                                  </span>
                                  <span>
                                    Pembeli: <strong>@{basket.tiktokUsername}</strong>
                                  </span>
                                  {(() => {
                                    const accounts = getBasketAccounts(basket);
                                    if (accounts.length > 1) {
                                      return (
                                        <span>
                                          Akun Live: <strong>{accounts.map((a) => `${a.name} (${a.handle})`).join(' + ')}</strong>
                                          <span className={styles.multiTag}>(Gabungan {accounts.length} Akun)</span>
                                        </span>
                                      );
                                    }
                                    if (accounts.length === 1) {
                                      return (
                                        <span>
                                          Akun Live: <strong>{accounts[0].name} ({accounts[0].handle})</strong>
                                          {accounts[0].hostName ? ` • Host: ${accounts[0].hostName}` : ''}
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {basket.order?.trackingNumber && (
                                    <span>
                                      Resi: <strong>{basket.order.trackingNumber}</strong>
                                    </span>
                                  )}
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
                                      Order #{basket.order.id.slice(0, 8)} • Subtotal{' '}
                                      {formatRupiah(basket.order.subtotal)} + Ongkir{' '}
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
    </div>
  );
}
