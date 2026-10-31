'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import styles from './ManageHierarchyModal.module.css';

const DEPT_ICON_PRESETS = [
  { label: 'Ikan Hias', value: '/img/tab-dept-fish.svg' },
  { label: 'Peralatan', value: '/img/tab-dept-equipment.svg' },
  { label: 'Pakan & Obat', value: '/img/tab-dept-feed.svg' },
  { label: 'Semua Produk', value: '/img/tab-dept-all.svg' },
];

const SUB_ICON_PRESETS = [
  { label: 'Cupang', value: '/img/tab-betta-multicolor.svg' },
  { label: 'Channa', value: '/img/tab-channa.svg' },
  { label: 'Guppy', value: '/img/tab-guppy.svg' },
  { label: 'Molly', value: '/img/tab-molly.svg' },
  { label: 'Soliter', value: '/img/tab-sub-soliter.svg' },
  { label: 'Filter', value: '/img/tab-sub-filter.svg' },
  { label: 'Pakan', value: '/img/tab-sub-feed.svg' },
  { label: '✦ Gallery VIP', value: '/img/tab-vip-gallery.svg' },
];

function getSubCategoryDefaultIcon(slug = '', name = '') {
  const s = `${slug} ${name}`.toLowerCase();
  if (s.includes('cupang') || s.includes('betta')) return '/img/tab-betta-multicolor.svg';
  if (s.includes('channa') || s.includes('chana') || s.includes('snakehead')) return '/img/tab-channa.svg';
  if (s.includes('guppy') || s.includes('gapi')) return '/img/tab-guppy.svg';
  if (s.includes('molly') || s.includes('moli')) return '/img/tab-molly.svg';
  if (s.includes('filter') || s.includes('aerator') || s.includes('pompa')) return '/img/tab-sub-filter.svg';
  if (s.includes('soliter') || s.includes('aquarium') || s.includes('tank')) return '/img/tab-sub-soliter.svg';
  if (s.includes('pakan') || s.includes('pelet') || s.includes('obat') || s.includes('vitamin')) return '/img/tab-sub-feed.svg';
  return '/img/tab-dept-all.svg';
}

