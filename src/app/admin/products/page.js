'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import ManageableSelect from '@/components/admin/ManageableSelect';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import styles from '../dashboard/adminDashboard.module.css';

const DEFAULT_CATEGORIES = ['Plakat', 'Halfmoon', 'Crowntail', 'Giant', 'Double Tail', 'Dumbo Ear'];
const DEFAULT_GENDERS = ['Male', 'Female', 'Pair'];
const DEFAULT_GRADES = ['COMP', 'COMPETITION', 'A', 'B', 'C'];

const emptyProductForm = () => ({
  name: '',
  price: '',
  category: 'Plakat',
  gender: 'Male',
  form: 'Plakat',
  coloration: 'Multicolor',
  description: '',
  image: '/betta-1.png',
  isPremium: false,
  statsForm: 'COMP',
  age: '4 Month',
  statsSpirit: 'Aktif',
  quantity: 1,
  sizes: [],
});

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

export default function AdminProductsPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { products, addProduct, updateProduct, deleteProduct, isLoading: productsLoading } = useProducts();
  const router = useRouter();

  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [genders, setGenders] = useState(DEFAULT_GENDERS);
  const [grades, setGrades] = useState(DEFAULT_GRADES);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [form, setForm] = useState(emptyProductForm());

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (products.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive from products
      setCategories((prev) => {
        const s = new Set([...DEFAULT_CATEGORIES, ...prev]);
        products.forEach((p) => { if (p.form) s.add(p.form); });
        return Array.from(s);
      });
      setGenders((prev) => {
        const s = new Set([...DEFAULT_GENDERS, ...prev]);
        products.forEach((p) => { if (p.gender) s.add(p.gender); });
        return Array.from(s);
      });
      setGrades((prev) => {
        const s = new Set([...DEFAULT_GRADES, ...prev]);
        products.forEach((p) => { if (p.statsForm) s.add(p.statsForm); });
        return Array.from(s);
      });
    }
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = p.name.toLowerCase().includes(q) || (p.form && p.form.toLowerCase().includes(q));
      const matchCategory = categoryFilter === 'All' || p.form === categoryFilter;
      let matchStock = true;
      if (stockFilter === 'Ready') matchStock = p.quantity > 0;
      if (stockFilter === 'Sold') matchStock = p.quantity === 0;
      if (stockFilter === 'LowStock') matchStock = p.quantity > 0 && p.quantity <= 2;
      return matchSearch && matchCategory && matchStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');
      setForm((prev) => ({ ...prev, image: data.url }));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const openAdd = () => {
    setForm(emptyProductForm());
    setIsAddOpen(true);
  };

  const openEdit = (product) => {
    setCurrentEdit(product);
    let parsedSizes = [];
    try {
      if (product.sizes) {
        parsedSizes = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
      }
    } catch { /* ignore */ }
    setForm({
      name: product.name,
      price: product.price,
      category: product.category,
      gender: product.gender,
      form: product.form,
      coloration: product.coloration,
      description: product.description,
      image: product.image,
      isPremium: product.isPremium,
      statsForm: product.statsForm || 'COMP',
      age: product.age || '4 Month',
      statsSpirit: product.statsSpirit || 'Aktif',
      quantity: product.quantity ?? 1,
      sizes: parsedSizes || [],
    });
    setIsEditOpen(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addProduct(form);
      setIsAddOpen(false);
      setForm(emptyProductForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateProduct(currentEdit.id, form);
      setIsEditOpen(false);
      setCurrentEdit(null);
      setForm(emptyProductForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const askDelete = (product) => {
    confirm.open({
      title: 'Hapus Produk',
      desc: `Apakah Anda yakin ingin menghapus produk "${product.name}"? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        try {
          await deleteProduct(product.id);
        } catch (err) {
          alert(err.message);
        }
      },
    });
  };

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas Admin...</h2>
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
            <button
              onClick={openAdd}
              className="btn btn-primary"
              style={{ borderRadius: '30px', padding: '0.65rem 1.4rem' }}
            >
              + Tambah Produk
            </button>
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
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada produk yang sesuai dengan kriteria pencarian.
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
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className={styles.tableRow}>
                    <td className={styles.hideOnMobile}>
                      <div className={styles.productThumb}>
                        <Image src={product.image} alt={product.name} fill style={{ objectFit: 'cover' }} />
                      </div>
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      <div>{product.name}</div>
                      {product.isPremium && (
                        <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ marginTop: '0.2rem', fontSize: '0.7rem' }}>
                          ★ Premium
                        </span>
                      )}
                    </td>
                    <td className={styles.hideOnMobile}>
                      <div>{product.form} ({product.gender})</div>
                      {product.sizes && (() => {
                        try {
                          const parsed = typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes;
                          if (Array.isArray(parsed) && parsed.length > 0) {
                            return (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Size: {parsed.map((s) => `${s.size} (${s.quantity})`).join(', ')}
                              </div>
                            );
                          }
                        } catch { /* ignore */ }
                        return null;
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
                      <div className={styles.actionGroup}>
                        <button onClick={() => openEdit(product)} className={styles.iconBtn} title="Edit Produk">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button onClick={() => askDelete(product)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Hapus Produk">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
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
                <ManageableSelect
                  label="Gender"
                  value={form.gender}
                  onChange={(val) => setForm({ ...form, gender: val })}
                  options={genders}
                  setOptions={setGenders}
                />
              </div>

              <div>
                <label className={styles.formLabel}>Corak Warna (Coloration)</label>
                <input type="text" className={styles.formInput} value={form.coloration} onChange={(e) => setForm({ ...form, coloration: e.target.value })} required />
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel} style={{ textAlign: 'center' }}>Foto Produk</label>
                <div className={styles.uploadBox}>
                  <div className={styles.previewThumb}>
                    {form.image ? (
                      <Image src={form.image} alt="Preview" fill style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No Image</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="file" accept="image/*" onChange={handleFileUpload} id="product-image-upload" style={{ display: 'none' }} />
                    <label htmlFor="product-image-upload" className="btn btn-outline" style={{ cursor: 'pointer', padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: '30px' }}>
                      {isUploading ? 'Mengunggah...' : 'Pilih Foto dari Komputer'}
                    </label>
                    {uploadError && <p style={{ fontSize: '0.75rem', color: '#EF4444' }}>Error: {uploadError}</p>}
                  </div>
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
                  Kelola Ukuran (Size) & Jumlah Stok
                </label>
                <div style={{ background: 'rgba(255,255,255,0.015)', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {form.sizes && form.sizes.map((s, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.8rem', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Size (S, M, L)"
                        className={styles.formInput}
                        style={{ flex: '1 1 120px' }}
                        value={s.size}
                        onChange={(e) => {
                          const newSizes = [...form.sizes];
                          newSizes[index].size = e.target.value;
                          const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                          setForm({ ...form, sizes: newSizes, quantity: totalQty });
                        }}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Stok"
                        className={styles.formInput}
                        style={{ flex: '1 1 120px' }}
                        value={s.quantity}
                        min="0"
                        onChange={(e) => {
                          const newSizes = [...form.sizes];
                          newSizes[index].quantity = parseInt(e.target.value) || 0;
                          const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                          setForm({ ...form, sizes: newSizes, quantity: totalQty });
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ color: '#EF4444', borderColor: '#EF4444', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}
                        onClick={() => {
                          const newSizes = form.sizes.filter((_, idx) => idx !== index);
                          const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                          setForm({ ...form, sizes: newSizes, quantity: totalQty });
                        }}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: '100%', maxWidth: '300px', fontSize: '0.85rem', padding: '0.75rem', borderRadius: '30px', marginTop: form.sizes?.length > 0 ? '0.5rem' : 0 }}
                    onClick={() => {
                      const newSizes = [...(form.sizes || []), { size: '', quantity: 1 }];
                      const totalQty = newSizes.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
                      setForm({ ...form, sizes: newSizes, quantity: totalQty });
                    }}
                  >
                    + Tambah Baris Size & Stok
                  </button>
                </div>
              </div>

              <div>
                <label className={styles.formLabel}>Total Jumlah Produk (Dihitung Otomatis)</label>
                <input
                  type="number"
                  className={styles.formInput}
                  style={{ opacity: 0.7 }}
                  value={form.sizes?.length > 0 ? form.quantity : (form.quantity || 0)}
                  onChange={(e) => {
                    if (!form.sizes || form.sizes.length === 0) {
                      setForm({ ...form, quantity: parseInt(e.target.value) || 0 });
                    }
                  }}
                  readOnly={form.sizes?.length > 0}
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
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
