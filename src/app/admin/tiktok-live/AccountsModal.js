'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from './tiktokLive.module.css';

export default function AccountsModal({ accounts, onClose, onSaved }) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState(() =>
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      handle: a.handle,
      isActive: a.isActive,
    }))
  );
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const handleFieldChange = (id, key, value) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [key]: value } : d)));
  };

  const handleSaveRow = async (draft) => {
    setSavingId(draft.id);
    try {
      const res = await fetch('/api/admin/tiktok-live/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan akun.');
      toast.success(`Akun "${data.name}" diperbarui.`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newHandle.trim()) {
      toast.warning('Nama dan handle TikTok wajib diisi.');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/tiktok-live/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, handle: newHandle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan akun.');
      toast.success(`Akun "${data.name}" ditambahkan.`);
      setDrafts((prev) => [...prev, data]);
      setNewName('');
      setNewHandle('');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Kelola Akun TikTok Live</h2>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Tutup
          </button>
        </div>

        <p className={styles.cardDesc}>
          Sesuaikan nama dan username handle akun TikTok yang digunakan tim saat live streaming.
        </p>

        <div>
          {drafts.map((d) => (
            <div key={d.id} className={styles.accountEditRow}>
              <input
                type="text"
                className={styles.input}
                value={d.name}
                onChange={(e) => handleFieldChange(d.id, 'name', e.target.value)}
                placeholder="Nama Akun"
                aria-label="Nama Akun"
              />
              <input
                type="text"
                className={styles.input}
                value={d.handle}
                onChange={(e) => handleFieldChange(d.id, 'handle', e.target.value)}
                placeholder="@username"
                aria-label="Handle TikTok"
              />
              <button
                type="button"
                className={styles.btnOutline}
                disabled={savingId === d.id}
                onClick={() => handleSaveRow(d)}
              >
                {savingId === d.id ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddAccount} className={styles.addAccountForm}>
          <div className={styles.label}>Tambah Akun TikTok Baru</div>
          <div className={styles.accountEditRow}>
            <input
              type="text"
              className={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Mis. Akun Live 6"
            />
            <input
              type="text"
              className={styles.input}
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              placeholder="@sumdebetta.live6"
            />
            <button type="submit" className={styles.btnPrimary} disabled={adding}>
              {adding ? 'Menambah...' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
