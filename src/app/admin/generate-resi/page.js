'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canUser, getFirstAccessibleAdminRoute } from '@/lib/permission-utils';
import OfflineLabel from './OfflineLabel';
import { downloadOfflineWaybillTemplate, generateAutoTrackingCode, parseOfflineWaybillsExcel } from './excelHelper';
import styles from './generateResi.module.css';

const STORAGE_KEY = 'sumde_offline_waybills_queue';

const COURIER_OPTIONS = [
  { value: 'J&T Express', label: 'J&T Express' },
  { value: 'POS Indonesia', label: 'POS Indonesia' },
  { value: 'SiCepat', label: 'SiCepat' },
  { value: 'JNE Express', label: 'JNE Express' },
  { value: 'AnterAja', label: 'AnterAja' },
  { value: 'TIKI', label: 'TIKI' },
  { value: 'Kurir Toko / Travel', label: 'Kurir Toko / Travel / Bus' },
  { value: 'Lainnya', label: 'Lainnya / Manual' },
];

const INITIAL_SAMPLE = [
  {
    id: 'REF-OFF-100001',
    name: 'Budi Santoso',
    phone: '081234567890',
    address: 'Jl. Mawar No. 12 RT 03/RW 02, Kel. Sukamaju, Kec. Cilodong, Kota Depok, Jawa Barat 16415',
    courier: 'J&T Express',
    createdAt: new Date().toISOString(),
  },
];

