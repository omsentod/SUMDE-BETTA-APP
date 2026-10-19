'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import RoleModal from './RoleModal';
import styles from './roles.module.css';

export default function RoleManagementTab({
  roles,
  setRoles,
  systemPermissions,
  loading,
  loadRoles,
  canManageRoles,
}) {
  const { toast } = useToast();
  const confirm = useConfirmModal();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const handleOpenAdd = () => {
    setEditingRole(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (role) => {
    if (role.isSystem) {
      toast.info('Role sistem bersifat bawaan dan hak aksesnya tidak dapat diubah.');
      return;
    }
    setEditingRole(role);
    setModalOpen(true);
  };

  const handleSaved = (savedRole) => {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === savedRole.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = savedRole;
        return updated;
      }
      return [...prev, savedRole];
    });
    loadRoles();
  };

  const askDelete = (role) => {
    if (role.isSystem) {
      toast.warning('Role sistem bawaan tidak dapat dihapus.');
      return;
    }

    if (role.userCount > 0) {
      toast.warning(
        `Role "${role.name}" masih digunakan oleh ${role.userCount} pengguna. Pindahkan pengguna ke role lain terlebih dahulu.`
      );
      return;
    }

    confirm.open({
      title: 'Hapus Role',
      desc: `Apakah Anda yakin ingin menghapus role "${role.name}" (${role.slug})? Tindakan ini tidak dapat dibatalkan.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            setRoles((prev) => prev.filter((r) => r.id !== role.id));
            toast.success(data.message || `Role "${role.name}" berhasil dihapus.`);
          } else {
            toast.error(data.error || 'Gagal menghapus role.');
          }
        } catch (err) {
          console.error(err);
          toast.error('Terjadi kesalahan jaringan.');
        }
      },
    });
  };

  return (
    <div>
      <div className={styles.actionBar}>
        <div>
          <h2 className={styles.actionTitle}>Daftar Role & Hak Akses</h2>
          <div className={styles.actionSubtitle}>
            Atur wewenang operasional modul ERP untuk setiap posisi atau jabatan pengguna.
          </div>
        </div>
        {canManageRoles && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Tambah Role Baru
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Memuat role...</p>
      ) : roles.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Belum ada role terdaftar.
        </div>
      ) : (
        <div className={styles.rolesGrid}>
          {roles.map((role) => {
            const perms = Array.isArray(role.permissions) ? role.permissions : [];
            const isFullAccess = role.slug === 'admin';

            return (
              <div key={role.id} className={styles.roleCard}>
                <div>
                  <div className={styles.roleCardTop}>
                    <div>
                      <h3 className={styles.roleName}>{role.name}</h3>
                      <span className={styles.roleSlug}>{role.slug}</span>
                    </div>
                    {role.isSystem ? (
                      <span className={styles.badgeSystem}>Sistem</span>
                    ) : (
                      <span className={styles.badgeCustom}>Kustom</span>
                    )}
                  </div>

                  <p className={styles.roleDesc}>{role.description || 'Tidak ada deskripsi wewenang.'}</p>

                  <div className={styles.permSummary}>
                    {isFullAccess ? (
                      <span className={styles.permPill} style={{ color: 'var(--primary)', borderColor: 'rgba(255, 107, 53, 0.3)' }}>
                        Semua Hak Akses (Wildcard *)
                      </span>
                    ) : perms.length === 0 ? (
                      <span className={styles.permPill} style={{ color: 'var(--text-muted)' }}>
                        Tanpa Akses Modul Admin
                      </span>
                    ) : (
                      <>
                        <span className={styles.permPill} style={{ fontWeight: 600 }}>
                          {perms.length} Izin Aktif
                        </span>
                        {perms.slice(0, 3).map((p) => (
                          <span key={p} className={styles.permPill}>
                            {p}
                          </span>
                        ))}
                        {perms.length > 3 && (
                          <span className={styles.permPill} style={{ color: 'var(--text-muted)' }}>
                            +{perms.length - 3} lainnya
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.metaRow}>
                  <div className={styles.userCountTag}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    <span>{role.userCount} Pengguna</span>
                  </div>

                  <div className={styles.roleActions}>
                    {!role.isSystem && canManageRoles && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleOpenEdit(role)}
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderRadius: '8px' }}
                        >
                          Edit Izin
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => askDelete(role)}
                          disabled={role.userCount > 0}
                          style={{
                            padding: '0.3rem 0.55rem',
                            fontSize: '0.75rem',
                            borderRadius: '8px',
                            color: role.userCount > 0 ? 'var(--text-muted)' : 'var(--status-error)',
                            borderColor: role.userCount > 0 ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.3)',
                          }}
                          title={role.userCount > 0 ? 'Tidak dapat dihapus karena masih digunakan user' : 'Hapus Role'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </>
                    )}
                    {role.isSystem && (
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Terkunci
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <RoleModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          role={editingRole}
          systemPermissions={systemPermissions}
        />
      )}

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
