'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import ManageableSelect from '@/components/admin/ManageableSelect';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import BulkProductModal from '@/components/admin/BulkProductModal';
import ManageHierarchyModal from '@/components/admin/ManageHierarchyModal';
import { useToast } from '@/context/ToastContext';
import { canUser } from '@/lib/permission-utils';
import { parseYouTubeId } from '@/lib/productImages';
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
  media: [],
  videoUrl: '',
  isPremium: false,
  isDailyDrop: false,
  dropNumber: '',
  statsForm: 'COMP',
  age: '4 Month',
  statsSpirit: 'Aktif',
  quantity: 1,
  variants: [],
  soldCount: 0,
  departmentId: '',
  subCategoryId: '',
  brand: '',
  weight: 1000,
});

function getDepartmentIcon(slug, isLiveFish, customIcon) {
  if (customIcon && (customIcon.startsWith('/') || customIcon.startsWith('http'))) return customIcon;
  if (slug === 'all') return '/img/tab-dept-all.svg';
  if (slug === 'ikan-hias' || isLiveFish) return '/img/tab-dept-fish.svg';
  if (slug?.includes('alat') || slug?.includes('aquarium') || slug?.includes('peralatan')) return '/img/tab-dept-equipment.svg';
  if (slug?.includes('pakan') || slug?.includes('obat') || slug?.includes('nutrisi')) return '/img/tab-dept-feed.svg';
  return isLiveFish ? '/img/tab-dept-fish.svg' : '/img/tab-dept-equipment.svg';
}

function getSubCategoryIcon(slug = '', name = '', customImage = null) {
  if (customImage && (customImage.startsWith('/') || customImage.startsWith('http'))) return customImage;
  const s = `${slug} ${name}`.toLowerCase();
  if (s.includes('cupang') || s.includes('betta')) return '/img/tab-betta-multicolor.svg';
  if (s.includes('channa') || s.includes('chana') || s.includes('snakehead')) return '/img/tab-channa.svg';
  if (s.includes('guppy') || s.includes('gapi')) return '/img/tab-guppy.svg';
  if (s.includes('molly') || s.includes('moli')) return '/img/tab-molly.svg';
  if (s.includes('filter') || s.includes('aerator') || s.includes('pompa')) return '/img/tab-sub-filter.svg';
  if (s.includes('soliter') || s.includes('aquarium') || s.includes('tank')) return '/img/tab-sub-soliter.svg';
  if (s.includes('pakan') || s.includes('pelet') || s.includes('obat') || s.includes('vitamin')) return '/img/tab-sub-feed.svg';
  return null;
}

const formatCurrency = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

