'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import ManageableSelect from '@/components/admin/ManageableSelect';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import BulkProductModal from '@/components/admin/BulkProductModal';
import { useToast } from '@/context/ToastContext';
import { canUser } from '@/lib/permission-utils';
import styles from '../dashboard/adminDashboard.module.css';

const DEFAULT_CATEGORIES = ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'];
const DEFAULT_GRADES = ['COMP', 'COMPETITION', 'A', 'B', 'C'];

const emptyProductForm = () => ({
  name: '',
  price: '',
  category: 'Plakat',
  form: 'Plakat',
  coloration: 'Multicolor',
  description: '',
  image: '/img/betta-1.png',
  images: [],
  isPremium: false,
  statsForm: 'COMP',
  age: '4 Month',
  statsSpirit: 'Aktif',
  quantity: 1,
  variants: [],
  soldCount: 0,
});

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export default function AdminProductsPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { products, addProduct, updateProduct, deleteProduct, isLoading: productsLoading, fetchProducts } = useProducts();
  const { toast } = useToast();
  const router = useRouter();

  const canView = canUser(currentUser, 'products:view');
  const canCreate = canUser(currentUser, 'products:create');
  const canUpdate = canUser(currentUser, 'products:update');
  const canDelete = canUser(currentUser, 'products:delete');
  const canImport = canUser(currentUser, 'products:import');

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [grades, setGrades] = useState(DEFAULT_GRADES);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [form, setForm] = useState(emptyProductForm());

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Drag-and-drop urutan foto: index yang sedang ditarik & target hover.
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || !canView)) {
      router.push('/admin/dashboard');
    }
  }, [currentUser, authLoading, canView, router]);

  useEffect(() => {
    if (products.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive from products
      setCategories((prev) => {
        const s = new Set(prev);
        products.forEach((p) => {
          if (p.form) s.add(p.form.trim());
          if (p.category) s.add(p.category.trim());
        });
        return Array.from(s);
      });
      setGrades((prev) => {
        const s = new Set(prev);
        products.forEach((p) => { if (p.statsForm) s.add(p.statsForm.trim()); });
        return Array.from(s);
      });
    }
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || (p.form && p.form.toLowerCase().includes(q));

      const pForm = (p.form || '').trim().toLowerCase();
      const pCat = (p.category || '').trim().toLowerCase();
      const targetCat = categoryFilter.trim().toLowerCase();
      const matchCategory = categoryFilter === 'All' || pForm === targetCat || pCat === targetCat;

      let matchStock = true;
      if (stockFilter === 'Ready') matchStock = p.quantity > 0;
      if (stockFilter === 'Sold') matchStock = p.quantity === 0;
      if (stockFilter === 'LowStock') matchStock = p.quantity > 0 && p.quantity <= 2;

      let matchStatus = true;
      if (statusFilter === 'active') matchStatus = !p.isArchived;
      if (statusFilter === 'archived') matchStatus = Boolean(p.isArchived);

      return matchSearch && matchCategory && matchStock && matchStatus;
    });
  }, [products, search, categoryFilter, stockFilter, statusFilter]);

  // Upload satu ATAU banyak foto sekaligus, lalu tambahkan ke akhir galeri
  // (urutan = urutan tampil). Cover selalu disinkron ke foto pertama.
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError('');
    const fd = new FormData();
    files.forEach((f) => fd.append('file', f));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');
      const newUrls = data.urls || (data.url ? [data.url] : []);
      setForm((prev) => {
        const existing = Array.isArray(prev.images) ? prev.images : [];
        const merged = [...existing, ...newUrls];
        return { ...prev, images: merged, image: merged[0] || prev.image };
      });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
      // Reset input supaya memilih file yang sama lagi tetap memicu onChange.
      e.target.value = '';
    }
  };

  // Geser posisi foto (dir -1 = kiri, +1 = kanan). Foto index 0 = cover.
  const moveImage = (index, dir) => {
    setForm((prev) => {
      const imgs = [...(prev.images || [])];
      const j = index + dir;
      if (j < 0 || j >= imgs.length) return prev;
      [imgs[index], imgs[j]] = [imgs[j], imgs[index]];
      return { ...prev, images: imgs, image: imgs[0] || prev.image };
    });
  };

  const removeImage = (index) => {
    setForm((prev) => {
      const imgs = (prev.images || []).filter((_, i) => i !== index);
      return { ...prev, images: imgs, image: imgs[0] || '' };
    });
  };

  // Pindahkan foto dari posisi drag ke posisi target (tarik-lepas).
  const handleImageDrop = (targetIndex) => {
    setForm((prev) => {
      if (dragIndex === null || dragIndex === targetIndex) return prev;
      const imgs = [...(prev.images || [])];
      const [moved] = imgs.splice(dragIndex, 1);
      imgs.splice(targetIndex, 0, moved);
      return { ...prev, images: imgs, image: imgs[0] || prev.image };
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const openAdd = () => {
    setForm(emptyProductForm());
    setIsAddOpen(true);
  };

  const openEdit = (product) => {
    setCurrentEdit(product);
    let parsedImages = [];
    try {
      if (product.images) {
        parsedImages = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
      }
    } catch { /* ignore */ }
    if (!Array.isArray(parsedImages) || parsedImages.length === 0) {
      parsedImages = product.image ? [product.image] : [];
    }
    const parsedVariants = (Array.isArray(product.variants) && product.variants.length > 0)
      ? product.variants.map((v) => ({
          id: v.id,
          size: v.size,
          stock: v.stock,
          price: v.price ?? '',
          imageUrl: v.imageUrl ?? '',
        }))
      : (() => {
          try {
            if (product.sizes) {
              const s = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
              if (Array.isArray(s)) {
                return s.map((item) => ({
                  size: item.size || '',
                  stock: parseInt(item.quantity) || 0,
                  price: '',
                  imageUrl: '',
                }));
              }
            }
          } catch { }
          return [];
        })();
    setForm({
      name: product.name,
      price: product.price,
      category: product.category,
      form: product.form,
      coloration: product.coloration,
      description: product.description,
      image: parsedImages[0] || product.image,
      images: parsedImages,
      isPremium: product.isPremium,
      statsForm: product.statsForm || 'COMP',
      age: product.age || '4 Month',
      statsSpirit: product.statsSpirit || 'Aktif',
      quantity: product.quantity ?? 1,
      variants: parsedVariants,
      soldCount: product.soldCount ?? 0,
    });
    setIsEditOpen(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addProduct(form);
      setIsAddOpen(false);
      setForm(emptyProductForm());
      toast.success('Produk baru berhasil ditambahkan.');
    } catch (err) {
      toast.error(err.message || 'Gagal menambah produk.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateProduct(currentEdit.id, form);
      setIsEditOpen(false);
      setCurrentEdit(null);
      setForm(emptyProductForm());
      toast.success('Perubahan produk berhasil disimpan.');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui produk.');
    }
  };

  const askDelete = (product) => {
    confirm.open({
      title: 'Hapus Produk',
      desc: `Apakah Anda yakin ingin menghapus produk "${product.name}"? Jika produk memiliki riwayat transaksi, produk akan otomatis diarsipkan agar data invoice pelanggan tetap aman.`,
      onConfirm: async () => {
        try {
          const res = await deleteProduct(product.id);
          if (res && res.archived) {
            toast.info(`Produk "${product.name}" diarsipkan karena memiliki riwayat transaksi.`);
          } else {
            toast.success(`Produk "${product.name}" berhasil dihapus.`);
          }
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus produk.');
        }
      },
    });
  };

  const handleRestore = async (product) => {
    try {
      await updateProduct(product.id, { isArchived: false });
      toast.success(`Produk "${product.name}" berhasil dipulihkan ke etalase toko.`);
    } catch (err) {
      toast.error(err.message || 'Gagal memulihkan produk.');
    }
  };

  if (authLoading || !currentUser || !canView) {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas Produk...</h2>
      </div>
    );
  }

  const isModalOpen = isAddOpen || isEditOpen;

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Master Data</span>
            <h1 className={styles.headerTitle}>Kelola Produk</h1>
          </div>
          <div className={styles.headerButtons}>
            {canImport && (
              <button
                type="button"
                onClick={() => setIsBulkOpen(true)}
                className={styles.outlineBtn}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Massal
              </button>
            )}
            {canCreate && (
              <button
                onClick={openAdd}
                className={styles.primaryBtn}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Produk
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
              placeholder="Cari nama produk atau jenis form..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.selectInput}>
              <option value="active">Status: Aktif</option>
              <option value="archived">Status: Diarsipkan</option>
              <option value="all">Status: Semua</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.selectInput}>
              <option value="All">Semua Kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className={styles.selectInput}>
              <option value="All">Semua Status Stok</option>
              <option value="Ready">Tersedia (Ready)</option>
              <option value="LowStock">Stok Menipis (≤ 2)</option>
              <option value="Sold">Terjual / Habis</option>
            </select>
          </div>
        </div>

        {productsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Memuat produk...</p>
        ) : filtered.length === 0 ? (
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {statusFilter === 'archived'
              ? 'Tidak ada produk yang diarsipkan.'
              : search
              ? `Tidak ada produk yang cocok dengan pencarian "${search}".`
              : 'Tidak ada produk yang sesuai dengan kriteria pencarian.'}
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
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
                    <td className={styles.hideOnMobile}>
                      <div className={styles.productThumb}>
                        {product.image ? (
                          <Image src={product.image} alt={product.name} fill style={{ objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'var(--border-color)', color: 'var(--text-muted)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                              <circle cx="9" cy="9" r="2"/>
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      <div>{product.name}</div>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {product.isPremium && (
                          <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ fontSize: '0.7rem' }}>
                            ★ Premium
                          </span>
                        )}
                        {product.isArchived && (
                          <span className={`${styles.badge} ${styles.badgeMuted}`} style={{ fontSize: '0.7rem' }}>
                            Diarsipkan
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.hideOnMobile}>
                      <div>{product.form}</div>
                      {(() => {
                        const vList = (Array.isArray(product.variants) && product.variants.length > 0)
                          ? product.variants.map((v) => `${v.size} (${v.stock}${v.price ? ' • ' + formatCurrency(v.price) : ''})`)
                          : (() => {
                              try {
                                const s = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
                                return Array.isArray(s) ? s.map((x) => `${x.size} (${x.quantity})`) : [];
                              } catch { return []; }
                            })();
                        if (vList.length === 0) return null;
                        return (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {vList.join(', ')}
                          </div>
                        );
                      })()}
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
                        {product.isArchived && canUpdate && (
                          <button onClick={() => handleRestore(product)} className={styles.iconBtn} title="Pulihkan Produk ke Etalase">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                              <path d="M3 3v5h5"/>
                            </svg>
                          </button>
                        )}
                        {canUpdate && (
                          <button onClick={() => openEdit(product)} className={styles.iconBtn} title="Edit Produk">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => askDelete(product)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Hapus Produk">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
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
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContainer}>
            <h3 className={styles.modalTitle}>{isAddOpen ? 'Tambah Produk Baru' : 'Edit Detail Produk'}</h3>
            <form onSubmit={isAddOpen ? handleAdd : handleEditSubmit} className={styles.formGrid}>
              <div className={styles.formFullWidth}>
                <label className={styles.formLabel}>Nama Produk</label>
                <input type="text" className={styles.formInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div>
                <label className={styles.formLabel}>Harga (Rupiah)</label>
                <input type="number" className={styles.formInput} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>

              <div>
                <ManageableSelect
                  label="Kategori Form"
                  value={form.category}
                  onChange={(val) => setForm({ ...form, category: val, form: val })}
                  options={categories}
                  setOptions={setCategories}
                />
              </div>

              <div>
                <label className={styles.formLabel}>Corak Warna (Coloration)</label>
                <input type="text" className={styles.formInput} value={form.coloration} onChange={(e) => setForm({ ...form, coloration: e.target.value })} required />
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel} style={{ textAlign: 'center' }}>Foto Produk (bisa lebih dari satu)</label>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>

                  {form.images && form.images.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '0.75rem', width: '100%' }}>
                      {form.images.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(e) => { e.preventDefault(); if (dragOverIndex !== index) setDragOverIndex(index); }}
                          onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
                          onDrop={() => handleImageDrop(index)}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          title="Seret untuk mengurutkan"
                          style={{ position: 'relative', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: `2px solid ${dragOverIndex === index ? 'var(--primary)' : (index === 0 ? 'var(--primary)' : 'var(--border-color)')}`, background: 'var(--bg-card)', cursor: 'grab', opacity: dragIndex === index ? 0.4 : 1, transition: 'opacity 0.15s ease, border-color 0.15s ease' }}
                        >
                          <Image src={url} alt={`Foto ${index + 1}`} fill sizes="96px" draggable={false} style={{ objectFit: 'cover' }} />

                          {index === 0 && (
                            <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--primary)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', letterSpacing: '0.03em' }}>
                              COVER
                            </span>
                          )}

                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.55)' }}>
                            <button
                              type="button"
                              title="Geser ke kiri"
                              aria-label="Geser ke kiri"
                              disabled={index === 0}
                              onClick={() => moveImage(index, -1)}
                              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5px 0', background: 'none', border: 'none', color: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.35 : 1 }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <button
                              type="button"
                              title="Hapus foto"
                              aria-label="Hapus foto"
                              onClick={() => removeImage(index)}
                              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5px 0', background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.15)', borderRight: '1px solid rgba(255,255,255,0.15)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                            <button
                              type="button"
                              title="Geser ke kanan"
                              aria-label="Geser ke kanan"
                              disabled={index === form.images.length - 1}
                              onClick={() => moveImage(index, 1)}
                              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5px 0', background: 'none', border: 'none', color: '#fff', cursor: index === form.images.length - 1 ? 'not-allowed' : 'pointer', opacity: index === form.images.length - 1 ? 0.35 : 1 }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} id="product-image-upload" style={{ display: 'none' }} />
                  <label htmlFor="product-image-upload" className={styles.pillOutlineBtn} style={{ cursor: 'pointer' }}>
                    {isUploading ? 'Mengunggah...' : (form.images?.length > 0 ? '+ Tambah Foto Lagi' : 'Pilih Foto dari Komputer')}
                  </label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0, maxWidth: '340px' }}>
                    Foto pertama (COVER) tampil sebagai thumbnail. Seret foto untuk mengurutkan (atau pakai tombol ◀ ▶) — user bisa geser galeri sesuai urutan ini.
                  </p>
                  {uploadError && <p style={{ fontSize: '0.75rem', color: 'var(--status-error)' }}>Error: {uploadError}</p>}
                </div>
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel}>Deskripsi Produk</label>
                <textarea
                  className={styles.formInput}
                  style={{ minHeight: '80px', resize: 'none' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <ManageableSelect
                  label="Grade Bentuk"
                  value={form.statsForm}
                  onChange={(val) => setForm({ ...form, statsForm: val })}
                  options={grades}
                  setOptions={setGrades}
                />
              </div>

              <div>
                <label className={styles.formLabel}>Umur (Age)</label>
                <input
                  type="text"
                  placeholder="Contoh: 4 Month, 5 Bulan"
                  className={styles.formInput}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formFullWidth} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <label className={styles.formLabel} style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-main)', textAlign: 'center', marginBottom: '1rem' }}>
                  Varian (Gender / Ukuran)
                </label>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {form.variants.map((v, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1.3fr 1.4fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Varian (Male, Female, Pair)"
                        className={styles.formInput}
                        value={v.size}
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[index] = { ...updated[index], size: e.target.value };
                          const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                          setForm({ ...form, variants: updated, quantity: total });
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Stok"
                        className={styles.formInput}
                        value={v.stock}
                        min="0"
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[index] = { ...updated[index], stock: parseInt(e.target.value) || 0 };
                          const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                          setForm({ ...form, variants: updated, quantity: total });
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder={`Harga (default: ${form.price || '—'})`}
                        className={styles.formInput}
                        value={v.price}
                        min="0"
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[index] = { ...updated[index], price: e.target.value };
                          setForm({ ...form, variants: updated });
                        }}
                      />
                      <select
                        className={styles.formInput}
                        value={v.imageUrl || ''}
                        onChange={(e) => {
                          const updated = [...form.variants];
                          updated[index] = { ...updated[index], imageUrl: e.target.value };
                          setForm({ ...form, variants: updated });
                        }}
                      >
                        <option value="">Foto Utama</option>
                        {form.images && form.images.map((img, i) => (
                          <option key={i} value={img}>Foto {i + 1}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.tableActionBtnDanger}
                        onClick={() => {
                          const updated = form.variants.filter((_, i) => i !== index);
                          const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                          setForm({ ...form, variants: updated, quantity: total });
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.outlineBtn}
                    style={{ width: '100%', maxWidth: '300px', marginTop: form.variants.length > 0 ? '0.25rem' : 0, alignSelf: 'center' }}
                    onClick={() => {
                      const updated = [...form.variants, { size: '', stock: 1, price: '', imageUrl: '' }];
                      const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                      setForm({ ...form, variants: updated, quantity: total });
                    }}
                  >
                    + Tambah Varian
                  </button>
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>Total Jumlah Produk (Dihitung Otomatis)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  style={{ opacity: 0.7 }}
                  value={form.variants.length > 0 ? form.quantity : (form.quantity || 0)}
                  onChange={(e) => {
                    if (!form.variants || form.variants.length === 0) {
                      setForm({ ...form, quantity: parseInt(e.target.value) || 0 });
                    }
                  }}
                  readOnly={form.variants.length > 0}
                />
              </div>

              <div>
                <label className={styles.formLabel}>
                  Terjual (Display)
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.35rem', fontWeight: 'normal' }}>
                    (Bisa diedit manual & tidak mengubah laporan keuangan)
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  className={styles.formInput}
                  value={form.soldCount ?? 0}
                  onChange={(e) => setForm({ ...form, soldCount: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.2rem' }}>
                <input
                  type="checkbox"
                  id="isPremiumCheck"
                  checked={form.isPremium}
                  onChange={(e) => setForm({ ...form, isPremium: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isPremiumCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>Ikan Premium</label>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                  className={styles.outlineBtn}
                  style={{ flex: 1, padding: '0.65rem' }}
                >
                  Batal
                </button>
                <button type="submit" className={styles.primaryBtn} style={{ flex: 1, padding: '0.65rem' }}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
      <BulkProductModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        onComplete={() => fetchProducts()}
      />
    </div>
  );
}