export default function ManageHierarchyModal({ isOpen, onClose, onHierarchyUpdated }) {
  const { toast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Forms state
  const [editingDept, setEditingDept] = useState(null); // null, 'new', or department object
  const [deptForm, setDeptForm] = useState({ name: '', isLiveFish: true, description: '', icon: '/img/tab-dept-fish.svg' });

  const [editingSub, setEditingSub] = useState(null); // null, 'new', or subCategory object
  const [subForm, setSubForm] = useState({ name: '', description: '', image: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/departments');
      if (!res.ok) throw new Error('Gagal mengambil data hierarki');
      const data = await res.json();
      setDepartments(data);
      if (data.length > 0 && !selectedDeptId) {
        setSelectedDeptId(data[0].id);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen, fetchDepartments]);

  const activeDept = departments.find((d) => d.id === selectedDeptId) || departments[0] || null;

  const handleUploadIcon = async (file, targetForm) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar');
      const uploadedUrl = data.url || (data.files && data.files[0]?.url);
      if (!uploadedUrl) throw new Error('Format respon upload tidak valid');

      if (targetForm === 'dept') {
        setDeptForm((prev) => ({ ...prev, icon: uploadedUrl }));
      } else {
        setSubForm((prev) => ({ ...prev, image: uploadedUrl }));
      }
      toast.success('Gambar berhasil diunggah.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Department CRUD
  const handleStartAddDept = () => {
    setEditingDept('new');
    setDeptForm({ name: '', isLiveFish: true, description: '', icon: '/img/tab-dept-fish.svg' });
  };

  const handleStartEditDept = (dept, e) => {
    e.stopPropagation();
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      isLiveFish: dept.isLiveFish,
      description: dept.description || '',
      icon: dept.icon || '/img/tab-dept-fish.svg',
    });
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) {
      toast.error('Nama departemen wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const isNew = editingDept === 'new';
      const url = isNew ? '/api/admin/departments' : `/api/admin/departments/${editingDept.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deptForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan departemen.');

      toast.success(isNew ? 'Departemen berhasil ditambahkan.' : 'Departemen berhasil diperbarui.');
      setEditingDept(null);
      await fetchDepartments();
      if (isNew && data.id) setSelectedDeptId(data.id);
      onHierarchyUpdated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDept = async (dept, e) => {
    e.stopPropagation();
    if (dept._count?.products > 0) {
      toast.error(`Tidak dapat menghapus: terdapat ${dept._count.products} produk di departemen ini.`);
      return;
    }
    if (!window.confirm(`Hapus departemen "${dept.name}" beserta sub-kategori di dalamnya?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/departments/${dept.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus departemen.');
      toast.success('Departemen berhasil dihapus.');
      await fetchDepartments();
      onHierarchyUpdated?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // SubCategory CRUD
  const handleStartAddSub = () => {
    if (!activeDept) return;
    setEditingSub('new');
    setSubForm({ name: '', description: '', image: '' });
  };

  const handleStartEditSub = (sub) => {
    setEditingSub(sub);
    setSubForm({
      name: sub.name,
      description: sub.description || '',
      image: sub.image || '',
    });
  };

  const handleSaveSub = async (e) => {
    e.preventDefault();
    if (!subForm.name.trim()) {
      toast.error('Nama sub-kategori wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    try {
      const isNew = editingSub === 'new';
      const url = isNew ? '/api/admin/subcategories' : `/api/admin/subcategories/${editingSub.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const body = isNew
        ? { ...subForm, departmentId: activeDept.id }
        : subForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan sub-kategori.');

      toast.success(isNew ? 'Sub-kategori berhasil ditambahkan.' : 'Sub-kategori berhasil diperbarui.');
      setEditingSub(null);
      await fetchDepartments();
      onHierarchyUpdated?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSub = async (sub) => {
    if (sub._count?.products > 0) {
      toast.error(`Tidak dapat menghapus: terdapat ${sub._count.products} produk di kategori ini.`);
      return;
    }
    if (!window.confirm(`Hapus sub-kategori "${sub.name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/subcategories/${sub.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus sub-kategori.');
      toast.success('Sub-kategori berhasil dihapus.');
      await fetchDepartments();
      onHierarchyUpdated?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <span className={styles.modalBadge}>Struktur Katalog Produk</span>
            <h2 className={styles.modalTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Kelola Departemen &amp; Sub-Kategori
            </h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Tutup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2-Column Body: Level 1 (Dept) & Level 2 (Sub-Category) */}
        <div className={styles.modalBody}>
          {/* Column 1: Tingkat 1 (Departemen) */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <div className={styles.columnTitle}>
                <span>Tingkat 1: Departemen</span>
                <span className={styles.columnBadge}>{departments.length}</span>
              </div>
              <button
                type="button"
                className={styles.addBtnSmall}
                onClick={handleStartAddDept}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah
              </button>
            </div>

            <div className={styles.listContent}>
              {editingDept && (
                <form onSubmit={handleSaveDept} className={styles.formBox}>
                  <h4 className={styles.formTitle}>
                    {editingDept === 'new' ? 'Tambah Departemen Baru' : `Ubah "${editingDept.name}"`}
                  </h4>
                  <input
                    type="text"
                    placeholder="Nama Departemen (cth: Ikan Hias, Peralatan)"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    className={styles.inputField}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Deskripsi singkat (opsional)"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                    className={styles.inputField}
                  />
                  <div className={styles.iconSection}>
                    <label className={styles.fieldLabel}>Gambar / Ikon Tab Departemen</label>
                    <div className={styles.presetChipsList}>
                      {DEPT_ICON_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={`${styles.presetChip} ${deptForm.icon === preset.value ? styles.presetChipActive : ''}`}
                          onClick={() => setDeptForm({ ...deptForm, icon: preset.value })}
                        >
                          <Image src={preset.value} width={16} height={16} unoptimized alt="" />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className={styles.iconUploadRow}>
                      {deptForm.icon ? (
                        <div className={styles.previewBox}>
                          <Image src={deptForm.icon} width={24} height={24} unoptimized alt="Preview" className={styles.previewImg} />
                          <button
                            type="button"
                            className={styles.btnClearIcon}
                            onClick={() => setDeptForm({ ...deptForm, icon: '' })}
                            title="Hapus gambar"
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                      <label className={styles.uploadBtn}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadIcon(e.target.files[0], 'dept')}
                          hidden
                        />
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{isUploading ? 'Upload...' : 'Upload Gambar'}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Path / URL..."
                        value={deptForm.icon}
                        onChange={(e) => setDeptForm({ ...deptForm, icon: e.target.value })}
                        className={styles.inputFieldCompact}
                      />
                    </div>
                  </div>
                  <label className={styles.toggleRow}>
                    <span>Jenis Ikan Hidup (Live Animals)</span>
                    <input
                      type="checkbox"
                      checked={deptForm.isLiveFish}
                      onChange={(e) => setDeptForm({ ...deptForm, isLiveFish: e.target.checked })}
                    />
                  </label>
                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnCancel} onClick={() => setEditingDept(null)}>
                      Batal
                    </button>
                    <button type="submit" className={styles.btnSave} disabled={isSubmitting}>
                      {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              )}

              {departments.map((dept) => {
                const isActive = activeDept?.id === dept.id;
                return (
                  <div
                    key={dept.id}
                    className={`${styles.itemCard} ${isActive ? styles.itemCardActive : ''}`}
                    onClick={() => setSelectedDeptId(dept.id)}
                  >
                    <div className={styles.itemLeftGroup}>
                      <div className={styles.itemIconThumbWrapper}>
                        <Image
                          src={dept.icon?.startsWith('/') || dept.icon?.startsWith('http') ? dept.icon : '/img/tab-dept-fish.svg'}
                          width={22}
                          height={22}
                          unoptimized
                          alt=""
                          className={styles.itemIconThumb}
                        />
                      </div>
                      <div className={styles.itemMain}>
                        <div className={styles.itemTitleRow}>
                          <span className={styles.itemName}>{dept.name}</span>
                          {dept.isLiveFish ? (
                            <span className={styles.liveBadge}>Ikan Hidup</span>
                          ) : (
                            <span className={styles.goodsBadge}>Barang Kering</span>
                          )}
                        </div>
                        {dept.description && <span className={styles.itemDesc}>{dept.description}</span>}
                        <span className={styles.itemCount}>
                          {dept.subCategories?.length || 0} sub-kategori • {dept._count?.products || 0} produk
                        </span>
                      </div>
                    </div>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => handleStartEditDept(dept, e)}
                        title="Edit departemen"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={(e) => handleDeleteDept(dept, e)}
                        title="Hapus departemen"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Tingkat 2 (Sub-Kategori di bawah departemen aktif) */}
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <div className={styles.columnTitle}>
                <span>Tingkat 2: Jenis / Sub-Kategori</span>
                <span className={styles.columnBadge}>{activeDept?.subCategories?.length || 0}</span>
              </div>
              {activeDept && (
                <button
                  type="button"
                  className={styles.addBtnSmall}
                  onClick={handleStartAddSub}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Tambah Sub
                </button>
              )}
            </div>

            <div className={styles.listContent}>
              {editingSub && (
                <form onSubmit={handleSaveSub} className={styles.formBox}>
                  <h4 className={styles.formTitle}>
                    {editingSub === 'new'
                      ? `Tambah Sub-Kategori di "${activeDept?.name}"`
                      : `Ubah "${editingSub.name}"`}
                  </h4>
                  <input
                    type="text"
                    placeholder="Nama Sub-Kategori (cth: Cupang, Channa, Filter)"
                    value={subForm.name}
                    onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                    className={styles.inputField}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Deskripsi singkat (opsional)"
                    value={subForm.description}
                    onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
                    className={styles.inputField}
                  />
                  <div className={styles.iconSection}>
                    <label className={styles.fieldLabel}>Gambar / Ikon Tab Jenis Produk</label>
                    <div className={styles.presetChipsList}>
                      {SUB_ICON_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          className={`${styles.presetChip} ${subForm.image === preset.value ? styles.presetChipActive : ''}`}
                          onClick={() => setSubForm({ ...subForm, image: preset.value })}
                        >
                          <Image src={preset.value} width={16} height={16} unoptimized alt="" />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className={styles.iconUploadRow}>
                      {subForm.image ? (
                        <div className={styles.previewBox}>
                          <Image src={subForm.image} width={24} height={24} unoptimized alt="Preview" className={styles.previewImg} />
                          <button
                            type="button"
                            className={styles.btnClearIcon}
                            onClick={() => setSubForm({ ...subForm, image: '' })}
                            title="Hapus gambar"
                          >
                            ✕
                          </button>
                        </div>
                      ) : null}
                      <label className={styles.uploadBtn}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadIcon(e.target.files[0], 'sub')}
                          hidden
                        />
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{isUploading ? 'Upload...' : 'Upload Gambar'}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Path / URL..."
                        value={subForm.image}
                        onChange={(e) => setSubForm({ ...subForm, image: e.target.value })}
                        className={styles.inputFieldCompact}
                      />
                    </div>
                  </div>
                  <div className={styles.formActions}>
                    <button type="button" className={styles.btnCancel} onClick={() => setEditingSub(null)}>
                      Batal
                    </button>
                    <button type="submit" className={styles.btnSave} disabled={isSubmitting}>
                      {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </form>
              )}

              {activeDept?.subCategories && activeDept.subCategories.length > 0 ? (
                activeDept.subCategories.map((sub) => (
                  <div key={sub.id} className={styles.itemCard}>
                    <div className={styles.itemLeftGroup}>
                      <div className={styles.itemIconThumbWrapper}>
                        <Image
                          src={sub.image || getSubCategoryDefaultIcon(sub.slug, sub.name)}
                          width={22}
                          height={22}
                          unoptimized
                          alt=""
                          className={styles.itemIconThumb}
                        />
                      </div>
                      <div className={styles.itemMain}>
                        <span className={styles.itemName}>{sub.name}</span>
                        {sub.description && <span className={styles.itemDesc}>{sub.description}</span>}
                        <span className={styles.itemCount}>{sub._count?.products || 0} produk terhubung</span>
                      </div>
                    </div>

                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleStartEditSub(sub)}
                        title="Edit sub-kategori"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => handleDeleteSub(sub)}
                        title="Hapus sub-kategori"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <p>Belum ada sub-kategori di departemen ini.</p>
                  <button type="button" className={styles.btnSave} onClick={handleStartAddSub}>
                    + Buat Sub-Kategori Pertama
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