function AdminProductsInner() {
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

  // 3-Tier Hierarchy State
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [selectedSubCatId, setSelectedSubCatId] = useState('all');
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);

  const loadDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Mode pemilihan (Selection Mode): checkbox tersembunyi sampai tombol 'Pilih' diklik
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [form, setForm] = useState(emptyProductForm());

  const hasVariants = Array.isArray(form.variants) && form.variants.length > 0;
  const totalVariantStock = useMemo(() => {
    if (!hasVariants) return 0;
    return form.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
  }, [hasVariants, form.variants]);

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

  const activeDept = departments.find((d) => d.id === selectedDeptId);

  const deptCounts = useMemo(() => {
    const counts = { all: 0 };
    products.forEach((p) => {
      if (p.isArchived) return;
      counts.all += 1;
      const dId = p.departmentId || 'legacy';
      counts[dId] = (counts[dId] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Halaman ini khusus katalog produk aktif (bukan yang diarsipkan di Recycle Bin)
      if (p.isArchived) return false;

      // Filter Tingkat 1 (Departemen)
      if (selectedDeptId !== 'all') {
        if (p.departmentId) {
          if (p.departmentId !== selectedDeptId) return false;
        } else {
          // Legacy item without departmentId -> treat as Live Fish
          if (!activeDept?.isLiveFish) return false;
        }
      }

      // Filter Tingkat 2 (Sub-Kategori)
      if (selectedSubCatId !== 'all') {
        if (p.subCategoryId && p.subCategoryId !== selectedSubCatId) return false;
      }

      const q = search.toLowerCase();
      const matchSearch =
        p.name.toLowerCase().includes(q) ||
        (p.form && p.form.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const pForm = (p.form || '').trim().toLowerCase();
      const pCat = (p.category || '').trim().toLowerCase();
      const targetCat = categoryFilter.trim().toLowerCase();
      const matchCategory = categoryFilter === 'All' || pForm === targetCat || pCat === targetCat;

      let matchStock = true;
      if (stockFilter === 'Ready') matchStock = p.quantity > 0;
      if (stockFilter === 'Sold') matchStock = p.quantity === 0;
      if (stockFilter === 'LowStock') matchStock = p.quantity > 0 && p.quantity <= 2;

      return matchSearch && matchCategory && matchStock;
    });
  }, [products, search, categoryFilter, stockFilter, selectedDeptId, selectedSubCatId, activeDept]);

  // Upload satu ATAU banyak foto sekaligus, lalu tambahkan ke akhir galeri
  // Helper konversi item ke format media { id, type, url, thumbnail, ytId }
  const toMediaItem = (item, idx = 0) => {
    if (typeof item === 'string') {
      const s = item.trim();
      const ytId = parseYouTubeId(s);
      if (ytId || /\.(mp4|webm|mov)($|\?)/i.test(s)) {
        return { id: `vid-${idx}-${s}`, type: 'video', url: s, ytId, thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null };
      }
      return { id: `img-${idx}-${s}`, type: 'image', url: s, thumbnail: s };
    }
    if (item && typeof item === 'object') {
      const u = typeof item.url === 'string' ? item.url.trim() : '';
      const ytId = parseYouTubeId(u);
      if (item.type === 'video' || ytId) {
        return { id: item.id || `vid-${idx}-${u}`, type: 'video', url: u, ytId, thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null };
      }
      return { id: item.id || `img-${idx}-${u}`, type: 'image', url: u, thumbnail: u };
    }
    return null;
  };

  // Upload foto multi-file lalu masukkan ke media list
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
      const newItems = newUrls.map((u) => ({
        id: `img-${Date.now()}-${Math.random()}`,
        type: 'image',
        url: u,
        thumbnail: u,
      }));
      setForm((prev) => {
        const existing = Array.isArray(prev.media) ? prev.media : [];
        const merged = [...existing, ...newItems];
        const firstImg = merged.find((m) => m.type === 'image');
        return {
          ...prev,
          media: merged,
          image: firstImg?.url || prev.image,
          images: merged.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
        };
      });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Geser posisi media (foto atau video) ke kiri (-1) atau kanan (+1)
  const moveMedia = (index, dir) => {
    setForm((prev) => {
      const list = [...(prev.media || [])];
      const j = index + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[index], list[j]] = [list[j], list[index]];
      const firstImg = list.find((m) => m.type === 'image');
      return {
        ...prev,
        media: list,
        image: firstImg?.url || prev.image,
        images: list.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      };
    });
  };

  // Hapus item media (jika video dihapus, otomatis videoUrl dikosongkan)
  const removeMedia = (index) => {
    setForm((prev) => {
      const removed = (prev.media || [])[index];
      const list = (prev.media || []).filter((_, i) => i !== index);
      const firstImg = list.find((m) => m.type === 'image');
      const remainingVid = list.find((m) => m.type === 'video');
      return {
        ...prev,
        media: list,
        image: firstImg?.url || '',
        images: list.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
        videoUrl: remainingVid ? remainingVid.url : (removed?.type === 'video' ? '' : prev.videoUrl),
      };
    });
  };

  // Drag and drop reordering untuk semua media (foto dan video)
  const handleMediaDrop = (targetIndex) => {
    setForm((prev) => {
      if (dragIndex === null || dragIndex === targetIndex) return prev;
      const list = [...(prev.media || [])];
      const [moved] = list.splice(dragIndex, 1);
      list.splice(targetIndex, 0, moved);
      const firstImg = list.find((m) => m.type === 'image');
      return {
        ...prev,
        media: list,
        image: firstImg?.url || prev.image,
        images: list.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      };
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Tambah atau perbarui video di dalam urutan media
  const handleSetVideoUrl = (rawUrl) => {
    const trimmed = (rawUrl || '').trim();
    setForm((prev) => {
      const list = [...(prev.media || [])];
      const existingIdx = list.findIndex((m) => m.type === 'video');

      if (!trimmed) {
        if (existingIdx >= 0) list.splice(existingIdx, 1);
        const firstImg = list.find((m) => m.type === 'image');
        return {
          ...prev,
          media: list,
          videoUrl: '',
          image: firstImg?.url || prev.image,
          images: list.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
        };
      }

      const ytId = parseYouTubeId(trimmed);
      const videoObj = {
        id: existingIdx >= 0 ? list[existingIdx].id : `vid-${Date.now()}`,
        type: 'video',
        url: trimmed,
        ytId,
        thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null,
      };

      if (existingIdx >= 0) {
        list[existingIdx] = videoObj;
      } else {
        list.push(videoObj);
      }

      const firstImg = list.find((m) => m.type === 'image');
      return {
        ...prev,
        media: list,
        videoUrl: trimmed,
        image: firstImg?.url || prev.image,
        images: list.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      };
    });
  };

  const openAdd = () => {
    const defaultDept = (selectedDeptId !== 'all' ? departments.find((d) => d.id === selectedDeptId) : null) || departments[0] || null;
    const defaultSub = defaultDept?.subCategories?.[0] || null;
    setForm({
      ...emptyProductForm(),
      departmentId: defaultDept?.id || '',
      subCategoryId: defaultSub?.id || '',
    });
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

    let mediaItems = [];
    if (Array.isArray(parsedImages)) {
      for (const item of parsedImages) {
        const m = toMediaItem(item);
        if (m) mediaItems.push(m);
      }
    }
    if (product.videoUrl) {
      const vid = product.videoUrl.trim();
      const hasVid = mediaItems.some((m) => m.type === 'video' && m.url === vid);
      if (!hasVid) {
        const ytId = parseYouTubeId(vid);
        mediaItems.push({
          id: `vid-${product.id}`,
          type: 'video',
          url: vid,
          ytId,
          thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null,
        });
      }
    }
    if (mediaItems.length === 0 && product.image) {
      mediaItems.push({ id: `img-${product.id}`, type: 'image', url: product.image, thumbnail: product.image });
    }

    const firstImage = mediaItems.find((m) => m.type === 'image');
    const videoItem = mediaItems.find((m) => m.type === 'video');

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

    const initialQuantity = parsedVariants.length > 0
      ? parsedVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
      : (product.quantity ?? 1);

    setForm({
      name: product.name,
      price: product.price,
      category: product.category,
      form: product.form,
      coloration: product.coloration,
      description: product.description,
      image: firstImage?.url || product.image,
      images: mediaItems.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      media: mediaItems,
      videoUrl: videoItem?.url || product.videoUrl || '',
      isPremium: Boolean(product.isPremium),
      isDailyDrop: Boolean(product.isDailyDrop),
      dropNumber: product.dropNumber || '',
      statsForm: product.statsForm || 'COMP',
      age: product.age || '4 Month',
      statsSpirit: product.statsSpirit || 'Aktif',
      quantity: initialQuantity,
      variants: parsedVariants,
      soldCount: product.soldCount ?? 0,
      departmentId: product.departmentId || '',
      subCategoryId: product.subCategoryId || '',
      brand: product.brand || '',
      weight: product.weight || 1000,
    });
    setIsEditOpen(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const mediaList = form.media || [];
      const firstImage = mediaList.find((m) => m.type === 'image');
      const videoItem = mediaList.find((m) => m.type === 'video');
      const computedQuantity = hasVariants
        ? totalVariantStock
        : Math.max(0, parseInt(form.quantity) || 0);
      const payload = {
        ...form,
        quantity: computedQuantity,
        image: firstImage?.url || form.image,
        videoUrl: videoItem?.url || form.videoUrl || null,
        images: mediaList.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      };
      await addProduct(payload);
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
      const mediaList = form.media || [];
      const firstImage = mediaList.find((m) => m.type === 'image');
      const videoItem = mediaList.find((m) => m.type === 'video');
      const computedQuantity = hasVariants
        ? totalVariantStock
        : Math.max(0, parseInt(form.quantity) || 0);
      const payload = {
        ...form,
        quantity: computedQuantity,
        image: firstImage?.url || form.image,
        videoUrl: videoItem?.url || form.videoUrl || null,
        images: mediaList.map((m) => (m.type === 'video' ? { type: 'video', url: m.url } : m.url)),
      };
      await updateProduct(currentEdit.id, payload);
      setIsEditOpen(false);
      setCurrentEdit(null);
      setForm(emptyProductForm());
      toast.success('Perubahan produk berhasil disimpan.');
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui produk.');
    }
  };

  // Bulk: Hapus terpilih (dipindahkan ke Recycle Bin)
  const handleBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    confirm.open({
      title: 'Hapus Produk',
      desc: `Apakah Anda yakin ingin menghapus ${count} produk terpilih? Produk akan dipindahkan ke Recycle Bin.`,
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/products/bulk/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds), archive: true }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus produk.');
          toast.success(data.message || `${count} produk berhasil dihapus.`);
          setSelectedIds(new Set());
          setIsSelectMode(false);
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus produk.');
        }
      },
    });
  };

  // Single: Hapus produk (dipindahkan ke Recycle Bin)
  const askDelete = (product) => {
    confirm.open({
      title: 'Hapus Produk',
      desc: `Hapus produk "${product.name}"? Produk akan dipindahkan ke Recycle Bin dan dapat dipulihkan kapan saja.`,
      onConfirm: async () => {
        try {
          await deleteProduct(product.id);
          toast.success(`Produk "${product.name}" berhasil dihapus.`);
          if (fetchProducts) fetchProducts();
        } catch (err) {
          toast.error(err.message || 'Gagal menghapus produk.');
        }
      },
    });
  };

  const [isSyncingSold, setIsSyncingSold] = useState(false);

  // Sinkronkan soldCount dan sisa stok dari transaksi sah (PAID, PROCESSING, SHIPPED, COMPLETED)
  const handleSyncSold = () => {
    confirm.open({
      title: 'Sinkronkan Penjualan & Stok',
      desc: 'Sistem akan menghitung ulang jumlah terjual (sold count) sekaligus memotong sisa stok produk berdasarkan seluruh transaksi sah (Lunas, Diproses, Dikirim, Selesai).',
      confirmText: 'Sinkronkan',
      isDanger: false,
      onConfirm: async () => {
        setIsSyncingSold(true);
        try {
          const res = await fetch('/api/admin/products/sync-sold', { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menyinkronkan data.');
          toast.success(data.message || 'Sinkronisasi berhasil.');
          if (fetchProducts) fetchProducts({ showLoading: false });
        } catch (err) {
          toast.error(err.message || 'Gagal menyinkronkan data.');
        } finally {
          setIsSyncingSold(false);
        }
      },
    });
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

            {canUpdate && (
              <button
                type="button"
                onClick={handleSyncSold}
                disabled={isSyncingSold}
                className={styles.outlineBtn}
                title="Hitung ulang jumlah terjual dan potong sisa stok dari riwayat transaksi sah"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isSyncingSold ? styles.spinIcon : ''}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                {isSyncingSold ? 'Menyinkronkan...' : 'Sinkron Terjual & Stok'}
              </button>
            )}

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

        {/* Tingkat 1: Departemen Switcher Tabs */}
        <div className={styles.deptBarWrapper}>
          <div className={styles.deptTabsGroup}>
            <button
              type="button"
              className={`${styles.deptTabBtn} ${selectedDeptId === 'all' ? styles.deptTabBtnActive : ''}`}
              onClick={() => {
                setSelectedDeptId('all');
                setSelectedSubCatId('all');
              }}
            >
              <Image src="/img/tab-dept-all.svg" width={15} height={15} unoptimized alt="" className={styles.deptTabIcon} />
              Semua Departemen
              <span className={styles.deptTabBadge}>{deptCounts.all || 0}</span>
            </button>
            {departments.map((dept) => {
              const count = dept._count?.products || 0;
              const isActive = selectedDeptId === dept.id;
              const iconSrc = getDepartmentIcon(dept.slug, dept.isLiveFish, dept.icon);
              return (
                <button
                  key={dept.id}
                  type="button"
                  className={`${styles.deptTabBtn} ${isActive ? styles.deptTabBtnActive : ''}`}
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setSelectedSubCatId('all');
                  }}
                >
                  <Image src={iconSrc} width={15} height={15} unoptimized alt="" className={styles.deptTabIcon} />
                  {dept.name}
                  <span className={styles.deptTabBadge}>{count}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={styles.manageDeptBtn}
            onClick={() => setIsHierarchyModalOpen(true)}
            title="Atur Tingkat 1 (Departemen) dan Tingkat 2 (Sub-Kategori)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Kelola Departemen &amp; Kategori
          </button>
        </div>

        {/* Tingkat 2: Sub-Kategori Filter Chips (ketika departemen spesifik dipilih) */}
        {activeDept && activeDept.subCategories && activeDept.subCategories.length > 0 && (
          <div className={styles.subCatChipsBar}>
            <button
              type="button"
              className={`${styles.subCatChip} ${selectedSubCatId === 'all' ? styles.subCatChipActive : ''}`}
              onClick={() => setSelectedSubCatId('all')}
            >
              <Image src="/img/tab-dept-all.svg" width={14} height={14} unoptimized alt="" className={styles.subCatChipIcon} />
              Semua {activeDept.name}
            </button>
            {activeDept.subCategories.map((sub) => {
              const isActive = selectedSubCatId === sub.id;
              const count = sub._count?.products || 0;
              const subIcon = getSubCategoryIcon(sub.slug, sub.name, sub.image);
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`${styles.subCatChip} ${isActive ? styles.subCatChipActive : ''}`}
                  onClick={() => setSelectedSubCatId(sub.id)}
                >
                  {subIcon && <Image src={subIcon} width={14} height={14} unoptimized alt="" className={styles.subCatChipIcon} />}
                  {sub.name}
                  <span className={styles.subCatChipBadge}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

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
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Memuat produk...</p>
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
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Tidak ada produk yang cocok dengan pencarian &ldquo;{search}&rdquo;.</p>
              </>
            ) : (
              <>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: '0.25rem' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>Belum Ada Produk</h3>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Katalog produk aktif masih kosong.</p>
                {canCreate && (
                  <button type="button" onClick={openAdd} className={styles.primaryBtn} style={{ marginTop: '0.5rem' }}>
                    Tambah Produk
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {isSelectMode && selectedIds.size > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkBarCount}>{selectedIds.size} produk terpilih</span>


                {canDelete && (
                  <button
                    type="button"
                    className={styles.bulkBtnDanger}
                    onClick={handleBulkDelete}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Hapus ({selectedIds.size})
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
                          aria-label="Pilih semua produk"
                        />
                      </th>
                    )}
                    <th className={styles.hideOnMobile}>Gambar</th>
                    <th>Nama Produk</th>
                    <th className={styles.hideOnMobile}>
                      {activeDept?.isLiveFish === false ? 'Sub-Kategori & Merk' : 'Kategori & Ukuran'}
                    </th>
                    {activeDept?.isLiveFish === false && <th className={styles.hideOnMobile}>Berat</th>}
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
                        {selectedDeptId === 'all' && (
                          <span className={product.department?.isLiveFish === false ? styles.cellTagGoods : styles.cellTagLive}>
                            {product.department?.name || 'Ikan Hias'}
                          </span>
                        )}
                        {product.isDailyDrop && (
                          <span
                            className={styles.badge}
                            style={{
                              fontSize: '0.7rem',
                              background: 'rgba(0, 136, 204, 0.12)',
                              color: '#0088cc',
                              border: '1px solid rgba(0, 136, 204, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                            Drop {product.dropNumber || '24 Jam'}
                            {product.bookedBy && ` (Booked: @${product.bookedBy})`}
                          </span>
                        )}
                        {product.isPremium ? (
                          <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ fontSize: '0.7rem' }}>
                            ✦ Premium
                          </span>
                        ) : (
                          <span className={styles.badge} style={{ fontSize: '0.7rem' }}>
                            Reguler
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.hideOnMobile}>
                      {product.department?.isLiveFish === false ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{product.subCategory?.name || product.category || 'Peralatan'}</div>
                          {product.brand && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.15rem' }}>
                              Merk: {product.brand}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div>{product.form}</div>
                          {product.coloration && product.coloration !== 'Standard' && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{product.coloration}</div>
                          )}
                        </div>
                      )}
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
                    {activeDept?.isLiveFish === false && (
                      <td className={styles.hideOnMobile} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {product.weight ? `${product.weight} gr` : '1.000 gr'}
                      </td>
                    )}
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
                          <button onClick={() => openEdit(product)} className={styles.iconBtn} title="Edit">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => askDelete(product)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Hapus">
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
        </>
      )}

      </div>

      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.productModalContainer}>
            <div className={styles.productModalHeader}>
              <div>
                <span className={styles.productModalEyebrow}>Katalog Produk</span>
                <h3 className={styles.productModalTitle}>
                  {isAddOpen ? 'Tambah Produk Baru' : 'Edit Detail Produk'}
                </h3>
                <p className={styles.productModalSubtitle}>
                  Kelola foto, video, harga, dan varian koleksi ikan cupang.
                </p>
              </div>
              <button
                type="button"
                className={styles.productModalCloseBtn}
                onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                aria-label="Tutup modal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleAdd : handleEditSubmit} className={styles.productModalBody}>
              {/* Section 1: Informasi Dasar */}
              <div className={styles.formCard}>
                <div className={styles.formCardHeader}>
                  <h4 className={styles.formCardTitle}>Informasi Dasar</h4>
                  <p className={styles.formCardDesc}>Identitas utama produk yang tampil di etalase dan pencarian.</p>
                </div>

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Nama Produk</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    placeholder="Contoh: Super Black Samurai Tail / Soliter Kaca 15x15"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                {/* Tingkat 1 (Departemen) & Tingkat 2 (Sub-Kategori) */}
                <div className={styles.formGridTwo}>
                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>Tingkat 1: Departemen Utama</label>
                    <select
                      className={styles.fieldInput}
                      value={form.departmentId || ''}
                      onChange={(e) => {
                        const dId = e.target.value;
                        const d = departments.find((x) => x.id === dId);
                        const firstSub = d?.subCategories?.[0]?.id || '';
                        setForm({
                          ...form,
                          departmentId: dId,
                          subCategoryId: firstSub,
                          category: d?.isLiveFish ? form.category : (d?.subCategories?.[0]?.name || 'Peralatan'),
                        });
                      }}
                      required
                    >
                      <option value="" disabled>-- Pilih Departemen --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.isLiveFish ? 'Ikan Hidup' : 'Barang Kering / Alat'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>Tingkat 2: Jenis / Sub-Kategori</label>
                    <select
                      className={styles.fieldInput}
                      value={form.subCategoryId || ''}
                      onChange={(e) => {
                        const sId = e.target.value;
                        const currentDept = departments.find((d) => d.id === form.departmentId) || departments[0];
                        const s = currentDept?.subCategories?.find((x) => x.id === sId);
                        setForm({
                          ...form,
                          subCategoryId: sId,
                          category: s?.name || form.category,
                        });
                      }}
                      required
                    >
                      <option value="" disabled>-- Pilih Sub-Kategori --</option>
                      {(departments.find((d) => d.id === form.departmentId) || departments[0])?.subCategories?.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Spesifikasi Khusus: Ikan Hidup vs Barang Kering */}
                {(departments.find((d) => d.id === form.departmentId)?.isLiveFish !== false) ? (
                  <>
                    <div className={styles.formGridTwo}>
                      <div className={styles.formField}>
                        <ManageableSelect
                          label="Kategori Form"
                          value={form.category}
                          onChange={(val) => setForm({ ...form, category: val, form: val })}
                          options={categories}
                          setOptions={setCategories}
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.fieldLabel}>Corak Warna (Coloration)</label>
                        <input
                          type="text"
                          className={styles.fieldInput}
                          placeholder="Contoh: Multicolor, Nemo Candy"
                          value={form.coloration}
                          onChange={(e) => setForm({ ...form, coloration: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className={styles.formGridTwo}>
                      <div className={styles.formField}>
                        <ManageableSelect
                          label="Grade Bentuk"
                          value={form.statsForm}
                          onChange={(val) => setForm({ ...form, statsForm: val })}
                          options={grades}
                          setOptions={setGrades}
                        />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.fieldLabel}>Umur (Age)</label>
                        <input
                          type="text"
                          className={styles.fieldInput}
                          placeholder="Contoh: 4 Month, 5 Bulan"
                          value={form.age}
                          onChange={(e) => setForm({ ...form, age: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.formGridTwo}>
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Merk / Brand Produk</label>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        placeholder="Contoh: Sumde Aquatics, Sobo, Hikari"
                        value={form.brand || ''}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.fieldLabel}>Berat Pengiriman (Gram)</label>
                      <input
                        type="number"
                        min="50"
                        className={styles.fieldInput}
                        placeholder="Contoh: 500 (untuk kalkulasi ongkir kurir)"
                        value={form.weight || 1000}
                        onChange={(e) => setForm({ ...form, weight: Math.max(50, parseInt(e.target.value) || 1000) })}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>Deskripsi Produk</label>
                  <textarea
                    className={styles.fieldTextarea}
                    placeholder="Tuliskan spesifikasi, keunggulan genetik, dan catatan pengiriman..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Section 2: Galeri Media (Foto & Video) */}
              <div className={styles.formCard}>
                <div className={styles.formCardHeader}>
                  <h4 className={styles.formCardTitle}>Galeri Media (Foto & Video)</h4>
                  <p className={styles.formCardDesc}>
                    Atur urutan foto dan video dengan menyeret (drag) atau tombol panah. Foto pertama otomatis menjadi COVER utama.
                  </p>
                </div>

                <div className={styles.mediaToolbar}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    id="product-image-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="product-image-upload" className={styles.mediaAddBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    {isUploading ? 'Mengunggah...' : '+ Upload Foto'}
                  </label>
                </div>

                {/* Video Input Row */}
                <div className={styles.videoInputRow}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Masukkan URL Video Ikan (YouTube atau link video MP4)..."
                    className={styles.fieldInput}
                    value={form.videoUrl || ''}
                    onChange={(e) => handleSetVideoUrl(e.target.value)}
                  />
                  {form.videoUrl && (
                    <button
                      type="button"
                      className={styles.outlineBtn}
                      onClick={() => handleSetVideoUrl('')}
                      title="Hapus video"
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem', flexShrink: 0 }}
                    >
                      Hapus Video
                    </button>
                  )}
                </div>

                {uploadError && (
                  <div style={{ color: 'var(--status-error)', fontSize: '0.8rem' }}>
                    Error unggah: {uploadError}
                  </div>
                )}

                {/* Unified Media Grid */}
                {form.media && form.media.length > 0 && (
                  <div className={styles.mediaGrid}>
                    {form.media.map((item, index) => {
                      const isCover = index === 0 && item.type === 'image';
                      const isVideo = item.type === 'video';
                      const tileClass = [
                        styles.mediaTile,
                        isCover && styles.mediaTileCover,
                        dragOverIndex === index && styles.mediaTileDragOver,
                        dragIndex === index && styles.mediaTileDragging,
                      ].filter(Boolean).join(' ');

                      return (
                        <div
                          key={item.id || `${item.url}-${index}`}
                          draggable
                          onDragStart={() => setDragIndex(index)}
                          onDragOver={(e) => { e.preventDefault(); if (dragOverIndex !== index) setDragOverIndex(index); }}
                          onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
                          onDrop={() => handleMediaDrop(index)}
                          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                          className={tileClass}
                          title="Seret untuk mengubah urutan"
                        >
                          {isVideo ? (
                            item.thumbnail ? (
                              <Image
                                src={item.thumbnail}
                                alt="Thumbnail Video"
                                fill
                                sizes="110px"
                                draggable={false}
                                className={styles.mediaTileImg}
                              />
                            ) : (
                              <div className={styles.videoTilePlaceholder}>
                                <div className={styles.videoTilePlayIcon}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                </div>
                                <span style={{ fontSize: '0.625rem' }}>Video</span>
                              </div>
                            )
                          ) : (
                            <Image
                              src={item.url}
                              alt={`Foto ${index + 1}`}
                              fill
                              sizes="110px"
                              draggable={false}
                              className={styles.mediaTileImg}
                            />
                          )}

                          {isCover && (
                            <span className={styles.mediaBadgeCover}>COVER</span>
                          )}

                          {isVideo && (
                            <span className={styles.mediaBadgeVideo}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              VIDEO
                            </span>
                          )}

                          <div className={styles.mediaControlsBar}>
                            <button
                              type="button"
                              title="Geser ke kiri"
                              aria-label="Geser ke kiri"
                              disabled={index === 0}
                              onClick={() => moveMedia(index, -1)}
                              className={styles.mediaControlBtn}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <button
                              type="button"
                              title="Hapus media"
                              aria-label="Hapus media"
                              onClick={() => removeMedia(index)}
                              className={`${styles.mediaControlBtn} ${styles.mediaControlBtnDelete}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                            <button
                              type="button"
                              title="Geser ke kanan"
                              aria-label="Geser ke kanan"
                              disabled={index === form.media.length - 1}
                              onClick={() => moveMedia(index, 1)}
                              className={styles.mediaControlBtn}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Harga & Manajemen Varian */}
              <div className={styles.formCard}>
                <div className={styles.formCardHeader}>
                  <h4 className={styles.formCardTitle}>Harga & Varian Ikan</h4>
                  <p className={styles.formCardDesc}>
                    Tetapkan harga dasar atau atur varian (Male, Female, Pair) dengan stok dan foto terpisah.
                  </p>
                </div>

                <div className={styles.formGridTwo}>
                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>Harga Dasar (Rp)</label>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      placeholder="Contoh: 350000"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>
                      Total Stok
                      <span className={styles.fieldOptional}>
                        {hasVariants ? '(Otomatis dari total varian aktif)' : '(Stok produk tunggal)'}
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={styles.fieldInput}
                      value={hasVariants ? totalVariantStock : (form.quantity ?? '')}
                      onChange={(e) => {
                        if (!hasVariants) {
                          setForm({
                            ...form,
                            quantity: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0),
                          });
                        }
                      }}
                      disabled={hasVariants}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                {/* Variants Table */}
                <div className={styles.variantContainer}>
                  <div className={styles.variantHeaderBar}>
                    <label className={styles.variantHeading}>Daftar Varian Produk</label>
                    <button
                      type="button"
                      className={`${styles.outlineBtn} ${styles.variantAddBtn}`}
                      onClick={() => {
                        const updated = [...(form.variants || []), { size: '', stock: 1, price: '', imageUrl: '' }];
                        const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                        setForm({ ...form, variants: updated, quantity: total });
                      }}
                    >
                      + Tambah Varian
                    </button>
                  </div>

                  {hasVariants && (
                    <>
                      <div className={styles.variantHeaderRow}>
                        <span>Nama Varian</span>
                        <span>Stok</span>
                        <span>Harga Khusus (Opsional)</span>
                        <span>Foto Varian</span>
                        <span>Aksi</span>
                      </div>

                      {form.variants.map((v, index) => (
                        <div key={index} className={styles.variantItemRow}>
                          <input
                            type="text"
                            placeholder="Contoh: Male / Female / Pair"
                            className={styles.fieldInput}
                            value={v.size}
                            onChange={(e) => {
                              const updated = [...form.variants];
                              updated[index] = { ...updated[index], size: e.target.value };
                              setForm({ ...form, variants: updated });
                            }}
                            required
                          />
                          <input
                            type="number"
                            placeholder="Stok"
                            min="0"
                            className={styles.fieldInput}
                            value={v.stock}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                              const updated = [...form.variants];
                              updated[index] = { ...updated[index], stock: val };
                              const total = updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0);
                              setForm({ ...form, variants: updated, quantity: total });
                            }}
                            required
                          />
                          <input
                            type="number"
                            placeholder={`Default (${form.price || '—'})`}
                            min="0"
                            className={styles.fieldInput}
                            value={v.price}
                            onChange={(e) => {
                              const updated = [...form.variants];
                              updated[index] = { ...updated[index], price: e.target.value };
                              setForm({ ...form, variants: updated });
                            }}
                          />
                          <select
                            className={styles.fieldInput}
                            value={v.imageUrl || ''}
                            onChange={(e) => {
                              const updated = [...form.variants];
                              updated[index] = { ...updated[index], imageUrl: e.target.value };
                              setForm({ ...form, variants: updated });
                            }}
                          >
                            <option value="">Foto Utama</option>
                            {form.media?.filter((m) => m.type === 'image').map((img, i) => (
                              <option key={img.url} value={img.url}>Foto #{i + 1}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.variantDeleteBtn}
                            onClick={() => {
                              const updated = form.variants.filter((_, i) => i !== index);
                              const total = updated.length > 0
                                ? updated.reduce((s, x) => s + (parseInt(x.stock) || 0), 0)
                                : (form.quantity > 0 ? form.quantity : 1);
                              setForm({ ...form, variants: updated, quantity: total });
                            }}
                            title="Hapus varian"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Section 4: Pengaturan Tambahan & Status Drop */}
              <div className={styles.formCard}>
                <div className={styles.formCardHeader}>
                  <h4 className={styles.formCardTitle}>Pengaturan Tambahan</h4>
                  <p className={styles.formCardDesc}>Pengaturan promosi, kode drop Telegram, dan tampilan produk.</p>
                </div>

                <div className={styles.formGridTwo}>
                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>
                      Kode / Nomor Drop
                      <span className={styles.fieldOptional}>(Contoh: #01)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: #01"
                      className={styles.fieldInput}
                      value={form.dropNumber || ''}
                      onChange={(e) => setForm({ ...form, dropNumber: e.target.value })}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label className={styles.fieldLabel}>
                      Terjual (Display Counter)
                      <span className={styles.fieldOptional}>(Tampilan etalase saja)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={styles.fieldInput}
                      value={form.soldCount ?? 0}
                      onChange={(e) => setForm({ ...form, soldCount: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                </div>

                <div className={styles.switchGroup}>
                  <label className={styles.switchOption}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={form.isPremium}
                      onChange={(e) => setForm({ ...form, isPremium: e.target.checked })}
                    />
                    <span>Koleksi Premium (Tagline Premium Khusus)</span>
                  </label>

                  <label className={styles.switchOption}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={form.isDailyDrop}
                      onChange={(e) => setForm({ ...form, isDailyDrop: e.target.checked })}
                    />
                    <span>Aktifkan Daily Drop 24 Jam</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.productModalFooter}>
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                  className={styles.outlineBtn}
                >
                  Batal
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  {isAddOpen ? 'Tambah Produk' : 'Simpan Perubahan'}
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
      <ManageHierarchyModal
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        onHierarchyUpdated={() => {
          loadDepartments();
          fetchProducts();
        }}
      />
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <Suspense fallback={null}>
      <AdminProductsInner />
    </Suspense>
  );
}
