'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import styles from './roles.module.css';

export default function UserRoleModal({ isOpen, onClose, user, roles, onSaved, currentUserId }) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role || 'customer');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const isSelf = user.id === currentUserId;
  const currentRoleObj = roles.find((r) => r.slug === selectedRole);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSelf && selectedRole !== user.role) {
      toast.warning('Anda tidak dapat mengubah role akun Anda sendiri.');
      return;
    }

    if (selectedRole === user.role) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role: selectedRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengubah role user.');
        return;
      }

      toast.success(`Role ${user.name} berhasil diubah menjadi ${currentRoleObj?.name || selectedRole}.`);
      onSaved(data);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Terjadi kesalahan jaringan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.userSelectModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Ubah Role Pengguna</h2>
          <button type="button" className={styles.modalCloseBtn} onClick={onClose} aria-label="Tutup">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{user.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.email}</div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Pilih Role Baru *</label>
              <div className={styles.roleOptionList}>
                {roles.map((r) => {
                  const isSelected = selectedRole === r.slug;
                  const permsCount = Array.isArray(r.permissions) ? r.permissions.length : 0;
                  return (
                    <div
                      key={r.slug}
                      className={`${styles.roleOptionCard} ${isSelected ? styles.roleOptionCardActive : ''}`}
                      onClick={() => !isSelf && setSelectedRole(r.slug)}
                    >
                      <div className={styles.roleOptionText}>
                        <div className={styles.roleOptionName}>
                          <span>{r.name}</span>
                          {r.isSystem ? (
                            <span className={styles.badgeSystem} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                              Sistem
                            </span>
                          ) : (
                            <span className={styles.badgeCustom} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                              Kustom
                            </span>
                          )}
                        </div>
                        <div className={styles.roleOptionDesc}>
                          {r.slug === 'admin'
                            ? 'Akses penuh tanpa batas (Superadmin)'
                            : permsCount > 0
                            ? `${permsCount} izin aktif • ${r.description || r.slug}`
                            : r.description || 'Tidak ada wewenang admin'}
                        </div>
                      </div>
                      <div className={`${styles.roleOptionRadio} ${isSelected ? styles.roleOptionRadioActive : ''}`}>
                        {isSelected && <div className={styles.roleOptionRadioDot} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isSelf && (
                <span className={styles.fieldHelp} style={{ color: 'var(--status-warning)' }}>
                  Perhatian: Anda tidak dapat mengubah role akun Anda sendiri untuk mencegah penguncian sistem.
                </span>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.outlineBtn} onClick={onClose} disabled={submitting}>
              Batal
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting || isSelf}>
              {submitting ? 'Menyimpan...' : 'Simpan Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
