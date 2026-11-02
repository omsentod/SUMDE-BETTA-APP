'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/context/ToastContext';
import { canUser } from '@/lib/permission-utils';
import styles from '../dashboard/adminDashboard.module.css';

const TABS = [
  { id: 'ALL', label: 'Semua', countKey: 'all' },
  { id: 'PRODUCT', label: 'Produk', countKey: 'product' },
  { id: 'CATEGORY', label: 'Kategori & Dept', countKey: 'category' },
  { id: 'EVENT', label: 'Event & Promo', countKey: 'event' },
  { id: 'USER', label: 'Pengguna', countKey: 'user' },
  { id: 'ROLE', label: 'Peran Akses', countKey: 'role' },
  { id: 'TELEGRAM', label: 'Sesi Telegram', countKey: 'telegram' },
];

function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return String(isoString);
  }
}

function getEntityBadge(type) {
  switch (type) {
    case 'PRODUCT':
      return { label: 'Produk', className: styles.badgeSuccess };
    case 'DEPARTMENT':
      return { label: 'Departemen', className: styles.badgeWarning };
    case 'SUBCATEGORY':
      return { label: 'Kategori', className: styles.badgeWarning };
    case 'EVENT':
      return { label: 'Event / Promo', className: styles.badgeMuted };
    case 'USER':
      return { label: 'Pengguna', className: styles.badgeSuccess };
    case 'ROLE':
      return { label: 'Peran', className: styles.badgeMuted };
    case 'TELEGRAM_EVENT':
      return { label: 'Telegram Drop', className: styles.badgeWarning };
    default:
      return { label: type, className: styles.badgeMuted };
  }
}

function EntityThumbnail({ item }) {
  if (item.image) {
    return (
      <div className={styles.productThumb}>
        <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
      </div>
    );
  }

  // Placeholder icon vector sesuai tipe
  let iconSvg = null;
  if (item.entityType === 'USER') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  } else if (item.entityType === 'EVENT') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  } else if (item.entityType === 'ROLE') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  } else if (item.entityType === 'TELEGRAM_EVENT') {
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    );
  } else {
    // Default folder / category
    iconSvg = (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '42px',
        height: '42px',
        borderRadius: '6px',
        background: 'var(--dropdown-bg)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {iconSvg}
    </div>
  );
}

function AdminRecycleBinInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { fetchProducts } = useProducts();
  const { toast } = useToast();
  const router = useRouter();

  const canView = canUser(currentUser, 'products:view');
  const canUpdate = canUser(currentUser, 'products:update') || canUser(currentUser, 'products:manage');
  const canDelete = canUser(currentUser, 'products:delete') || canUser(currentUser, 'products:manage');

  const [activeTab, setActiveTab] = useState('ALL');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ all: 0, product: 0, category: 0, event: 0, user: 0, role: 0, telegram: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      router.push('/admin/dashboard');
    }
  }, [currentUser, authLoading, canView, router]);

  const loadRecycleBin = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = encodeURIComponent(search);
      const res = await fetch(`/api/admin/recycle-bin?type=${activeTab}&search=${q}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        if (data.counts) setCounts(data.counts);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal memuat data recycle bin.');
      }
    } catch (err) {
      console.error('Gagal mengambil data recycle bin:', err);
      toast.error(err.message || 'Gagal memuat data tempat sampah.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, toast]);

  useEffect(() => {
    if (!authLoading && currentUser && canView) {
      loadRecycleBin();
    }
  }, [authLoading, currentUser, canView, loadRecycleBin]);

  // Eksekusi Pulihkan Satu Item
  const askRestore = (item) => {
    confirm.open({
      title: 'Pulihkan Data',
      desc: `Pulihkan "${item.name}" kembali ke sistem aktif?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/recycle-bin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore', ids: [item.id] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal memulihkan data.');
          if (data.failedCount > 0 && data.errors?.length > 0) {
            toast.error(data.errors[0]);
          } else {
            toast.success(`"${item.name}" berhasil dipulihkan.`);
          }
          loadRecycleBin();
          if (fetchProducts) fetchProducts();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        } catch (err) {
          toast.error(err.message || 'Gagal memulihkan data.');
        }
      },
    });
  };

  // Eksekusi Hapus Permanen Satu Item
  const askPermanentDelete = (item) => {
    confirm.open({
      title: 'Hapus Permanen',
      desc: `Hapus "${item.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/recycle-bin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'permanent-delete', ids: [item.id] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus data.');
          if (data.failedCount > 0 && data.errors?.length > 0) {
            toast.error(data.errors[0]);
          } else {
            toast.success(`"${item.name}" berhasil dimusnahkan secara permanen.`);
          }
          loadRecycleBin();
          if (fetchProducts) fetchProducts();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus data permanen.');
        }
      },
    });
  };

  // Eksekusi Pulihkan Massal
  const handleBulkRestore = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirm.open({
      title: 'Pulihkan Data Terpilih',
      desc: `Pulihkan ${count} data terpilih kembali ke sistem aktif?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/recycle-bin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore', ids: Array.from(selectedIds) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal memulihkan data massal.');
          toast.success(`${data.successCount} data berhasil dipulihkan.`);
          if (data.failedCount > 0) {
            toast.error(`${data.failedCount} data gagal dipulihkan: ${data.errors?.[0] || ''}`);
          }
          setSelectedIds(new Set());
          setIsSelectMode(false);
          loadRecycleBin();
          if (fetchProducts) fetchProducts();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        } catch (err) {
          toast.error(err.message || 'Gagal memulihkan data.');
        }
      },
    });
  };

  // Eksekusi Hapus Permanen Massal
  const handleBulkPermanentDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirm.open({
      title: 'Hapus Permanen Terpilih',
      desc: `Musnahkan ${count} data terpilih secara permanen? Data yang berkaitan dengan invoice/pesanan akan tetap dilindungi.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/recycle-bin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'permanent-delete', ids: Array.from(selectedIds) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus data massal.');
          toast.success(`${data.successCount} data berhasil dihapus permanen.`);
          if (data.failedCount > 0) {
            toast.error(`${data.failedCount} data tidak dapat dihapus: ${data.errors?.[0] || ''}`);
          }
          setSelectedIds(new Set());
          setIsSelectMode(false);
          loadRecycleBin();
          if (fetchProducts) fetchProducts();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
          }
        } catch (err) {
          toast.error(err.message || 'Gagal memusnahkan data.');
        }
      },
    });
  };

  if (authLoading || !currentUser || !canView) {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas...</h2>
      </div>
    );
  }

  const currentTabObj = TABS.find((t) => t.id === activeTab) || TABS[0];
  const tabItemCount = counts[currentTabObj.countKey] || 0;

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        {/* Header Dashboard */}
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Sistem &amp; Keamanan</span>
            <h1 className={styles.headerTitle}>Recycle Bin Terpadu</h1>
          </div>
          <div className={styles.headerButtons}>
            <Link href="/admin/products" className={styles.outlineBtn} title="Kembali ke Katalog">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Katalog Produk
            </Link>

            {items.length > 0 && (
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
                className={isSelectMode ? styles.selectActiveBtn : styles.outlineBtn}
                title={isSelectMode ? 'Selesai memilih' : 'Pilih data'}
              >
                {isSelectMode ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Selesai
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Pilih
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab Filter Entitas */}
        <div className={styles.tabsContainer} style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
          {TABS.map((tab) => {
            const count = counts[tab.countKey] || 0;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedIds(new Set());
                }}
                className={`${styles.tabButton} ${isActive ? styles.tabActive : ''}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.12rem 0.45rem',
                    borderRadius: '999px',
                    background: isActive ? 'var(--primary)' : 'var(--border-color)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Meta Control */}
        <div className={styles.controlBar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={`Cari data terhapus di ${currentTabObj.label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {items.length} data ditampilkan ({tabItemCount} total di kategori ini)
          </span>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className={styles.tableCard} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Memuat data tempat sampah...</p>
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div className={styles.tableCard} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {search ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '0.25rem' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Pencarian Tidak Ditemukan</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Tidak ada data terhapus yang cocok dengan &ldquo;{search}&rdquo;.</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '0.25rem' }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Tempat Sampah Kosong</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  {activeTab === 'ALL'
                    ? 'Tidak ada data admin yang sedang dihapus.'
                    : `Tidak ada data ${currentTabObj.label} di tempat sampah.`}
                </p>
              </>
            )}
          </div>
        ) : (
          /* Table Content */
          <>
            {isSelectMode && selectedIds.size > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkBarCount}>{selectedIds.size} data terpilih</span>

                {canUpdate && (
                  <button
                    type="button"
                    className={styles.bulkBtnSuccess}
                    onClick={handleBulkRestore}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    Pulihkan ({selectedIds.size})
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    className={styles.bulkBtnDanger}
                    onClick={handleBulkPermanentDelete}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Hapus Permanen ({selectedIds.size})
                  </button>
                )}

                <button
                  type="button"
                  className={styles.bulkBtnOutline}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Batal
                </button>
              </div>
            )}

            <div className={styles.tableCard}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {isSelectMode && (
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={items.length > 0 && items.every((i) => selectedIds.has(i.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(selectedIds);
                              items.forEach((i) => allIds.add(i.id));
                              setSelectedIds(allIds);
                            } else {
                              const next = new Set(selectedIds);
                              items.forEach((i) => next.delete(i.id));
                              setSelectedIds(next);
                            }
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          aria-label="Pilih semua"
                        />
                      </th>
                    )}
                    <th style={{ width: '56px' }}>Ikon</th>
                    <th>Nama &amp; Identitas Data</th>
                    <th>Tipe Data</th>
                    <th className={styles.hideOnMobile}>Ringkasan Informasi</th>
                    <th className={styles.hideOnMobile}>Waktu Dihapus</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const badge = getEntityBadge(item.entityType);
                    return (
                      <tr key={item.id} className={styles.tableRow}>
                        {isSelectMode && (
                          <td style={{ width: '38px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              aria-label={`Pilih ${item.name}`}
                            />
                          </td>
                        )}

                        <td>
                          <EntityThumbnail item={item} />
                        </td>

                        <td style={{ fontWeight: '600' }}>
                          <div>{item.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            ID: {item.id.slice(0, 8)}
                            {item.deletedBy ? ` • Oleh: ${item.deletedBy}` : ''}
                          </div>
                        </td>

                        <td>
                          <span className={`${styles.badge} ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className={styles.hideOnMobile} style={{ fontSize: '0.85rem', color: 'var(--text-main)', maxWidth: '320px' }}>
                          <div>{item.summary || '-'}</div>
                        </td>

                        <td className={styles.hideOnMobile} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(item.deletedAt)}
                        </td>

                        <td>
                          <div className={styles.actionGroup}>
                            {canUpdate && (
                              <button
                                onClick={() => askRestore(item)}
                                className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                                title="Pulihkan ke Sistem Aktif"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1 4 1 10 7 10" />
                                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => askPermanentDelete(item)}
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                title="Hapus Permanen"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}

export default function AdminRecycleBinPage() {
  return (
    <Suspense fallback={null}>
      <AdminRecycleBinInner />
    </Suspense>
  );
}
