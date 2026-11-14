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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

function PackingPageInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'bagging');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({ bagging: 0, boxing: 0, ready: 0, shipped: 0, pendingTotal: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [checkedChecklist, setCheckedChecklist] = useState({});

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
  }, [activeTab, searchQuery, currentUser, canAccess, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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

  // SATU TABEL TUNGGAL UNTUK TAHAP 1 (Bungkus Plastik Ikan)
  // Menyatukan:
  // 1. Ikan Sampel Web: Di-agregasi per jenis ikan & ukuran (total ekor dari seluruh resi yang masuk)
  // 2. Ikan Tangki Khusus: Dikelompokkan per soliter @username
  // Tanpa menampilkan ID pesanan (ID pesanan murni di Tahap 2 saat masuk kardus)
  const { baggingRows, totalBaggingFish } = useMemo(() => {
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

        const fishNames = (order.items || [])
          .map((it) => `${it.quantity || 1}x ${it.customName || it.product?.name || 'Ikan Betta'}${it.selectedSize ? ` (${it.selectedSize})` : ''}`)
          .join(', ');

        rows.push({
          id: `claim_${order.id}`,
          type: 'claim',
          orderId: order.id,
          orderIds: [order.id],
          name: fishNames,
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
  }, [orders]);

  return (
    <div className={styles.pageContainer}>
      {/* 1. Header & Tombol Scanner (Hanya tampil di Tahap 2: Pack Box & Resi) */}
      <div className={styles.topHeader}>
        <div className={styles.headerTextGroup}>
          <h1 className={styles.pageTitle}>Packing Gudang &amp; Verifikasi Resi</h1>
          <p className={styles.pageDescription}>
            Manajemen alur serok ikan, bungkus plastik, kemas box, dan scan resi fisik ekspedisi.
          </p>
        </div>

        {activeTab === 'boxing' && (
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className={styles.openScannerBtn}
            aria-label="Buka scanner kamera smartphone"
          >
            {iconCamera}
            <span>Scan Resi Fisik</span>
          </button>
        )}
      </div>

      {/* 2. Kartu Tab Tahap Alur Kerja (Warna Solid per Box, Saat Active SAMA SEMUA) */}
      <div className={styles.kpiStagesGrid}>
        {/* Tahap 1: Bungkus Plastik Ikan (Box Solid Amber) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardBagging} ${activeTab === 'bagging' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => setActiveTab('bagging')}
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
          onClick={() => setActiveTab('boxing')}
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
          onClick={() => setActiveTab('ready')}
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

        {/* Tahap 4: Sudah Dikirim (Box Solid Blue) */}
        <div
          className={`${styles.kpiCard} ${styles.kpiCardShipped} ${activeTab === 'shipped' ? styles.kpiCardActive : ''}`.trim()}
          onClick={() => setActiveTab('shipped')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.kpiCardHeader}>
            <span className={styles.kpiStepBadge}>
              Riwayat Ekspedisi
            </span>
            {activeTab === 'shipped' && (
              <span className={styles.activeIndicatorPill}>Dipilih</span>
            )}
          </div>
          <span className={styles.kpiTitle}>Sudah Dikirim</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiNumber}>
              {counts.shipped}
            </span>
            <span className={styles.kpiUnit}>Paket</span>
          </div>
        </div>
      </div>

      {/* 3. Bar Keterangan & Pencarian */}
      <div className={styles.actionBar}>
        <div className={styles.tabStatusSubtitle}>
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
          <span>
            {activeTab === 'bagging'
              ? 'Fokus ikan: serok sampel per jenis & soliter live. ID pesanan diproses di Tahap 2.'
              : activeTab === 'boxing'
              ? 'Masukkan ikan yang sudah dibungkus ke dalam box, cocokkan item dengan kertas resi fisik.'
              : activeTab === 'ready'
              ? 'Paket sudah dikemas rapi & resi di-scan, siap dijemput kurir ekspedisi.'
              : 'Daftar paket yang telah diserahkan dan dibawa oleh kurir ekspedisi.'}
          </span>
        </div>

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

      {/* 4. TAMPILAN TAHAP 1: SATU TABEL TUNGGAL (FOKUS IKAN, TANPA ID PESANAN) */}
      {activeTab === 'bagging' && (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thThumb}>Foto</th>
                  <th>Ikan &amp; Spesifikasi</th>
                  <th>Asal / Soliter</th>
                  <th className={styles.thQty}>Total Ekor</th>
                  <th className={styles.thAction}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className={styles.tdLoadingText}>
                      Memuat daftar ikan yang perlu dibungkus...
                    </td>
                  </tr>
                ) : baggingRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.tdZeroPadding}>
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
                    const isActionLoading =
                      actionLoadingId === row.orderIds.join('-') ||
                      actionLoadingId === row.orderId;

                    return (
                      <tr key={row.id}>
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

                        {/* 2. Nama Jenis Ikan & Ukuran / Rincian Soliter */}
                        <td>
                          <div className={styles.fishInfoCol}>
                            <div className={styles.fishNameRow}>
                              <span className={styles.fishName}>{row.name}</span>
                              {row.selectedSize && (
                                <span className={styles.fishSizeBadge}>Size {row.selectedSize}</span>
                              )}
                            </div>
                            <span className={styles.fishMetaText}>{row.subtitle}</span>
                          </div>
                        </td>

                        {/* 3. Lokasi Asal / Soliter */}
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

                        {/* 4. Total Ekor */}
                        <td className={styles.fishQtyCell}>
                          <span className={styles.qtyBadgeAmber}>
                            {row.totalQty} Ekor
                          </span>
                        </td>

                        {/* 5. Tombol Selesai Bungkus */}
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

      {/* 5. TAMPILAN TAHAP 2, 3, 4: SATU TABEL PESANAN & KARDUS DENGAN ROW-EXPAND (ID PESANAN & RESI FISIK) */}
      {activeTab !== 'bagging' && (
        <div className={styles.tableWrap}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
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
                    <td colSpan={6} className={styles.tdLoadingText}>
                      Memuat antrean packing...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.tdZeroPadding}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                          {activeTab === 'ready' ? iconCheck : iconBox}
                        </div>
                        <h2 className={styles.emptyTitle}>
                          {activeTab === 'boxing'
                            ? 'Tidak Ada Antrean Pack Box'
                            : activeTab === 'ready'
                            ? 'Tidak Ada Paket Menunggu Kurir'
                            : 'Belum Ada Riwayat Kirim'}
                        </h2>
                        <p className={styles.emptyDesc}>
                          {activeTab === 'boxing'
                            ? 'Menunggu ikan selesai dibungkus dari Tahap 1.'
                            : activeTab === 'ready'
                            ? 'Belum ada paket yang siap dijemput kurir ekspedisi.'
                            : 'Paket yang telah diserahkan ke kurir akan muncul di sini.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
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
                          className={`${styles.clickableRow} ${isExpanded ? styles.rowExpanded : ''}`.trim()}
                        >
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
                            {order.packingStatus === 'PENDING' && (
                              <span className={`${styles.statusBadge} ${styles.statusBagging}`}>
                                Perlu Dibungkus
                              </span>
                            )}
                            {order.packingStatus === 'BAGGED' && (
                              <span className={`${styles.statusBadge} ${styles.statusBoxing}`}>
                                Siap Pack Box
                              </span>
                            )}
                            {order.packingStatus === 'READY_FOR_PICKUP' && (
                              <span className={`${styles.statusBadge} ${styles.statusReady}`}>
                                {iconCheck}
                                <span>Siap Pickup</span>
                              </span>
                            )}
                            {order.status === 'SHIPPED' && (
                              <span className={`${styles.statusBadge} ${styles.statusShipped}`}>
                                Dikirim
                              </span>
                            )}
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
                            <td colSpan={6} className={styles.tdZeroPadding}>
                              <div className={styles.expandContent}>
                                {/* Konteks Pos Akun TikTok Live & Stiker Pembeli jika ada */}
                                {order.orderSource === 'TIKTOK_LIVE' && (
                                  <div className={styles.orderSourceContextRow}>
                                    <span>Pos Akun Live: <strong>{resolveTikTokHost(order) || '-'}</strong></span>
                                    {order.tiktokUsername && (
                                      <span>Stiker Tangki Pembeli: <strong>@{order.tiktokUsername.replace(/^@+/, '')}</strong></span>
                                    )}
                                  </div>
                                )}

                                {/* 1. Checklist Item Barang Pesanan */}
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
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleItemCheck(checkKey)}
                                              className={styles.checkInput}
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
                                            <span className={styles.itemSize}>Size {it.selectedSize}</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* 2. Footer Aksi & Informasi Resi Fisik */}
                                <div className={styles.expandFooter} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.historyInfoGroup}>
                                    {order.baggedAt && (
                                      <span>
                                        Dibungkus: {new Date(order.baggedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({order.baggedBy || 'Tim Kolam'})
                                      </span>
                                    )}
                                    {order.packedAt && (
                                      <span>
                                        Selesai Box: {new Date(order.packedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({order.packedBy || 'Tim Box'})
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
      )}

      {/* Floating Action Button (FAB) Scanner Kamera Smartphone (Hanya tampil di Tahap 2: Pack Box & Resi) */}
      {activeTab === 'boxing' && (
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className={styles.floatingScannerBtn}
          aria-label="Scan barcode resi fisik"
        >
          {iconCamera}
          <span>Scan Resi</span>
        </button>
      )}

      {/* Modal Scanner Kamera Smartphone */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
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
