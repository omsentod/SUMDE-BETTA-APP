'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from '../users.module.css';

export default function UserAddressesTab({ userId, addresses = [], onAddressChanged }) {
  const { toast } = useToast();
  const [editingAddr, setEditingAddr] = useState(null); // null, 'new', or address object
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    label: 'Rumah',
    recipientName: '',
    phone: '',
    streetAddress: '',
    rtRw: '',
    province: '',
    city: '',
    district: '',
    village: '',
    postalCode: '',
    isDefault: false,
  });

  const openNewForm = () => {
    setForm({
      label: 'Rumah',
      recipientName: '',
      phone: '',
      streetAddress: '',
      rtRw: '',
      province: '',
      city: '',
      district: '',
      village: '',
      postalCode: '',
      isDefault: addresses.length === 0,
    });
    setEditingAddr('new');
  };

  const openEditForm = (addr) => {
    setForm({
      label: addr.label || 'Rumah',
      recipientName: addr.recipientName || '',
      phone: addr.phone || '',
      streetAddress: addr.streetAddress || '',
      rtRw: addr.rtRw || '',
      province: addr.province || '',
      city: addr.city || '',
      district: addr.district || '',
      village: addr.village || '',
      postalCode: addr.postalCode || '',
      isDefault: addr.isDefault || false,
    });
    setEditingAddr(addr);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isNew = editingAddr === 'new';
      const endpoint = isNew
        ? `/api/admin/users/${userId}/addresses`
        : `/api/admin/users/${userId}/addresses/${editingAddr.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal menyimpan alamat.');
        return;
      }

      toast.success(isNew ? 'Alamat baru berhasil ditambahkan.' : 'Data alamat berhasil diperbarui.');
      setEditingAddr(null);
      if (onAddressChanged) onAddressChanged();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addr) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/addresses/${addr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal menetapkan alamat utama.');
        return;
      }
      toast.success('Alamat utama berhasil diperbarui.');
      if (onAddressChanged) onAddressChanged();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    }
  };

  const handleDelete = async (addr) => {
    if (!confirm(`Hapus alamat "${addr.label}" (${addr.recipientName})?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/addresses/${addr.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Gagal menghapus alamat.');
        return;
      }
      toast.success('Alamat berhasil dihapus.');
      if (onAddressChanged) onAddressChanged();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-main)' }}>
          Daftar Alamat Pengiriman ({addresses.length})
        </h4>
        {!editingAddr && (
          <button type="button" className={styles.btnPrimarySolid} onClick={openNewForm}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Alamat
          </button>
        )}
      </div>

      {editingAddr && (
        <div className={styles.sectionCard} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.sectionHeader}>
            <h4 className={styles.sectionTitle}>
              {editingAddr === 'new' ? 'Tambah Alamat Baru' : `Edit Alamat: ${editingAddr.label}`}
            </h4>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setEditingAddr(null)}
              title="Batal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Label Alamat *</label>
                <input
                  type="text"
                  placeholder="Rumah, Kantor, Toko"
                  className={styles.formInput}
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Nama Penerima *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>No. Telepon / WhatsApp *</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  placeholder="08xxxxxxxxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>RT / RW *</label>
                <input
                  type="text"
                  placeholder="001/002"
                  className={styles.formInput}
                  value={form.rtRw}
                  onChange={(e) => setForm({ ...form, rtRw: e.target.value })}
                  required
                />
              </div>

              <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                <label className={styles.inputLabel}>Alamat Lengkap / Jalan *</label>
                <input
                  type="text"
                  placeholder="Nama jalan, nomor rumah, patokan"
                  className={styles.formInput}
                  value={form.streetAddress}
                  onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Kelurahan / Desa *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={form.village}
                  onChange={(e) => setForm({ ...form, village: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Kecamatan *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Kota / Kabupaten *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Provinsi *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Kode Pos (5 Digit) *</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="12345"
                  className={styles.formInput}
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  required
                />
              </div>

              <div className={`${styles.inputGroup} ${styles.formGridFull}`}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-main)', fontWeight: 500 }}>
                    Jadikan sebagai alamat pengiriman utama (default)
                  </span>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className={styles.btnSecondarySmall}
                onClick={() => setEditingAddr(null)}
              >
                Batal
              </button>
              <button type="submit" className={styles.btnPrimarySolid} disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Alamat'}
              </button>
            </div>
          </form>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className={styles.tabEmptyState}>
          <svg className={styles.tabEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h4 className={styles.tabEmptyTitle}>Belum Ada Buku Alamat</h4>
          <p className={styles.tabEmptyDesc}>Pengguna belum memiliki daftar alamat tersimpan.</p>
        </div>
      ) : (
        <div className={styles.addressCardList}>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}
            >
              <div>
                <div className={styles.addressHeader}>
                  <span className={styles.addressLabelBadge}>{addr.label}</span>
                  {addr.isDefault && <span className={styles.badgeDefaultAddress}>Utama</span>}
                </div>
                <div style={{ marginTop: '0.65rem' }}>
                  <div className={styles.addressRecipient}>{addr.recipientName}</div>
                  <div className={styles.addressPhone}>{addr.phone}</div>
                  <div className={styles.addressText}>
                    {addr.streetAddress}, RT/RW {addr.rtRw}, Kel. {addr.village}, Kec. {addr.district},{' '}
                    {addr.city}, {addr.province} {addr.postalCode}
                  </div>
                </div>
              </div>

              <div className={styles.addressActions}>
                {!addr.isDefault && (
                  <button
                    type="button"
                    className={styles.btnSecondarySmall}
                    onClick={() => handleSetDefault(addr)}
                  >
                    Set Utama
                  </button>
                )}
                <button
                  type="button"
                  className={styles.btnSecondarySmall}
                  onClick={() => openEditForm(addr)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.btnDangerSmall}
                  onClick={() => handleDelete(addr)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
