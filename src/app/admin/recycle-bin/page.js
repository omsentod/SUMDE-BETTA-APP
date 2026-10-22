'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/context/ToastContext';
import { canUser } from '@/lib/permission-utils';
import styles from '../dashboard/adminDashboard.module.css';

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

function AdminRecycleBinInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { products, isLoading: productsLoading, fetchProducts } = useProducts();
  const { toast } = useToast();
  const router = useRouter();

  const canView = canUser(currentUser, 'products:view');
  const canUpdate = canUser(currentUser, 'products:update');
  const canDelete = canUser(currentUser, 'products:delete');

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      router.push('/admin/dashboard');
    }
  }, [currentUser, authLoading, canView, router]);

  const archivedProducts = useMemo(() => {
    return products.filter((p) => Boolean(p.isArchived));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return archivedProducts;
    return archivedProducts.filter((p) => {
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchForm = (p.form || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      return matchName || matchForm || matchCat;
    });
  }, [archivedProducts, search]);

  // Pulihkan satu produk
  const askRestore = (product) => {
    confirm.open({
      title: 'Pulihkan Produk',
      desc: `Pulihkan "${product.name}" kembali ke etalase toko?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/products/bulk/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [product.id], archive: false }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal memulihkan produk.');
          toast.success(`Produk "${product.name}" berhasil dipulihkan.`);
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal memulihkan produk.');
        }
      },
    });
  };

  // Hapus permanen satu produk
  const askPermanentDelete = (product) => {
    confirm.open({
      title: 'Hapus Permanen',
      desc: `Hapus "${product.name}" secara permanen? Data produk akan dihapus dan tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/products/bulk/permanent-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [product.id] }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk permanen.');
          if (data.blockedCount > 0) {
            toast.error('Produk tidak dapat dihapus permanen karena memiliki riwayat pesanan (invoice).');
          } else {
            toast.success(`Produk "${product.name}" berhasil dihapus secara permanen.`);
          }
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus produk permanen.');
        }
      },
    });
  };

  // Pulihkan massal terpilih
  const handleBulkRestore = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirm.open({
      title: 'Pulihkan Produk',
      desc: `Pulihkan ${count} produk terpilih kembali ke etalase toko?`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/products/bulk/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds), archive: false }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal memulihkan produk.');
          toast.success(data.message || `${count} produk berhasil dipulihkan.`);
          setSelectedIds(new Set());
          setIsSelectMode(false);
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal memulihkan produk.');
        }
      },
    });
  };

  // Hapus permanen massal terpilih
  const handleBulkPermanentDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirm.open({
      title: 'Hapus Permanen',
      desc: `Hapus ${count} produk terpilih secara permanen? Produk dengan riwayat pesanan (invoice) akan tetap dilindungi di tempat sampah.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/products/bulk/permanent-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk permanen.');
          toast.success(data.message || `${data.deletedCount} produk berhasil dihapus permanen.`);
          setSelectedIds(new Set());
          setIsSelectMode(false);
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus produk permanen.');
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

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Sistem</span>
            <h1 className={styles.headerTitle}>Recycle Bin</h1>
          </div>
          <div className={styles.headerButtons}>
            <Link href="/admin/products" className={styles.outlineBtn} title="Kembali ke Katalog Produk">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Kembali ke Produk
            </Link>

            {archivedProducts.length > 0 && (
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
                title={isSelectMode ? 'Selesai memilih' : 'Pilih produk'}
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

        <div className={styles.controlBar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Cari produk di recycle bin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {filtered.length} produk di tempat sampah
          </span>
        </div>

        {productsLoading ? (
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Memuat data recycle bin...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.tableCard} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {search ? (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '0.25rem' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Pencarian Tidak Ditemukan</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Tidak ada produk terhapus yang cocok dengan &ldquo;{search}&rdquo;.</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '0.25rem' }}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Recycle Bin Kosong</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Tidak ada produk di tempat sampah.</p>
                <Link href="/admin/products" className={styles.outlineBtn} style={{ marginTop: '0.5rem' }}>
                  Lihat Katalog Produk
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {isSelectMode && selectedIds.size > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkBarCount}>{selectedIds.size} produk terpilih</span>

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
                          checked={filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = new Set(selectedIds);
                              filtered.forEach((p) => allIds.add(p.id));
                              setSelectedIds(allIds);
                            } else {
                              const next = new Set(selectedIds);
                              filtered.forEach((p) => next.delete(p.id));
                              setSelectedIds(next);
                            }
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          aria-label="Pilih semua produk terhapus"
                        />
                      </th>
                    )}
                    <th className={styles.hideOnMobile}>Gambar</th>
                    <th>Nama Produk</th>
                    <th className={styles.hideOnMobile}>Kategori & Ukuran</th>
                    <th>Harga</th>
                    <th>Status Stok</th>
                    <th>Terjual</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((product) => (
                    <tr key={product.id} className={styles.tableRow}>
                      {isSelectMode && (
                        <td style={{ width: '38px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(product.id)) next.delete(product.id);
                                else next.add(product.id);
                                return next;
                              });
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            aria-label={`Pilih ${product.name}`}
                          />
                        </td>
                      )}
                      <td className={styles.hideOnMobile}>
                        <div className={styles.productThumb}>
                          {product.image ? (
                            <Image src={product.image} alt={product.name} fill style={{ objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'var(--border-color)', color: 'var(--text-muted)' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        <div>{product.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          ID: {product.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <div>{product.form || product.category || '-'}</div>
                      </td>
                      <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>{formatCurrency(product.price)}</td>
                      <td>
                        {product.quantity > 0 ? (
                          <span className={`${styles.badge} ${product.quantity <= 2 ? styles.badgeWarning : styles.badgeSuccess}`}>
                            Stok: {product.quantity}
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeMuted}`}>Habis</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.badge} style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                          {product.soldCount || 0}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          {canUpdate && (
                            <button
                              onClick={() => askRestore(product)}
                              className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                              title="Pulihkan ke Etalase"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1 4 1 10 7 10" />
                                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => askPermanentDelete(product)}
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
                  ))}
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
