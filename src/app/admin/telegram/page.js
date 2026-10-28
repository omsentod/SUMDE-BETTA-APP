'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import { canUser } from '@/lib/permission-utils';
import { isYouTubeUrl } from '@/lib/telegram';
import styles from './telegram.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

export default function AdminTelegramPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const confirm = useConfirmModal();

  const canView = canUser(currentUser, ['events:view', 'events:manage', 'products:view', 'products:manage']);
  const canManage = canUser(currentUser, ['events:manage', 'products:manage']);

  const [data, setData] = useState({
    config: { isConfigured: false, hasChatId: false, defaultChatId: null },
    stats: { totalDropped: 0, activeDrops: 0, bookedDrops: 0, soldDrops: 0 },
    drops: [],
    availableProducts: [],
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | ACTIVE | BOOKED | SOLD
  const [search, setSearch] = useState('');

  // Modal Tambah Broadcast (Multi-select checklist)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [dropCodes, setDropCodes] = useState({});
  const [durationHours, setDurationHours] = useState('24');
  const [prefix, setPrefix] = useState('#');
  const [startNum, setStartNum] = useState('1');
  const [padZero, setPadZero] = useState(true);
  const [modalSearch, setModalSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Proteksi hak akses
  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      router.push('/admin/dashboard');
    }
  }, [currentUser, authLoading, canView, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/telegram', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Gagal mengambil data Telegram:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && canView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
      loadData();
    }
  }, [currentUser, canView, loadData]);

  // Buka Modal Tambah Broadcast
  const handleOpenAddModal = () => {
    const initialChecked = new Set();
    const initialCodes = {};
    const baseIndex = data.drops.length + 1;

    data.availableProducts.forEach((p, idx) => {
      const numVal = baseIndex + idx;
      const formattedNum = `#${String(numVal).padStart(2, '0')}`;
      initialCodes[p.id] = p.dropNumber || formattedNum;
    });

    setCheckedIds(initialChecked);
    setDropCodes(initialCodes);
    setDurationHours('24');
    setPrefix('#');
    setStartNum(String(baseIndex));
    setPadZero(true);
    setModalSearch('');
    setIsModalOpen(true);
  };

  // Toggle checklist produk individual
  const handleToggleProduct = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filter produk yang ada di dalam modal
  const filteredModalProducts = useMemo(() => {
    if (!modalSearch.trim()) return data.availableProducts;
    const q = modalSearch.toLowerCase();
    return data.availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.form && p.form.toLowerCase().includes(q))
    );
  }, [data.availableProducts, modalSearch]);

  // Toggle checklist semua produk yang terlihat di modal
  const handleToggleAllModal = () => {
    const visibleIds = filteredModalProducts.map((p) => p.id);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every((id) => checkedIds.has(id));

    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Update kode drop untuk produk tertentu
  const handleUpdateCode = (id, val) => {
    setDropCodes((prev) => ({ ...prev, [id]: val }));
  };

  // Terapkan penomoran otomatis berurutan ke semua produk yang sedang dicentang
  const handleApplyAutoNumber = () => {
    const start = parseInt(startNum, 10) || 1;
    const cleanPrefix = prefix.trim();
    const selectedList = data.availableProducts.filter((p) => checkedIds.has(p.id));

    if (selectedList.length === 0) {
      toast.info('Pilih minimal satu produk dengan mencentang kotak terlebih dahulu.');
      return;
    }

    const updated = { ...dropCodes };
    selectedList.forEach((p, idx) => {
      const numVal = start + idx;
      const numFormatted = padZero ? String(numVal).padStart(2, '0') : String(numVal);
      updated[p.id] = `${cleanPrefix}${numFormatted}`;
    });

    setDropCodes(updated);
    toast.info(`Nomor berurutan diterapkan ke ${selectedList.length} produk terpilih.`);
  };

  // Submit broadcast masif ke API
  const handleSubmitBroadcast = async (e) => {
    e.preventDefault();
    const selectedList = data.availableProducts.filter((p) => checkedIds.has(p.id));

    if (selectedList.length === 0) {
      toast.error('Centang minimal satu produk untuk dibroadcast.');
      return;
    }

    // Validasi kode drop tidak boleh kosong
    for (const p of selectedList) {
      const code = dropCodes[p.id];
      if (!code || !code.trim()) {
        toast.error(`Kode drop untuk "${p.name}" belum diisi.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        items: selectedList.map((p) => ({
          productId: p.id,
          dropNumber: (dropCodes[p.id] || '').trim(),
        })),
        durationHours: Number(durationHours) || 24,
      };

      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal mengirim broadcast ke Telegram.');
      }

      if (resData.succeeded > 0) {
        toast.success(`Berhasil membroadcast ${resData.succeeded} ikan ke grup Telegram!`);
      }
      if (resData.failed > 0) {
        toast.warning(`${resData.failed} produk gagal dibroadcast.`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat broadcast.');
    } finally {
      setSubmitting(false);
    }
  };

  // Batalkan / selesaikan drop produk
  const handleCancelDrop = (drop) => {
    confirm.open({
      title: 'Akhiri Status Flash Drop',
      desc: `Apakah Anda yakin ingin mengakhiri Flash Drop untuk ikan "${drop.name}" (${drop.dropNumber || '#DROP'})? Tombol di Telegram akan ditutup.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/telegram?productId=${drop.id}`, { method: 'DELETE' });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Gagal mengakhiri drop.');
          toast.success(resData.message || 'Drop berhasil diakhiri.');
          loadData();
        } catch (err) {
          toast.error(err.message || 'Gagal mengakhiri drop.');
        }
      },
    });
  };

  // Buka paksa kunci booking
  const handleReleaseBooking = (drop) => {
    confirm.open({
      title: 'Buka Kunci Booking Ikan',
      desc: `Ikan "${drop.name}" saat ini sedang di-booking oleh @${drop.bookedBy || 'User'}. Apakah Anda ingin melepaskan booking ini agar kembali OPEN untuk pembeli lain?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/telegram', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: drop.id, action: 'release-booking' }),
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Gagal melepaskan booking.');
          toast.success(resData.message || 'Booking berhasil dilepas.');
          loadData();
        } catch (err) {
          toast.error(err.message || 'Gagal melepaskan booking.');
        }
      },
    });
  };

  // Filter daftar drops utama
  const filteredDrops = useMemo(() => {
    const now = new Date();
    return data.drops.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.dropNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.bookedBy || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      const isBooked = d.bookedUntil && new Date(d.bookedUntil) > now && !d.isSold;
      const isOpen = d.isDailyDrop && !d.isSold && !isBooked;
      const isSold = d.isSold;

      if (activeTab === 'ACTIVE') return isOpen;
      if (activeTab === 'BOOKED') return isBooked;
      if (activeTab === 'SOLD') return isSold;
      return true;
    });
  }, [data.drops, search, activeTab]);

  if (authLoading || !currentUser || !canView) {
    return (
      <div className={`${styles.emptyState} ${styles.emptyStateCentered}`}>
        <p className={styles.emptyStateTitle}>Memverifikasi Hak Akses Telegram...</p>
      </div>
    );
  }

  const isAllVisibleChecked =
    filteredModalProducts.length > 0 &&
    filteredModalProducts.every((p) => checkedIds.has(p.id));

  return (
    <div className={styles.telegramWrapper}>
      <div className="container">
        {/* Header */}
        <div className={styles.telegramHeader}>
          <div>
            <span className={styles.headerBadge}>Event & Operasional</span>
            <h1 className={styles.headerTitle}>Broadcast Telegram</h1>
            <p className={styles.headerSubtitle}>
              Kelola etalase Daily Drop 24 Jam dan notifikasi penjualan flash sale langsung ke grup Telegram.
            </p>
          </div>
          <div className={styles.headerButtons}>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className={styles.primaryBtn}
                disabled={data.availableProducts.length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Broadcast
              </button>
            )}
            <button
              type="button"
              onClick={loadData}
              className={styles.outlineBtn}
              title="Segarkan Data"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Segarkan
            </button>
          </div>
        </div>

        {/* Telegram Config Status Banner */}
        <div className={styles.configBanner}>
          <div className={styles.configLeft}>
            <span className={data.config.isConfigured && data.config.hasChatId ? styles.statusDot : styles.statusDotInactive} />
            <div>
              <div className={styles.configInfoTitle}>
                {data.config.isConfigured ? 'Bot Telegram Terhubung' : 'Bot Telegram Belum Dikonfigurasi'}
                {data.config.hasChatId && (
                  <span className={`${styles.badgeSuccess} ${styles.configBadgePill}`}>
                    Grup Aktif ({data.config.defaultChatId})
                  </span>
                )}
              </div>
              <div className={styles.configInfoSub}>
                {data.config.isConfigured
                  ? 'Sistem otomatis mengirim media, tombol ambil ikan, dan memantau booking 15 menit.'
                  : 'Konfigurasikan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di environment server (.env).'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{data.stats.totalDropped}</span>
            <span className={styles.statLabel}>Total Pernah Di-Drop</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberActive}`}>{data.stats.activeDrops}</span>
            <span className={styles.statLabel}>Sedang Aktif (Open)</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberBooked}`}>{data.stats.bookedDrops}</span>
            <span className={styles.statLabel}>Sedang Di-Booking</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberSold}`}>{data.stats.soldDrops}</span>
            <span className={styles.statLabel}>Terjual (Sold Out)</span>
          </div>
        </div>

        {/* Control Bar: Tabs + Search */}
        <div className={styles.controlBar}>
          <div className={styles.tabsList}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'ALL' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              Semua ({data.drops.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'ACTIVE' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('ACTIVE')}
            >
              Aktif ({data.stats.activeDrops})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'BOOKED' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('BOOKED')}
            >
              Di-booking ({data.stats.bookedDrops})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'SOLD' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('SOLD')}
            >
              Terjual ({data.stats.soldDrops})
            </button>
          </div>

          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari ikan, kode drop, atau username..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table List of Telegram Drops */}
        {loading ? (
          <div className={`${styles.tableCard} ${styles.tableEmptyBox}`}>
            Memuat data broadcast Telegram...
          </div>
        ) : filteredDrops.length === 0 ? (
          <div className={styles.tableCard}>
            <div className={styles.emptyState}>
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.tableEmptyIcon}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <h3 className={styles.emptyStateTitle}>
                {search ? `Tidak ada drop yang cocok dengan "${search}"` : 'Belum Ada Ikan di Kategori Ini'}
              </h3>
              <p className={styles.emptyStateDesc}>
                {activeTab === 'ACTIVE'
                  ? 'Saat ini tidak ada flash drop yang sedang aktif di grup Telegram.'
                  : activeTab === 'BOOKED'
                  ? 'Tidak ada ikan yang sedang dalam masa tunggu pembayaran 15 menit.'
                  : activeTab === 'SOLD'
                  ? 'Belum ada ikan yang lunas terjual melalui jalur Telegram Drop.'
                  : 'Pilih ikan dari katalog dan tekan tombol "+ Tambah Broadcast" di atas untuk mengirim ke grup Telegram.'}
              </p>
              {canManage && activeTab === 'ALL' && data.availableProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className={styles.primaryBtn}
                >
                  Broadcast Ikan Sekarang
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Media & Kode</th>
                  <th>Nama Ikan & Spesifikasi</th>
                  <th>Harga</th>
                  <th>Status Drop</th>
                  <th className={styles.hideOnMobile}>Masa Berlaku</th>
                  <th className={styles.actionTh}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrops.map((drop) => {
                  const now = new Date();
                  const isYt = isYouTubeUrl(drop.videoUrl);
                  const isBooked = drop.bookedUntil && new Date(drop.bookedUntil) > now && !drop.isSold;
                  const isExpired24h = drop.dropExpiresAt && new Date(drop.dropExpiresAt) <= now;

                  let statusBadge = (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                      🟢 OPEN (Tersedia)
                    </span>
                  );

                  if (drop.isSold) {
                    statusBadge = (
                      <span className={`${styles.badge} ${styles.badgeDanger}`}>
                        🔴 SOLD OUT ({drop.bookedBy ? `@${drop.bookedBy}` : 'Terjual'})
                      </span>
                    );
                  } else if (isBooked) {
                    const diffSec = Math.max(0, Math.floor((new Date(drop.bookedUntil) - now) / 1000));
                    const mins = Math.floor(diffSec / 60);
                    const secs = diffSec % 60;
                    statusBadge = (
                      <span className={`${styles.badge} ${styles.badgeWarning}`}>
                        🟡 BOOKED @{drop.bookedBy || 'User'} ({mins}m {secs}s)
                      </span>
                    );
                  } else if (isExpired24h || !drop.isDailyDrop) {
                    statusBadge = (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>
                        ⏰ Selesai / Ditutup
                      </span>
                    );
                  }

                  return (
                    <tr key={drop.id} className={styles.tableRow}>
                      <td>
                        <div className={styles.mediaCell}>
                          <div className={styles.eventThumb}>
                            <Image
                              src={drop.image || '/img/betta-1.png'}
                              alt={drop.name}
                              fill
                              className={styles.previewImageCover}
                            />
                          </div>
                          <div>
                            <span className={styles.dropCode}>{drop.dropNumber || '#DROP'}</span>
                            {drop.videoUrl && (
                              <div className={styles.videoTag}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {isYt ? 'YouTube' : 'Video MP4'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellProductName}>{drop.name}</div>
                        <div className={styles.cellProductMeta}>
                          Form: {drop.form || '-'} • Grade: {drop.statsForm || 'COMP'} • Usia: {drop.age || '-'}
                        </div>
                      </td>
                      <td className={styles.cellPrice}>
                        {formatIDR(drop.price)}
                      </td>
                      <td>{statusBadge}</td>
                      <td className={`${styles.hideOnMobile} ${styles.cellDate}`}>
                        {drop.dropExpiresAt ? (
                          <>
                            <div>Batas: {new Date(drop.dropExpiresAt).toLocaleString('id-ID')}</div>
                            <div>{isExpired24h ? '(Waktu habis)' : 'Aktif 24 Jam'}</div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          {isBooked && canManage && (
                            <button
                              type="button"
                              onClick={() => handleReleaseBooking(drop)}
                              className={`${styles.outlineBtn} ${styles.btnSm}`}
                              title="Lepaskan status booking agar bisa diambil kembali oleh pembeli lain"
                            >
                              Lepas Booking
                            </button>
                          )}
                          {drop.isDailyDrop && !drop.isSold && canManage && (
                            <button
                              type="button"
                              onClick={() => handleCancelDrop(drop)}
                              className={`${styles.outlineBtn} ${styles.btnSm}`}
                              title="Tutup / batalkan status flash drop untuk ikan ini"
                            >
                              Akhiri Drop
                            </button>
                          )}
                          <Link
                            href={`/produk/${drop.id}`}
                            target="_blank"
                            className={styles.iconBtn}
                            title="Buka Halaman Produk di Web"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Broadcast Masif (Checklist & Penomoran) */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Tambah Broadcast Flash Drop</h3>
                <p className={styles.modalSubtitle}>
                  Pilih produk dari katalog dengan checklist dan tentukan kode uniknya untuk dikirim ke grup Telegram.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                title="Tutup Modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitBroadcast}>
              <div className={styles.modalBody}>
                {/* Generator & Settings Box */}
                <div className={styles.generatorBox}>
                  <div className={styles.generatorTitle}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="9" x2="20" y2="9" />
                      <line x1="4" y1="15" x2="20" y2="15" />
                      <line x1="10" y1="3" x2="8" y2="21" />
                      <line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    Alat Penomoran Cepat & Pengaturan Durasi
                  </div>

                  <div className={styles.generatorControls}>
                    <div className={styles.controlField}>
                      <span className={styles.controlLabel}>Durasi Drop</span>
                      <select
                        className={styles.fieldInputSm}
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                      >
                        <option value="6">6 Jam</option>
                        <option value="12">12 Jam</option>
                        <option value="24">24 Jam (Standar)</option>
                        <option value="48">48 Jam (2 Hari)</option>
                      </select>
                    </div>

                    <div className={styles.controlField}>
                      <span className={styles.controlLabel}>Prefix</span>
                      <input
                        type="text"
                        className={`${styles.fieldInputSm} ${styles.inputPrefixWidth}`}
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value)}
                        placeholder="#"
                      />
                    </div>

                    <div className={styles.controlField}>
                      <span className={styles.controlLabel}>Mulai Dari</span>
                      <input
                        type="number"
                        min="1"
                        className={`${styles.fieldInputSm} ${styles.inputStartWidth}`}
                        value={startNum}
                        onChange={(e) => setStartNum(e.target.value)}
                      />
                    </div>

                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={padZero}
                        onChange={(e) => setPadZero(e.target.checked)}
                        className={styles.customCheck}
                      />
                      <span>Format 2 Digit (01, 02)</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleApplyAutoNumber}
                      className={styles.applyNumberBtn}
                    >
                      Terapkan Nomor Berurutan
                    </button>
                  </div>
                </div>

                {/* Search Filter Produk di Modal */}
                <div className={styles.modalSearchRow}>
                  <input
                    type="text"
                    className={styles.modalSearchInput}
                    placeholder="Cari ikan di katalog (nama atau kategori)..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                  <div className={styles.countSelectedText}>
                    {checkedIds.size} dari {data.availableProducts.length} produk dicentang
                  </div>
                </div>

                {/* Table Checklist Produk */}
                <div className={styles.checklistCard}>
                  <table className={styles.checkTable}>
                    <thead>
                      <tr>
                        <th className={styles.checkboxTh}>
                          <input
                            type="checkbox"
                            checked={isAllVisibleChecked}
                            onChange={handleToggleAllModal}
                            className={styles.customCheck}
                            title="Centang / Hapus Semua yang Terlihat"
                          />
                        </th>
                        <th>Produk</th>
                        <th>Kategori & Form</th>
                        <th>Harga</th>
                        <th className={styles.thCodeWidth}>Kode Drop</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredModalProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className={styles.tdEmptyModal}>
                            Tidak ada produk yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredModalProducts.map((p) => {
                          const isChecked = checkedIds.has(p.id);
                          const isYt = isYouTubeUrl(p.videoUrl);

                          return (
                            <tr
                              key={p.id}
                              className={isChecked ? styles.checkRowSelected : ''}
                            >
                              <td className={styles.checkboxTd}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleProduct(p.id)}
                                  className={styles.customCheck}
                                />
                              </td>
                              <td>
                                <div className={styles.checkProductCell}>
                                  <div className={styles.checkThumb}>
                                    <Image
                                      src={p.image || '/img/betta-1.png'}
                                      alt={p.name}
                                      fill
                                      className={styles.previewImageCover}
                                    />
                                  </div>
                                  <div>
                                    <div className={styles.checkProductName}>{p.name}</div>
                                    {p.videoUrl && (
                                      <div className={styles.videoTag}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                        {isYt ? 'YouTube Video' : 'Video MP4'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={styles.checkProductSub}>
                                  {p.category || '-'} • {p.form || '-'}
                                </span>
                              </td>
                              <td className={styles.cellPrice}>
                                {formatIDR(p.price)}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.codeField}
                                  disabled={!isChecked}
                                  value={dropCodes[p.id] || ''}
                                  onChange={(e) => handleUpdateCode(p.id, e.target.value)}
                                  placeholder="#01"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <div className={styles.countSelectedText}>
                  {checkedIds.size} produk dipilih untuk dibroadcast
                </div>
                <div className={styles.modalFooterRight}>
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryBtn}
                    disabled={submitting || checkedIds.size === 0}
                  >
                    {submitting ? 'Mengirim ke Telegram...' : `Kirim Broadcast (${checkedIds.size} Ikan)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
