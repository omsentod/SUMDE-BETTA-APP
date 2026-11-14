'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from './tiktokLive.module.css';

export default function AccountsModal({ accounts = [], teamUsers = [], onClose, onSaved }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'edit' | 'create'
  const [fetchedTeamUsers, setFetchedTeamUsers] = useState([]);

  const [formDraft, setFormDraft] = useState({
    id: '',
    name: '',
    handle: '',
    avatar: '',
    hostUserId: '',
    isActive: true,
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fallback fetch only if teamUsers prop is not available
  useEffect(() => {
    if (teamUsers && teamUsers.length > 0) return undefined;
    let active = true;
    fetch('/api/admin/tiktok-live/accounts')
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data.teamUsers)) {
          setFetchedTeamUsers(data.teamUsers);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [teamUsers]);

  const availableTeamUsers = useMemo(() => {
    if (teamUsers && teamUsers.length > 0) return teamUsers;
    return fetchedTeamUsers;
  }, [teamUsers, fetchedTeamUsers]);

  const activeAccountCount = useMemo(
    () => accounts.filter((a) => a.isActive).length,
    [accounts]
  );

  const startCreate = () => {
    setFormDraft({
      id: '',
      name: '',
      handle: '',
      avatar: '',
      hostUserId: '',
      isActive: true,
    });
    setViewMode('create');
  };

  const startEdit = (acc) => {
    setFormDraft({
      id: acc.id,
      name: acc.name || '',
      handle: acc.handle || '',
      avatar: acc.avatar || '',
      hostUserId: acc.hostUserId || acc.hostUser?.id || '',
      isActive: acc.isActive ?? true,
    });
    setViewMode('edit');
  };

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning('File harus berupa gambar (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Ukuran foto maksimal 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah foto profil.');
      setFormDraft((prev) => ({ ...prev, avatar: data.url }));
      toast.success('Foto profil akun berhasil diunggah.');
    } catch (err) {
      toast.error(err.message || 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveForm = async (e) => {
    e?.preventDefault();
    const cleanName = formDraft.name.trim();
    const rawHandle = formDraft.handle.trim();

    if (!cleanName) {
      toast.warning('Nama akun TikTok wajib diisi.');
      return;
    }
    if (!rawHandle) {
      toast.warning('Handle username TikTok wajib diisi (contoh: @sumdebetta.live).');
      return;
    }

    setSaving(true);
    try {
      if (viewMode === 'create') {
        const res = await fetch('/api/admin/tiktok-live/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            handle: rawHandle,
            avatar: formDraft.avatar || null,
            hostUserId: formDraft.hostUserId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan akun.');
        toast.success(`Akun "${data.name}" berhasil ditambahkan.`);
      } else {
        const res = await fetch('/api/admin/tiktok-live/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: formDraft.id,
            name: cleanName,
            handle: rawHandle,
            avatar: formDraft.avatar || null,
            hostUserId: formDraft.hostUserId || null,
            isActive: formDraft.isActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui akun.');
        toast.success(`Akun "${data.name}" berhasil diperbarui.`);
      }

      await onSaved?.();
      setViewMode('list');
    } catch (err) {
      toast.error(err.message || 'Terjadi kesalahan saat menyimpan akun.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!formDraft.id) return;
    const confirmText = `Hapus akun TikTok "${formDraft.name}" (${formDraft.handle})?`;
    if (!window.confirm(confirmText)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tiktok-live/accounts?id=${encodeURIComponent(formDraft.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus akun.');
      toast.success('Akun TikTok berhasil dihapus.');
      await onSaved?.();
      setViewMode('list');
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus akun.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Modal Head */}
        <div className={styles.accountModalHead}>
          <div className={styles.accountModalHeaderLeft}>
            <h2 className={styles.modalTitle}>Kelola Akun TikTok Live</h2>
            <p className={styles.cardDesc}>
              Sinkronasi akun live streaming dengan profil foto dan penugasan Host PIC tim.
            </p>
          </div>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Tutup
          </button>
        </div>

        {/* View 1: List Accounts */}
        {viewMode === 'list' && (
          <>
            <div className={styles.accountActionBar}>
              <span className={styles.accountCountLabel}>
                {accounts.length} Akun Terdaftar • {activeAccountCount} Aktif
              </span>
              <button
                type="button"
                className={styles.btnSmallPrimary}
                onClick={startCreate}
              >
                + Tambah Akun
              </button>
            </div>

            <div className={styles.accountCardList}>
              {accounts.length === 0 ? (
                <div className={styles.emptyWrap}>
                  <p className={styles.emptyDesc}>Belum ada akun TikTok live yang terdaftar.</p>
                </div>
              ) : (
                accounts.map((acc) => {
                  const hostLabel = acc.hostUser?.name || acc.hostName;
                  return (
                    <div key={acc.id} className={styles.accountCard}>
                      <div className={styles.accountCardLeft}>
                        <div className={styles.accountAvatarWrap}>
                          {acc.avatar ? (
                            <img
                              src={acc.avatar}
                              alt={acc.name}
                              className={styles.accountAvatarImg}
                            />
                          ) : (
                            <div className={styles.accountAvatarFallback}>
                              {acc.name ? acc.name.charAt(0).toUpperCase() : 'T'}
                            </div>
                          )}
                        </div>

                        <div className={styles.accountCardInfo}>
                          <div className={styles.accountCardTitleRow}>
                            <span className={styles.accountCardName}>{acc.name}</span>
                            <span className={styles.accountCardHandle}>{acc.handle}</span>
                          </div>

                          {hostLabel ? (
                            <span className={styles.accountHostBadge}>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              Host: {hostLabel}
                            </span>
                          ) : (
                            <span
                              className={`${styles.accountHostBadge} ${styles.accountHostBadgeUnassigned}`}
                            >
                              Host: Belum Ditugaskan
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.accountCardRight}>
                        <span
                          className={`${styles.accountStatusPill} ${
                            !acc.isActive ? styles.accountStatusPillInactive : ''
                          }`}
                        >
                          {acc.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => startEdit(acc)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* View 2: Form Create / Edit */}
        {(viewMode === 'create' || viewMode === 'edit') && (
          <form onSubmit={handleSaveForm} className={styles.accountFormStack}>
            <button
              type="button"
              className={styles.formBackBtn}
              onClick={() => {
                setViewMode('list');
                setEditingId(null);
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Kembali ke Daftar Akun
            </button>

            {/* Avatar Section */}
            <div className={styles.avatarUploadSection}>
              <div className={styles.avatarUploadPreview}>
                {formDraft.avatar ? (
                  <img src={formDraft.avatar} alt="Foto Profil Akun" />
                ) : (
                  <div className={styles.accountAvatarFallback}>
                    {formDraft.name ? formDraft.name.charAt(0).toUpperCase() : 'T'}
                  </div>
                )}
              </div>

              <div className={styles.avatarUploadActions}>
                <div className={styles.avatarActionButtons}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className={styles.fileInputHidden}
                    onChange={handleUploadAvatar}
                  />
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Mengunggah...' : formDraft.avatar ? 'Ganti Foto' : 'Unggah Foto'}
                  </button>
                  {formDraft.avatar && (
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() => setFormDraft((d) => ({ ...d, avatar: '' }))}
                      disabled={uploading}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <span className={styles.fieldHint}>
                  Foto profil akun TikTok (JPG, PNG, WebP maks. 5MB)
                </span>
              </div>
            </div>

            {/* Account Details */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-name">
                  Nama Akun TikTok
                </label>
                <input
                  id="acc-name"
                  type="text"
                  className={styles.input}
                  placeholder="Mis. Akun Live Utama"
                  value={formDraft.name}
                  onChange={(e) => setFormDraft((d) => ({ ...d, name: e.target.value }))}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-handle">
                  Handle TikTok (@username)
                </label>
                <input
                  id="acc-handle"
                  type="text"
                  className={styles.input}
                  placeholder="@sumdebetta.live"
                  value={formDraft.handle}
                  onChange={(e) => setFormDraft((d) => ({ ...d, handle: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Host PIC Team Selection */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="acc-host">
                Tugaskan Host / PIC Live (User Tim)
              </label>
              <select
                id="acc-host"
                className={styles.input}
                value={formDraft.hostUserId}
                onChange={(e) => setFormDraft((d) => ({ ...d, hostUserId: e.target.value }))}
              >
                <option value="">-- Belum Ditugaskan / Host Lepas --</option>
                {availableTeamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role?.toUpperCase() || 'STAFF'}) {u.email ? `• ${u.email}` : ''}
                  </option>
                ))}
              </select>
              <p className={styles.fieldHint}>
                Pilih user tim yang bertugas live streaming di akun ini. Host dapat disesuaikan sewaktu-waktu saat pergantian shift.
              </p>
            </div>

            {/* Status Switch */}
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formDraft.isActive}
                  onChange={(e) => setFormDraft((d) => ({ ...d, isActive: e.target.checked }))}
                />
                <span>Aktifkan akun ini untuk sesi Live streaming</span>
              </label>
            </div>

            {/* Clean Modal Footer with single primary action */}
            <div className={styles.confirmFooter}>
              {viewMode === 'edit' && (
                <button
                  type="button"
                  className={styles.btnDangerSmall}
                  onClick={handleDeleteAccount}
                  disabled={deleting || saving}
                  style={{ marginRight: 'auto' }}
                >
                  {deleting ? 'Menghapus...' : 'Hapus Akun'}
                </button>
              )}
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => {
                  setViewMode('list');
                }}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving || uploading}
              >
                {saving ? 'Menyimpan...' : 'Simpan Akun'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
