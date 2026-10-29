'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
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

function AdminTelegramContent() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const confirm = useConfirmModal();

  const canView = canUser(currentUser, ['events:view', 'events:manage', 'products:view', 'products:manage']);
  const canManage = canUser(currentUser, ['events:manage', 'products:manage']);

  const [data, setData] = useState({
    config: { isConfigured: false, hasChatId: false, defaultChatId: null },
    stats: { totalDropped: 0, activeDrops: 0, bookedDrops: 0, soldDrops: 0, totalEvents: 0, activeEvents: 0 },
    events: [],
    drops: [],
    availableProducts: [],
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('EVENTS'); // EVENTS | ALL | ACTIVE | BOOKED | SOLD
  const [search, setSearch] = useState('');

  // 1. Modal Buat / Edit Event Sesi
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null,
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    durationHours: '24',
    isLifetime: false,
    prefix: 'R-',
    startNumber: '1',
    padZero: true,
  });
  const [savingEvent, setSavingEvent] = useState(false);

  // 2. Modal Buka Card & Kelola Produk Event
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [savingProducts, setSavingProducts] = useState(false);

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
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json);
      } else {
        toast.error(json.error || 'Gagal memuat konfigurasi Telegram.');
      }
    } catch (err) {
      console.error('Gagal mengambil data Telegram:', err);
      toast.error('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUser && canView) {
      loadData();
    }
  }, [currentUser, canView, loadData]);

  // ==========================================
  // HANDLERS: EVENT MANAGEMENT (CARD SYSTEM)
  // ==========================================

  const handleOpenCreateEventModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayIndo = new Intl.NumberFormat('id-ID').format(new Date().getDate());
    const monthName = new Date().toLocaleDateString('id-ID', { month: 'long' });
    setEventForm({
      id: null,
      title: `FLASH DEAL ${todayIndo} ${monthName.toUpperCase()}`,
      description: 'Sesi flash deal spesial koleksi ikan cupang kontes pilihan.',
      date: today,
      durationHours: '24',
      isLifetime: false,
      prefix: 'R-',
      startNumber: '1',
      padZero: true,
    });
    setIsEventModalOpen(true);
  };

  const handleOpenEditEventModal = (event) => {
    setEventForm({
      id: event.id,
      title: event.title,
      description: event.description || '',
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
      durationHours: event.durationHours ? String(event.durationHours) : '24',
      isLifetime: Boolean(event.isLifetime),
      prefix: event.prefix || 'R-',
      startNumber: String(event.startNumber || 1),
      padZero: event.padZero !== false,
    });
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      toast.error('Judul event tidak boleh kosong.');
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        action: eventForm.id ? 'update-event' : 'create-event',
        eventId: eventForm.id,
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        date: eventForm.date,
        durationHours: Number(eventForm.durationHours) || 24,
        isLifetime: eventForm.isLifetime,
        prefix: eventForm.prefix.trim() || 'R-',
        startNumber: Number(eventForm.startNumber) || 1,
        padZero: eventForm.padZero,
      };

      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan event.');

      toast.success(resData.message || 'Event berhasil disimpan.');
      setIsEventModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat menyimpan event.');
    } finally {
      setSavingEvent(false);
    }
  };

  // Buka Card untuk Mengelola Produk Event
  const handleOpenManageProducts = (event) => {
    setSelectedEvent(event);
    const existingIds = (event.products || []).map((p) => p.id);
    setSelectedProductIds(existingIds);
    setProductSearch('');
    setIsProductModalOpen(true);
  };

  const handleToggleProductInEvent = (productId) => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSaveProductsInEvent = async (autoBroadcast = false) => {
    if (!selectedEvent) return;

    setSavingProducts(true);
    try {
      // 1. Update produk dalam event
      const updatePayload = {
        action: 'update-event',
        eventId: selectedEvent.id,
        productIds: selectedProductIds,
      };

      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan produk.');

      if (autoBroadcast) {
        // 2. Langsung siarkan jika tombol Siarkan Sekarang diklik
        await handleBroadcastEvent(selectedEvent, true);
      } else {
        toast.success(`Berhasil memperbarui ${selectedProductIds.length} produk dalam event.`);
        setIsProductModalOpen(false);
        loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui produk event.');
    } finally {
      setSavingProducts(false);
    }
  };

  // Siarkan Event ke Telegram
  const handleBroadcastEvent = async (event, skipConfirm = false) => {
    const doBroadcast = async () => {
      try {
        const res = await fetch('/api/admin/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'broadcast-event',
            eventId: event.id,
          }),
        });

        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Gagal menyiarkan event ke Telegram.');

        toast.success(resData.message || 'Event berhasil disiarkan ke Telegram!');
        setIsProductModalOpen(false);
        loadData();
      } catch (err) {
        toast.error(err.message || 'Gagal menyiarkan event.');
      }
    };

    if (skipConfirm) {
      await doBroadcast();
    } else {
      confirm.open({
        title: 'Siarkan Event ke Telegram?',
        desc: `Bot akan mengirim banner pembuka, ${event.products?.length || 0} postingan ikan berurutan dengan kode ${event.prefix || 'R-'}, dan papan live recap ke grup Telegram. Lanjutkan?`,
        onConfirm: doBroadcast,
      });
    }
  };

  // Siarkan Ulang Papan Live Recap ke Grup Telegram
  const handleBroadcastRecap = (event) => {
    confirm.open({
      title: 'Kirim Papan Live Recap Terkini?',
      desc: `Bot akan menyiarkan papan rekap status terkini (Sold, Booked, Open) untuk event "${event.title}" ke grup Telegram.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'broadcast-recap',
              eventId: event.id,
            }),
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Gagal menyiarkan rekap.');
          toast.success('Papan Live Recap berhasil disiarkan ke grup Telegram.');
        } catch (err) {
          toast.error(err.message || 'Gagal mengirim rekap.');
        }
      },
    });
  };

  // Tutup Sesi Event
  const handleCloseEvent = (event) => {
    confirm.open({
      title: 'Tutup Sesi Event Broadcast?',
      desc: `Apakah Anda yakin ingin menutup sesi "${event.title}"? Seluruh sisa postingan yang belum terjual di grup Telegram akan ditutup tombol deal-nya.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'close-event',
              eventId: event.id,
            }),
          });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Gagal menutup event.');
          toast.success(resData.message || 'Event berhasil ditutup.');
          loadData();
        } catch (err) {
          toast.error(err.message || 'Gagal menutup event.');
        }
      },
    });
  };

  // Hapus Event
  const handleDeleteEvent = (event) => {
    confirm.open({
      title: 'Hapus Event Broadcast?',
      desc: `Apakah Anda yakin ingin menghapus data sesi "${event.title}"? Hubungan produk ke event ini akan dilepas.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/telegram?eventId=${event.id}`, { method: 'DELETE' });
          const resData = await res.json();
          if (!res.ok) throw new Error(resData.error || 'Gagal menghapus event.');
          toast.success('Event berhasil dihapus.');
          loadData();
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus event.');
        }
      },
    });
  };

  // Buka paksa kunci booking individual
  const handleReleaseBooking = (drop) => {
    confirm.open({
      title: 'Buka Kunci Booking Ikan',
      desc: `Ikan "${drop.name}" saat ini sedang di-booking oleh @${drop.bookedBy || 'User'}. Apakah Anda ingin melepaskan booking ini agar kembali OPEN untuk pembeli lain? Papan rekap akan diperbarui otomatis.`,
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

  // Filter gabungan produk untuk modal kelola event
  const poolProductsForModal = useMemo(() => {
    if (!selectedEvent) return [];
    // Gabungkan produk yang sudah ada di event ini + produk available
    const eventProds = selectedEvent.products || [];
    const eventProdIds = new Set(eventProds.map((p) => p.id));
    const available = data.availableProducts.filter((p) => !eventProdIds.has(p.id));

    // Urutan: Produk terpilih ditaruh paling atas sesuai urutan selectedProductIds
    const selectedMap = new Map();
    [...eventProds, ...available].forEach((p) => selectedMap.set(p.id, p));

    const orderedSelected = selectedProductIds
      .map((id) => selectedMap.get(id))
      .filter(Boolean);

    const unselected = [...eventProds, ...available].filter(
      (p) => !selectedProductIds.includes(p.id)
    );

    const combined = [...orderedSelected, ...unselected];

    if (!productSearch.trim()) return combined;
    const q = productSearch.toLowerCase();
    return combined.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.form && p.form.toLowerCase().includes(q)) ||
        (p.dropNumber && p.dropNumber.toLowerCase().includes(q))
    );
  }, [selectedEvent, selectedProductIds, data.availableProducts, productSearch]);

  // Filter daftar drops utama (Tab individual)
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

  return (
    <div className={styles.telegramWrapper}>
      <div className="container">
        {/* Header */}
        <div className={styles.telegramHeader}>
          <div>
            <span className={styles.headerBadge}>Event & Operasional</span>
            <h1 className={styles.headerTitle}>Broadcast Telegram</h1>
            <p className={styles.headerSubtitle}>
              Kelola sesi event flash deal, banner pembuka, urutan kode produk, dan live recap realtime langsung ke grup Telegram.
            </p>
          </div>
          <div className={styles.headerButtons}>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreateEventModal}
                className={styles.primaryBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Buat Sesi Event Baru
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
            <span
              className={
                loading
                  ? styles.statusDotMuted
                  : data.config.isConfigured && data.config.hasChatId
                  ? styles.statusDot
                  : styles.statusDotInactive
              }
            />
            <div>
              <div className={styles.configInfoTitle}>
                {loading
                  ? 'Memeriksa Konfigurasi Bot Telegram...'
                  : data.config.isConfigured
                  ? 'Bot Telegram Terhubung'
                  : 'Bot Telegram Belum Dikonfigurasi'}
                {!loading && data.config.hasChatId && (
                  <span className={`${styles.badgeSuccess} ${styles.configBadgePill}`}>
                    Grup Aktif ({data.config.defaultChatId})
                  </span>
                )}
              </div>
              <div className={styles.configInfoSub}>
                {loading
                  ? 'Menghubungkan ke server...'
                  : data.config.isConfigured
                  ? 'Sistem otomatis mengirim media, tombol deal in-app, mengunci 15 menit, dan memantau live recap.'
                  : 'Konfigurasikan TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di environment server (.env).'}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{data.stats.totalEvents || data.events.length}</span>
            <span className={styles.statLabel}>Total Sesi Event</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberActive}`}>{data.stats.activeEvents || 0}</span>
            <span className={styles.statLabel}>Sesi Live Berjalan</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberBooked}`}>{data.stats.bookedDrops}</span>
            <span className={styles.statLabel}>Ikan Sedang Di-Book</span>
          </div>
          <div className={styles.statCard}>
            <span className={`${styles.statNumber} ${styles.statNumberSold}`}>{data.stats.soldDrops}</span>
            <span className={styles.statLabel}>Ikan Terjual (Sold)</span>
          </div>
        </div>

        {/* Control Bar: Tabs & Search */}
        <div className={styles.controlBar}>
          <div className={styles.tabsList}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'EVENTS' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('EVENTS')}
            >
              Sesi Event Broadcast ({data.events.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'ALL' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              Semua Ikan ({data.drops.length})
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

          {activeTab !== 'EVENTS' && (
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
          )}
        </div>

        {/* =========================================
            TAB 1: EVENT BROADCAST CARDS GRID (MODUL CARD)
           ========================================= */}
        {activeTab === 'EVENTS' && (
          <div>
            {loading ? (
              <div className={`${styles.tableCard} ${styles.tableEmptyBox}`}>
                Memuat daftar sesi event broadcast...
              </div>
            ) : data.events.length === 0 ? (
              <div className={styles.tableCard}>
                <div className={styles.emptyState}>
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.tableEmptyIcon}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <h3 className={styles.emptyStateTitle}>Belum Ada Sesi Event Broadcast</h3>
                  <p className={styles.emptyStateDesc}>
                    Buat sesi event flash deal baru untuk mengatur waktu siar, banner pengumuman pembuka, penomoran kode otomatis (R-01, R-02), dan live recap realtime.
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleOpenCreateEventModal}
                      className={styles.primaryBtn}
                    >
                      Buat Sesi Event Pertama
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.eventCardsGrid}>
                {data.events.map((event) => {
                  const prods = event.products || [];
                  const totalProds = prods.length;
                  const soldCount = prods.filter((p) => p.isSold).length;
                  const bookedCount = prods.filter((p) => p.bookedUntil && new Date(p.bookedUntil) > new Date() && !p.isSold).length;
                  const openCount = totalProds - soldCount - bookedCount;

                  const isLive = event.status === 'ACTIVE';
                  const isDraft = event.status === 'DRAFT';
                  const isCompleted = event.status === 'COMPLETED';

                  let statusBadge = (
                    <span className={`${styles.badge} ${styles.badgeMuted}`}>Draft</span>
                  );
                  if (isLive) {
                    statusBadge = (
                      <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                        LIVE BERJALAN
                      </span>
                    );
                  } else if (isCompleted) {
                    statusBadge = (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>
                        Selesai / Ditutup
                      </span>
                    );
                  }

                  const firstCode = prods[0]?.dropNumber || `${event.prefix || 'R-'}01`;
                  const lastCode = prods[totalProds - 1]?.dropNumber || firstCode;

                  return (
                    <div
                      key={event.id}
                      className={`${styles.eventCard} ${isLive ? styles.eventCardActive : ''} ${isDraft ? styles.eventCardDraft : ''} ${isCompleted ? styles.eventCardCompleted : ''}`}
                    >
                      <div>
                        {/* Header Kartu */}
                        <div className={styles.eventCardHeader}>
                          <h3 className={styles.eventTitle}>{event.title}</h3>
                          {statusBadge}
                        </div>

                        {/* Deskripsi */}
                        <p className={styles.eventDescription}>
                          {event.description || 'Sesi broadcast ikan cupang pilihan via Telegram Bot.'}
                        </p>

                        {/* Metadata Tag */}
                        <div className={styles.eventMetaRow}>
                          <span className={`${styles.eventMetaTag} ${styles.eventMetaTagPrimary}`}>
                            Prefix: {event.prefix || 'R-'}
                          </span>
                          <span className={styles.eventMetaTag}>
                            {event.isLifetime ? '♾️ Lifetime' : `${event.durationHours || 24} Jam`}
                          </span>
                          <span className={styles.eventMetaTag}>
                            {new Date(event.date || event.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Bar Statistik Produk */}
                        <div className={styles.eventStatsBar}>
                          <div className={styles.eventStatItem}>
                            <span className={styles.eventStatCount}>{totalProds}</span>
                            <span className={styles.eventStatLabel}>Total Ikan</span>
                          </div>
                          <div className={styles.eventStatItem}>
                            <span className={`${styles.eventStatCount} ${styles.statNumberActive}`}>{openCount}</span>
                            <span className={styles.eventStatLabel}>Tersedia</span>
                          </div>
                          <div className={styles.eventStatItem}>
                            <span className={`${styles.eventStatCount} ${styles.statNumberBooked}`}>{bookedCount}</span>
                            <span className={styles.eventStatLabel}>Di-Book</span>
                          </div>
                          <div className={styles.eventStatItem}>
                            <span className={`${styles.eventStatCount} ${styles.statNumberSold}`}>{soldCount}</span>
                            <span className={styles.eventStatLabel}>Terjual</span>
                          </div>
                        </div>

                        {/* Thumbnail Ikan Preview */}
                        {prods.length > 0 && (
                          <div className={styles.eventThumbnails}>
                            {prods.slice(0, 5).map((p) => (
                              <div key={p.id} className={styles.eventMiniThumb} title={`${p.dropNumber || ''} - ${p.name}`}>
                                <Image
                                  src={p.image || '/img/betta-1.png'}
                                  alt={p.name}
                                  fill
                                  className={styles.previewImageCover}
                                />
                              </div>
                            ))}
                            {prods.length > 5 && (
                              <div className={styles.eventMoreThumb}>
                                +{prods.length - 5}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer Aksi Kartu */}
                      <div className={styles.eventFooter}>
                        <div className={styles.eventFooterLeft}>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenManageProducts(event)}
                              className={`${styles.outlineBtn} ${styles.btnSm}`}
                              title="Buka kartu dan kelola produk yang akan disiarkan"
                            >
                              Kelola Produk ({totalProds})
                            </button>
                          )}

                          {isDraft && canManage && (
                            <button
                              type="button"
                              onClick={() => handleBroadcastEvent(event)}
                              className={`${styles.primaryBtn} ${styles.btnSm}`}
                              disabled={totalProds === 0}
                              title="Siarkan banner pembuka dan seluruh ikan ke Telegram"
                            >
                              Siarkan ke Telegram
                            </button>
                          )}

                          {isLive && canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleBroadcastRecap(event)}
                                className={`${styles.outlineBtn} ${styles.btnSm}`}
                                title="Kirim papan live recap terkini ke grup Telegram"
                              >
                                Update Rekap
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCloseEvent(event)}
                                className={`${styles.outlineBtn} ${styles.btnSm} ${styles.btnDangerOutline}`}
                                title="Tutup sesi event dan matikan tombol drop di Telegram"
                              >
                                Tutup Event
                              </button>
                            </>
                          )}
                        </div>

                        <div className={styles.eventFooterRight}>
                          {canManage && isDraft && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditEventModal(event)}
                              className={styles.iconBtn}
                              title="Edit Pengaturan Event"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(event)}
                              className={styles.iconBtn}
                              title="Hapus Event"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================
            TAB 2, 3, 4, 5: TABEL DAFTAR DROP INDIVIDUAL
           ========================================= */}
        {activeTab !== 'EVENTS' && (
          <div>
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
                      : 'Buka tab "Sesi Event Broadcast" di atas untuk membuat sesi dan menyiarkan ikan ke grup Telegram.'}
                  </p>
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
                      const isExpired = drop.dropExpiresAt && new Date(drop.dropExpiresAt) <= now;

                      let statusBadge = (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                          OPEN (Tersedia)
                        </span>
                      );

                      if (drop.isSold) {
                        statusBadge = (
                          <span className={`${styles.badge} ${styles.badgeDanger}`}>
                            SOLD OUT ({drop.bookedBy ? `@${drop.bookedBy}` : 'Terjual'})
                          </span>
                        );
                      } else if (isBooked) {
                        const diffSec = Math.max(0, Math.floor((new Date(drop.bookedUntil) - now) / 1000));
                        const mins = Math.floor(diffSec / 60);
                        const secs = diffSec % 60;
                        statusBadge = (
                          <span className={`${styles.badge} ${styles.badgeWarning}`}>
                            BOOKED @{drop.bookedBy || 'User'} ({mins}m {secs}s)
                          </span>
                        );
                      } else if (isExpired || !drop.isDailyDrop) {
                        statusBadge = (
                          <span className={`${styles.badge} ${styles.badgeMuted}`}>
                            Selesai / Ditutup
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
                                <div>{isExpired ? '(Waktu habis)' : 'Aktif'}</div>
                              </>
                            ) : (
                              '♾️ Lifetime'
                            )}
                          </td>
                          <td>
                            <div className={styles.actionGroup}>
                              {isBooked && canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleReleaseBooking(drop)}
                                  className={`${styles.outlineBtn} ${styles.btnSm}`}
                                  title="Lepaskan status booking agar kembali OPEN dan update rekap Telegram"
                                >
                                  Lepas Booking
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
        )}
      </div>

      {/* =========================================
          MODAL 1: BUAT / EDIT SESI EVENT BROADCAST
         ========================================= */}
      {isEventModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {eventForm.id ? 'Edit Sesi Event Broadcast' : 'Buat Sesi Event Broadcast Baru'}
                </h3>
                <p className={styles.modalSubtitle}>
                  Tentukan tema acara, durasi waktu siar (termasuk opsi Lifetime), dan kode prefix untuk penomoran otomatis.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsEventModalOpen(false)}
                disabled={savingEvent}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEvent}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nama / Tema Event</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Contoh: FLASH DEAL 29 OKTOBER 2026"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Deskripsi Singkat</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Contoh: Spesial Cupang Kontes Edisi Terbatas"
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  />
                </div>

                <div className={styles.formRow2}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tanggal Pelaksanaan</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={eventForm.date}
                      onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Batas Waktu / Durasi</label>
                    <select
                      className={styles.formInput}
                      value={eventForm.isLifetime ? 'LIFETIME' : eventForm.durationHours}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'LIFETIME') {
                          setEventForm({ ...eventForm, isLifetime: true });
                        } else {
                          setEventForm({ ...eventForm, isLifetime: false, durationHours: val });
                        }
                      }}
                    >
                      <option value="6">6 Jam</option>
                      <option value="12">12 Jam</option>
                      <option value="24">24 Jam (Standar)</option>
                      <option value="48">48 Jam (2 Hari)</option>
                      <option value="LIFETIME">♾️ Lifetime (Tanpa Batas Waktu)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow3}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Prefix Kode</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="R-"
                      value={eventForm.prefix}
                      onChange={(e) => setEventForm({ ...eventForm, prefix: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Mulai Nomor</label>
                    <input
                      type="number"
                      min="1"
                      className={styles.formInput}
                      value={eventForm.startNumber}
                      onChange={(e) => setEventForm({ ...eventForm, startNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Format Digit</label>
                    <label className={`${styles.checkboxLabel} ${styles.checkboxLabelSpaced}`}>
                      <input
                        type="checkbox"
                        checked={eventForm.padZero}
                        onChange={(e) => setEventForm({ ...eventForm, padZero: e.target.checked })}
                        className={styles.customCheck}
                      />
                      <span>2 Digit (01, 02)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.outlineBtn}
                  onClick={() => setIsEventModalOpen(false)}
                  disabled={savingEvent}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={savingEvent}
                >
                  {savingEvent ? 'Menyimpan...' : 'Simpan Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL 2: BUKA CARD & KELOLA PRODUK EVENT
         ========================================= */}
      {isProductModalOpen && selectedEvent && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  Kelola Produk: {selectedEvent.title}
                </h3>
                <p className={styles.modalSubtitle}>
                  Pilih produk dari katalog. Nomor urut ({selectedEvent.prefix || 'R-'}01, {selectedEvent.prefix || 'R-'}02, ...) akan diterapkan secara otomatis sesuai urutan checklist.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setIsProductModalOpen(false)}
                disabled={savingProducts}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Search & Info Row */}
              <div className={styles.modalSearchRow}>
                <input
                  type="text"
                  className={styles.modalSearchInput}
                  placeholder="Cari ikan di katalog (nama, kategori, form)..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
                <div className={styles.countSelectedText}>
                  {selectedProductIds.length} produk terpilih
                </div>
              </div>

              {/* Table Checklist Produk */}
              <div className={styles.checklistCard}>
                <table className={styles.checkTable}>
                  <thead>
                    <tr>
                      <th className={styles.checkboxTh}>Pilih</th>
                      <th>Produk</th>
                      <th>Kategori & Form</th>
                      <th>Harga</th>
                      <th className={styles.thCodeWidth}>Kode Urut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolProductsForModal.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={styles.tdEmptyModal}>
                          Tidak ada produk yang cocok dengan pencarian.
                        </td>
                      </tr>
                    ) : (
                      poolProductsForModal.map((p) => {
                        const isChecked = selectedProductIds.includes(p.id);
                        const seqIndex = selectedProductIds.indexOf(p.id);

                        // Hitung kode yang akan didapat jika dicentang
                        let codePreview = '-';
                        if (isChecked) {
                          const numVal = (Number(selectedEvent.startNumber) || 1) + seqIndex;
                          const formattedNum = selectedEvent.padZero !== false ? String(numVal).padStart(2, '0') : String(numVal);
                          codePreview = `${selectedEvent.prefix || 'R-'}${formattedNum}`;
                        }

                        return (
                          <tr
                            key={p.id}
                            className={`${isChecked ? styles.checkRowSelected : ''} ${styles.tableRowPointer}`}
                            onClick={() => handleToggleProductInEvent(p.id)}
                          >
                            <td className={styles.checkboxTd} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleProductInEvent(p.id)}
                                className={styles.customCheck}
                              />
                            </td>
                            <td>
                              <div className={styles.productMiniCell}>
                                <div className={styles.eventThumbSm}>
                                  <Image
                                    src={p.image || '/img/betta-1.png'}
                                    alt={p.name}
                                    fill
                                    className={styles.previewImageCover}
                                  />
                                </div>
                                <span className={styles.productCheckName}>{p.name}</span>
                              </div>
                            </td>
                            <td className={styles.cellMuted}>
                              {p.category || '-'} • {p.form || '-'}
                            </td>
                            <td className={styles.cellPrice}>
                              {formatIDR(p.price)}
                            </td>
                            <td>
                              <span className={isChecked ? styles.dropCode : styles.cellMuted}>
                                {codePreview}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => setIsProductModalOpen(false)}
                disabled={savingProducts}
              >
                Batal
              </button>

              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => handleSaveProductsInEvent(false)}
                disabled={savingProducts}
              >
                {savingProducts ? 'Menyimpan...' : 'Simpan Produk'}
              </button>

              {selectedEvent.status === 'DRAFT' && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => handleSaveProductsInEvent(true)}
                  disabled={savingProducts || selectedProductIds.length === 0}
                >
                  Simpan & Siarkan Sekarang
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi */}
      <AdminConfirmModal modal={confirm} />
    </div>
  );
}

export default function AdminTelegramPage() {
  return (
    <Suspense fallback={<div className={styles.emptyState}><p className={styles.emptyStateTitle}>Memuat Broadcast Telegram...</p></div>}>
      <AdminTelegramContent />
    </Suspense>
  );
}