function GenerateResiPageInner() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, confirmDialog } = useToast();
  const fileInputRef = useRef(null);

  const canAccess = canUser(currentUser, [
    'shipping:view',
    'shipping:manage',
    'shipping:pickup',
    'shipping:label',
    'orders:view',
  ]);

  // Antrean resi offline (disimpan di browser state + localStorage)
  const [items, setItems] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.warn('Gagal membaca localStorage:', err);
      }
    }
    return INITIAL_SAMPLE;
  });

  // ID resi yang sedang aktif di pratinjau live
  const [activePreviewId, setActivePreviewId] = useState(() => items[0]?.id || null);

  // ID resi yang sedang diedit (null jika mode input baru)
  const [editingId, setEditingId] = useState(null);

  // Target cetak: 'all' untuk semua resi, atau ID spesifik jika cetak satuan
  const [printTarget, setPrintTarget] = useState('all');

  // Form input
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    courier: 'J&T Express',
  });

  const [isUploading, setIsUploading] = useState(false);

  // Sinkronkan ke localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.warn('Gagal menyimpan ke localStorage:', err);
      }
    }
  }, [items]);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login');
      } else if (!canAccess) {
        const fallback = getFirstAccessibleAdminRoute((p) => canUser(currentUser, p));
        router.push(fallback || '/customer/dashboard');
      }
    }
  }, [currentUser, authLoading, canAccess, router]);

  // Item yang sedang tampil di live preview
  const activePreviewItem = useMemo(() => {
    return items.find((it) => it.id === activePreviewId) || items[0] || null;
  }, [items, activePreviewId]);

  // Item yang akan dicetak di @media print
  const printableItems = useMemo(() => {
    if (printTarget === 'all') return items;
    return items.filter((it) => it.id === printTarget);
  }, [items, printTarget]);

  // Mulai mode edit untuk item terpilih
  const handleStartEdit = (item) => {
    if (!item) return;
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      phone: item.phone || '',
      address: item.address || '',
      courier: item.courier || 'J&T Express',
    });
    setActivePreviewId(item.id);

    // Scroll halus ke formulir jika posisi di bawah
    const formCard = document.getElementById('resi-form-section');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Batalkan mode edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      courier: 'J&T Express',
    });
  };

  // Submit form (Tambah Baru atau Simpan Perubahan)
  const handleFormSubmit = (e) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();
    const cleanAddress = formData.address.trim();

    if (!cleanName) {
      toast.warning('Nama penerima wajib diisi.');
      return;
    }
    if (!cleanPhone) {
      toast.warning('Nomor telepon / WhatsApp wajib diisi.');
      return;
    }
    if (!cleanAddress) {
      toast.warning('Alamat lengkap pengiriman wajib diisi.');
      return;
    }

    if (editingId) {
      // Perbarui resi existing di antrean (Reference ID tetap dipertahankan)
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingId
            ? {
                ...it,
                name: cleanName,
                phone: cleanPhone,
                address: cleanAddress,
                courier: formData.courier,
              }
            : it
        )
      );
      toast.success(`Data resi untuk ${cleanName} berhasil diperbarui.`);
      setEditingId(null);
    } else {
      // Tambah resi baru (Reference ID 100% unik dibuat otomatis oleh sistem)
      const existingIds = items.map((it) => it.id);
      const refId = generateAutoTrackingCode('REF-OFF', existingIds);
      const newItem = {
        id: refId,
        name: cleanName,
        phone: cleanPhone,
        address: cleanAddress,
        courier: formData.courier,
        service: 'Reguler',
        createdAt: new Date().toISOString(),
      };

      setItems((prev) => [newItem, ...prev]);
      setActivePreviewId(newItem.id);
      toast.success(`Resi untuk ${cleanName} ditambahkan ke antrean.`);
    }

    // Reset form field
    setFormData({
      name: '',
      phone: '',
      address: '',
      courier: formData.courier,
    });
  };

  // Hapus single item
  const handleDeleteItem = (id, name) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    toast.info(`Resi ${name || ''} dihapus dari daftar.`);
  };

  // Kosongkan seluruh antrean
  const handleClearAll = async () => {
    if (items.length === 0) return;
    const confirmed = await confirmDialog({
      title: 'Kosongkan Antrean Resi',
      message: `Hapus seluruh ${items.length} resi dari daftar antrean cetak?`,
      confirmText: 'Kosongkan',
      isDanger: true,
    });
    if (confirmed) {
      setItems([]);
      setActivePreviewId(null);
      toast.info('Seluruh daftar resi telah dikosongkan.');
    }
  };

  // Upload file Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsedItems = await parseOfflineWaybillsExcel(file);
      setItems((prev) => [...parsedItems, ...prev]);
      if (parsedItems[0]) {
        setActivePreviewId(parsedItems[0].id);
      }
      toast.success(`${parsedItems.length} resi berhasil diimpor dari file Excel.`);
    } catch (err) {
      toast.error(err.message || 'Gagal membaca file Excel.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Cetak Semua Resi (Batch Print)
  const handlePrintAll = () => {
    if (items.length === 0) {
      toast.warning('Daftar resi masih kosong. Tambahkan resi manual atau upload file Excel terlebih dahulu.');
      return;
    }
    setPrintTarget('all');
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.print();
      }
    }, 100);
  };

  // Cetak Single Resi
  const handlePrintSingle = (id) => {
    setPrintTarget(id);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.print();
      }
    }, 100);
  };

  if ((authLoading && !currentUser) || (!authLoading && (!currentUser || !canAccess))) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyQueueTitle}>Memverifikasi Otoritas Akses...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* 1. Header & Quick Actions */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cetak Resi Pengiriman</h1>
          <p className={styles.subtitle}>
            Cetak label resi pengiriman format thermal (100×150 mm) atau simpan sebagai PDF untuk pesanan WhatsApp dan penjualan offline.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={downloadOfflineWaybillTemplate}
            title="Download template file Excel (.xlsx)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Template Excel
          </button>

          {items.length > 0 && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={handleClearAll}
              title="Hapus semua resi di antrean"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Kosongkan Antrean
            </button>
          )}

          <button
            type="button"
            className={styles.primaryPrintBtn}
            onClick={handlePrintAll}
            disabled={items.length === 0}
            title="Cetak seluruh resi ke printer thermal atau simpan sebagai file PDF"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Cetak Semua Resi ({items.length})
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Grid */}
      <div className={styles.mainLayout}>
        {/* Kolom Kiri: Form Input Manual + Upload Excel + Tabel Antrean */}
        <div className={styles.leftColumn}>
          {/* A. Form Input Manual */}
          <div id="resi-form-section" className={styles.formCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {editingId ? 'Edit Data Resi' : 'Input Resi Manual'}
              </h2>
              {editingId && (
                <span className={styles.editingBadge}>Mode Edit</span>
              )}
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className={styles.formGrid}>
                {/* Nama Penerima */}
                <div>
                  <label htmlFor="field-name" className={styles.fieldLabel}>
                    Nama Penerima <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="field-name"
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={styles.fieldInput}
                    required
                  />
                </div>

                {/* No Telepon / WA */}
                <div>
                  <label htmlFor="field-phone" className={styles.fieldLabel}>
                    No. Telepon / WhatsApp <span className={styles.requiredStar}>*</span>
                  </label>
                  <input
                    id="field-phone"
                    type="text"
                    placeholder="Contoh: 081234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={styles.fieldInput}
                    required
                  />
                </div>

                {/* Ekspedisi Kurir */}
                <div className={styles.formFieldFull}>
                  <label htmlFor="field-courier" className={styles.fieldLabel}>
                    Ekspedisi Kurir
                  </label>
                  <select
                    id="field-courier"
                    value={formData.courier}
                    onChange={(e) => setFormData({ ...formData, courier: e.target.value })}
                    className={styles.fieldInput}
                  >
                    {COURIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alamat Lengkap (String Digabung) */}
                <div className={styles.formFieldFull}>
                  <label htmlFor="field-address" className={styles.fieldLabel}>
                    Alamat Lengkap Pengiriman <span className={styles.requiredStar}>*</span>
                  </label>
                  <textarea
                    id="field-address"
                    placeholder="Paste langsung teks alamat lengkap dari WhatsApp customer (Jalan, No Rumah, RT/RW, Kelurahan, Kecamatan, Kota/Kab, Provinsi, Kodepos)..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={styles.fieldTextarea}
                    rows={3}
                    required
                  />
                  <div className={styles.fieldHint}>
                    Format alamat teks tunggal gabungan — langsung tempel teks dari chat WhatsApp.
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className={styles.cancelEditBtn}
                  >
                    Batal Edit
                  </button>
                )}
                <button type="submit" className={styles.addQueueBtn}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {editingId ? (
                      <polyline points="20 6 9 17 4 12" />
                    ) : (
                      <>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </>
                    )}
                  </svg>
                  {editingId ? 'Simpan Perubahan' : 'Tambah ke Antrean Cetak'}
                </button>
              </div>
            </form>
          </div>

          {/* B. Area Upload Excel */}
          <div className={styles.excelCard}>
            <div className={styles.excelHeader}>
              <div className={styles.excelTitleGroup}>
                <div className={styles.excelIconWrapper}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.excelTitle}>Import dari Excel</h3>
                  <p className={styles.excelDesc}>
                    Tambahkan banyak penerima sekaligus menggunakan file Excel (.xlsx, .xls, .csv).
                  </p>
                </div>
              </div>

              <div className={styles.excelActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className={styles.hiddenFileInput}
                />
                <button
                  type="button"
                  className={styles.uploadFileBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {isUploading ? 'Membaca File...' : 'Pilih File Excel'}
                </button>

                <button
                  type="button"
                  className={styles.templateDownloadLink}
                  onClick={downloadOfflineWaybillTemplate}
                >
                  Unduh Template
                </button>
              </div>
            </div>
          </div>

          {/* C. Tabel Daftar Antrean Resi */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <h3 className={styles.tableTitle}>Antrean Resi Siap Cetak</h3>
              <span className={styles.tableCounter}>
                {items.length} Resi Tersedia
              </span>
            </div>

            {items.length === 0 ? (
              <div className={styles.emptyQueue}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                  <line x1="8" y1="7" x2="16" y2="7" />
                  <line x1="8" y1="11" x2="16" y2="11" />
                </svg>
                <div className={styles.emptyQueueTitle}>Antrean cetak masih kosong</div>
                <div className={styles.emptyQueueDesc}>
                  Gunakan formulir manual di atas atau impor file Excel untuk menambahkan penerima.
                </div>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thIndex}>No.</th>
                      <th>Reference ID</th>
                      <th>Penerima</th>
                      <th>Alamat Lengkap</th>
                      <th>Kurir</th>
                      <th className={styles.thAction}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const isActive = it.id === (activePreviewItem?.id || activePreviewId);
                      const isEditing = it.id === editingId;
                      return (
                        <tr
                          key={it.id}
                          className={`${isActive ? styles.rowSelected : ''} ${isEditing ? styles.editRowActive : ''}`.trim()}
                          onClick={() => setActivePreviewId(it.id)}
                        >
                          <td className={styles.tdIndex}>{idx + 1}</td>
                          <td>
                            <span className={styles.tdRefText}>{it.id}</span>
                          </td>
                          <td>
                            <div className={styles.tdCustomerName}>{it.name}</div>
                            <div className={styles.tdCustomerPhone}>{it.phone}</div>
                          </td>
                          <td>
                            <div className={styles.tdAddressText} title={it.address}>
                              {it.address}
                            </div>
                          </td>
                          <td>
                            <span className={styles.tdCourierBadge}>{it.courier}</span>
                          </td>
                          <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={styles.actionIconBtn}
                              onClick={() => setActivePreviewId(it.id)}
                              title="Lihat Pratinjau Thermal"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className={`${styles.actionIconBtn} ${styles.editIconBtn}`}
                              onClick={() => handleStartEdit(it)}
                              title="Edit Data Resi Ini"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className={styles.actionIconBtn}
                              onClick={() => handlePrintSingle(it.id)}
                              title="Cetak Label Ini Saja"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                              onClick={() => handleDeleteItem(it.id, it.name)}
                              title="Hapus dari antrean"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Pratinjau Live Sticky */}
        <div className={styles.previewColumn}>
          <div className={styles.previewPanelCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Pratinjau Label
              </span>
              <span className={styles.previewDimensions}>100 × 150 mm</span>
            </div>

            {activePreviewItem ? (
              <>
                <div className={styles.previewWrapper}>
                  <OfflineLabel item={activePreviewItem} />
                </div>
                <button
                  type="button"
                  className={styles.printSingleBtn}
                  onClick={() => handlePrintSingle(activePreviewItem.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Cetak Label Ini
                </button>
                <p className={styles.previewHint}>
                  Standar format kertas 100×150 mm (Printer thermal atau Simpan PDF).
                </p>
              </>
            ) : (
              <div className={styles.emptyQueue}>
                <p className={styles.emptyQueueDesc}>
                  Pilih salah satu baris di antrean untuk melihat pratinjau label.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Stream Cetak Tersembunyi (Hanya tampil saat window.print() / Simpan ke PDF) */}
      <div className={styles.printStream}>
        {printableItems.map((item) => (
          <div key={item.id} className={styles.printItemWrap}>
            <OfflineLabel item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GenerateResiPage() {
  return (
    <Suspense fallback={<div className={styles.page}><p>Memuat Halaman Cetak Resi...</p></div>}>
      <GenerateResiPageInner />
    </Suspense>
  );
}
