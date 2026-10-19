'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/context/ToastContext';
import RoleManagementTab from './RoleManagementTab';
import UserRoleModal from './UserRoleModal';
import { canUser } from '@/lib/permission-utils';
import dashboardStyles from '../dashboard/adminDashboard.module.css';
import roleStyles from './roles.module.css';

export default function AdminUsersPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'roles'
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [systemPermissions, setSystemPermissions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [roleModalUser, setRoleModalUser] = useState(null);
  const confirm = useConfirmModal();

  const canViewUsers = canUser(currentUser, 'users:view');
  const canManageUsers = canUser(currentUser, 'users:update');
  const canDeleteUsers = canUser(currentUser, 'users:delete');
  const canViewRoles = canUser(currentUser, 'roles:view');
  const canManageRoles = canUser(currentUser, 'roles:update');

  useEffect(() => {
    if (!authLoading && currentUser) {
      if (!canViewUsers && !canViewRoles) {
        router.push('/admin/dashboard');
      } else if (!canViewUsers && canViewRoles && activeTab === 'users') {
        setActiveTab('roles');
      }
    } else if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, canViewUsers, canViewRoles, activeTab, router]);

  const loadUsers = useCallback(async () => {
    if (!canViewUsers) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, [canViewUsers]);

  const loadRoles = useCallback(async () => {
    if (!canViewRoles) return;
    setLoadingRoles(true);
    try {
      const res = await fetch('/api/admin/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles || []);
        setSystemPermissions(data.systemPermissions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRoles(false);
    }
  }, [canViewRoles]);

  useEffect(() => {
    if (currentUser && (canViewUsers || canViewRoles)) {
      if (canViewUsers) loadUsers();
      if (canViewRoles) loadRoles();
    }
  }, [currentUser, canViewUsers, canViewRoles, loadUsers, loadRoles]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === 'All' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const askDeleteUser = (user) => {
    if (user.id === currentUser.id) {
      toast.warning('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    if (user.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        toast.warning('Tidak dapat menghapus admin terakhir.');
        return;
      }
    }

    confirm.open({
      title: 'Hapus User',
      desc: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.email})?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
          if (res.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            loadRoles(); // refresh role counts
            toast.success(`Akun "${user.name}" berhasil dihapus.`);
          } else {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || 'Gagal menghapus user.');
          }
        } catch (err) {
          console.error(err);
          toast.error('Terjadi kesalahan jaringan.');
        }
      },
    });
  };

  const handleUserRoleSaved = (updatedUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, role: updatedUser.role } : u)));
    loadRoles(); // refresh role counts
  };

  if (authLoading || !currentUser || (!canViewUsers && !canViewRoles)) {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas Pengguna...</h2>
      </div>
    );
  }

  return (
    <div className={dashboardStyles.dashboardWrapper}>
      <div className="container">
        <div className={dashboardStyles.dashboardHeader}>
          <div>
            <span className={dashboardStyles.headerBadge}>Master Data</span>
            <h1 className={dashboardStyles.headerTitle}>User & Hak Akses</h1>
          </div>
        </div>

        {/* Tab Switcher (Hanya tampil jika user memiliki akses ke kedua modul) */}
        {canViewUsers && canViewRoles && (
          <div className={roleStyles.tabNav}>
            <button
              type="button"
              className={`${roleStyles.tabBtn} ${activeTab === 'users' ? roleStyles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Daftar Pengguna ({users.length})
            </button>
            <button
              type="button"
              className={`${roleStyles.tabBtn} ${activeTab === 'roles' ? roleStyles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Kelola Role & Hak Akses ({roles.length})
            </button>
          </div>
        )}

        {/* TAB 1: DAFTAR USER */}
        {activeTab === 'users' && (
          <div>
            <div className={dashboardStyles.controlBar}>
              <div className={dashboardStyles.searchBox}>
                <svg
                  className={dashboardStyles.searchIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Cari nama atau email pengguna..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={dashboardStyles.searchInput}
                />
              </div>
              <div className={dashboardStyles.filterGroup}>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={dashboardStyles.selectInput}
                >
                  <option value="All">Semua Role</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingUsers ? (
              <p style={{ color: 'var(--text-muted)' }}>Memuat pengguna...</p>
            ) : filteredUsers.length === 0 ? (
              <div
                className={dashboardStyles.tableCard}
                style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                Tidak ada pengguna yang sesuai dengan kriteria filter.
              </div>
            ) : (
              <div className={dashboardStyles.tableCard}>
                <table className={dashboardStyles.dataTable}>
                  <thead>
                    <tr>
                      <th>Pengguna</th>
                      <th className={dashboardStyles.hideOnMobile}>Email</th>
                      <th>Role</th>
                      <th className={dashboardStyles.hideOnMobile}>No. Telepon</th>
                      <th style={{ textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const roleObj = roles.find((r) => r.slug === user.role);
                      const roleDisplayName = roleObj ? roleObj.name : user.role.toUpperCase();
                      const isAdminRole = user.role === 'admin';

                      return (
                        <tr key={user.id} className={dashboardStyles.tableRow}>
                          <td style={{ fontWeight: '600', maxWidth: '160px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.name}
                            </div>
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                fontWeight: 400,
                                marginTop: '0.15rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {user.email}
                            </div>
                          </td>
                          <td className={dashboardStyles.hideOnMobile}>{user.email}</td>
                          <td>
                            <span
                              className={`${dashboardStyles.badge} ${
                                isAdminRole ? dashboardStyles.badgeWarning : dashboardStyles.badgeInfo
                              }`}
                            >
                              {roleDisplayName}
                            </span>
                          </td>
                          <td className={dashboardStyles.hideOnMobile} style={{ color: 'var(--text-muted)' }}>
                            {user.phone || '-'}
                          </td>
                          <td>
                            <div className={dashboardStyles.actionGroup}>
                              {canManageUsers && (
                                <button
                                  type="button"
                                  onClick={() => setRoleModalUser(user)}
                                  className="btn btn-outline"
                                  style={{
                                    padding: '0.3rem 0.55rem',
                                    fontSize: '0.7rem',
                                    borderRadius: '8px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Ubah Role
                                </button>
                              )}
                              {canDeleteUsers && (
                                <button
                                  type="button"
                                  onClick={() => askDeleteUser(user)}
                                  className={`${dashboardStyles.iconBtn} ${dashboardStyles.iconBtnDanger}`}
                                  disabled={user.id === currentUser.id}
                                  title={
                                    user.id === currentUser.id
                                      ? 'Tidak dapat menghapus akun sendiri'
                                      : 'Hapus User'
                                  }
                                >
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KELOLA ROLE & HAK AKSES */}
        {activeTab === 'roles' && (
          <RoleManagementTab
            roles={roles}
            setRoles={setRoles}
            systemPermissions={systemPermissions}
            loading={loadingRoles}
            loadRoles={loadRoles}
            canManageRoles={canManageRoles}
          />
        )}
      </div>

      {roleModalUser && (
        <UserRoleModal
          isOpen={!!roleModalUser}
          onClose={() => setRoleModalUser(null)}
          user={roleModalUser}
          roles={roles}
          onSaved={handleUserRoleSaved}
          currentUserId={currentUser.id}
        />
      )}

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
