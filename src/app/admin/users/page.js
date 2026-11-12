'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import { useToast } from '@/context/ToastContext';
import UserAvatar from '@/components/UserAvatar';
import RoleManagementTab from './RoleManagementTab';
import UserRoleModal from './UserRoleModal';
import UserDetailModal from './UserDetailModal';
import { canUser } from '@/lib/permission-utils';
import dashboardStyles from '../dashboard/adminDashboard.module.css';
import roleStyles from './roles.module.css';
import usersStyles from './users.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

function formatPhoneDisplay(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    return digits.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
  }
  return phone;
}

function getWhatsAppUrl(phone, name) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const cleanNumber = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('62') ? digits : '62' + digits;
  const text = encodeURIComponent(
    `Halo ${name || 'Kak'}, kami dari tim SUMDE BETTA ingin mengonfirmasi terkait pesanan dan akun Anda.`
  );
  return `https://wa.me/${cleanNumber}?text=${text}`;
}

export default function AdminUsersPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [systemPermissions, setSystemPermissions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [waFilter, setWaFilter] = useState('All'); // 'All' | 'Verified' | 'Pending' | 'None'
  const [shoppingFilter, setShoppingFilter] = useState('All'); // 'All' | 'HasOrders' | 'NoOrders'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'name' | 'spend' | 'orders'

  // Modals state
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const confirm = useConfirmModal();

  const canViewUsers = canUser(currentUser, 'users:view');
  const canManageUsers = canUser(currentUser, 'users:update');
  const canDeleteUsers = canUser(currentUser, 'users:delete');
  const canViewRoles = canUser(currentUser, 'roles:view');
  const canManageRoles = canUser(currentUser, 'roles:update');

  const [activeTab, setActiveTab] = useState(() => (!canViewUsers && canViewRoles ? 'roles' : 'users'));

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push('/login');
      } else if (!canViewUsers && !canViewRoles) {
        router.push('/admin/dashboard');
      }
    }
  }, [currentUser, authLoading, canViewUsers, canViewRoles, router]);

  const loadUsers = useCallback(async () => {
    if (!canViewUsers) return;
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
    let ignore = false;
    if (!currentUser || (!canViewUsers && !canViewRoles)) return;

    async function initData() {
      if (canViewUsers) {
        try {
          const res = await fetch('/api/users');
          if (res.ok && !ignore) {
            setUsers(await res.json());
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (!ignore) setLoadingUsers(false);
        }
      }
      if (canViewRoles) {
        try {
          const res = await fetch('/api/admin/roles');
          if (res.ok && !ignore) {
            const data = await res.json();
            setRoles(data.roles || []);
            setSystemPermissions(data.systemPermissions || []);
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (!ignore) setLoadingRoles(false);
        }
      }
    }

    initData();
    return () => {
      ignore = true;
    };
  }, [currentUser, canViewUsers, canViewRoles]);

  // Executive KPI stats derived from users (focused on WhatsApp verification)
  const kpiStats = useMemo(() => {
    const total = users.length;
    const waVerified = users.filter((u) => Boolean(u.phoneVerified)).length;
    const waPending = users.filter((u) => Boolean(u.phone) && !u.phoneVerified).length;
    const totalRevenue = users.reduce((acc, u) => acc + (u.totalSpent || 0), 0);
    const shoppersCount = users.filter((u) => (u.ordersCount || 0) > 0).length;

    return {
      total,
      waVerified,
      waPending,
      totalRevenue,
      shoppersCount,
    };
  }, [users]);

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    let result = users.filter((u) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q));

      const matchRole = roleFilter === 'All' || u.role === roleFilter;

      const matchWa =
        waFilter === 'All' ||
        (waFilter === 'Verified' && Boolean(u.phoneVerified)) ||
        (waFilter === 'Pending' && Boolean(u.phone) && !u.phoneVerified) ||
        (waFilter === 'None' && !u.phone);

      const matchShopping =
        shoppingFilter === 'All' ||
        (shoppingFilter === 'HasOrders' && (u.ordersCount || 0) > 0) ||
        (shoppingFilter === 'NoOrders' && (!u.ordersCount || u.ordersCount === 0));

      return matchSearch && matchRole && matchWa && matchShopping;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'spend') {
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      }
      if (sortBy === 'orders') {
        return (b.ordersCount || 0) - (a.ordersCount || 0);
      }
      // default: newest
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return result;
  }, [users, search, roleFilter, waFilter, shoppingFilter, sortBy]);

  const askDeleteUser = (user) => {
    if (user.id === currentUser.id) {
      toast.warning('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    if (user.role === 'admin') {
      const adminCount = users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1) {
        toast.warning('Tidak dapat menghapus admin terakhir dalam sistem.');
        return;
      }
    }

    confirm.open({
      title: 'Hapus User',
      desc: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.email})? Data akan dipindahkan ke Recycle Bin.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
          if (res.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            loadRoles();
            toast.success(`Akun "${user.name}" berhasil dipindahkan ke Recycle Bin.`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('admin:refresh-counts'));
            }
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
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, role: updatedUser.role } : u))
    );
    loadRoles();
    loadUsers();
  };

  const handleUserDeepUpdated = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
    );
    if (detailUser && detailUser.id === updatedUser.id) {
      setDetailUser((prev) => ({ ...prev, ...updatedUser }));
    }
    loadRoles();
    loadUsers();
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
            <h1 className={dashboardStyles.headerTitle}>User & Manajemen Aktivitas</h1>
          </div>
        </div>

        {/* Tab Switcher */}
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

        {/* TAB 1: DAFTAR USER & KONTROL AKTIVITAS */}
        {activeTab === 'users' && (
          <div>
            {/* KPI Metrics Summary Bar */}
            <div className={usersStyles.kpiGrid}>
              <div className={usersStyles.kpiCard}>
                <div className={usersStyles.kpiHeader}>
                  <span className={usersStyles.kpiLabel}>Total Terdaftar</span>
                  <span className={usersStyles.kpiIconWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </span>
                </div>
                <div className={usersStyles.kpiValue}>{kpiStats.total} User</div>
                <div className={usersStyles.kpiSubtext}>Seluruh basis akun sistem</div>
              </div>

              <div className={usersStyles.kpiCard}>
                <div className={usersStyles.kpiHeader}>
                  <span className={usersStyles.kpiLabel}>WhatsApp Terverifikasi</span>
                  <span className={`${usersStyles.kpiIconWrap} ${usersStyles.kpiIconWrapSuccess}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
                <div className={usersStyles.kpiValue} style={{ color: '#10B981' }}>
                  {kpiStats.waVerified}
                </div>
                <div className={usersStyles.kpiSubtext}>Nomor WA valid & aktif</div>
              </div>

              <div className={usersStyles.kpiCard}>
                <div className={usersStyles.kpiHeader}>
                  <span className={usersStyles.kpiLabel}>Belum Verifikasi WA</span>
                  <span className={`${usersStyles.kpiIconWrap} ${usersStyles.kpiIconWrapWarning}`}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                </div>
                <div className={usersStyles.kpiValue} style={{ color: '#F59E0B' }}>
                  {kpiStats.waPending}
                </div>
                <div className={usersStyles.kpiSubtext}>Perlu konfirmasi nomor WA</div>
              </div>

              <div className={usersStyles.kpiCard}>
                <div className={usersStyles.kpiHeader}>
                  <span className={usersStyles.kpiLabel}>Total Omset Member</span>
                  <span className={usersStyles.kpiIconWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </span>
                </div>
                <div className={usersStyles.kpiValue}>{formatIDR(kpiStats.totalRevenue)}</div>
                <div className={usersStyles.kpiSubtext}>{kpiStats.shoppersCount} customer pernah belanja</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className={usersStyles.toolbarCard}>
              <div className={usersStyles.toolbarLeft}>
                <div className={usersStyles.searchWrapper}>
                  <svg
                    className={usersStyles.searchIcon}
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Cari nama, email, atau no. telepon..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={usersStyles.searchInput}
                  />
                </div>
              </div>

              <div className={usersStyles.toolbarRight}>
                {/* Filter Role */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={usersStyles.filterSelect}
                  aria-label="Filter Role"
                >
                  <option value="All">Semua Role</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Filter Status WhatsApp */}
                <select
                  value={waFilter}
                  onChange={(e) => setWaFilter(e.target.value)}
                  className={usersStyles.filterSelect}
                  aria-label="Filter Status WhatsApp"
                >
                  <option value="All">Semua Status WA</option>
                  <option value="Verified">WA Terverifikasi</option>
                  <option value="Pending">Belum Verifikasi WA</option>
                  <option value="None">Tanpa Nomor WA</option>
                </select>

                {/* Filter Riwayat Belanja */}
                <select
                  value={shoppingFilter}
                  onChange={(e) => setShoppingFilter(e.target.value)}
                  className={usersStyles.filterSelect}
                  aria-label="Filter Aktivitas Belanja"
                >
                  <option value="All">Semua Belanja</option>
                  <option value="HasOrders">Pernah Belanja</option>
                  <option value="NoOrders">Belum Pernah</option>
                </select>

                {/* Sort By */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={usersStyles.filterSelect}
                  aria-label="Urutkan Data"
                >
                  <option value="newest">Terbaru</option>
                  <option value="name">Nama (A-Z)</option>
                  <option value="spend">Omset Terbanyak</option>
                  <option value="orders">Pesanan Terbanyak</option>
                </select>
              </div>
            </div>

            {/* Users Data Table - 100% Proportional, No Horizontal Scroll */}
            {loadingUsers ? (
              <div className={usersStyles.tableContainer} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Memuat daftar pengguna...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={usersStyles.tableContainer} style={{ padding: '3rem 1.5rem' }}>
                <div className={usersStyles.tabEmptyState}>
                  <svg className={usersStyles.tabEmptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <h4 className={usersStyles.tabEmptyTitle}>Tidak Ada Pengguna yang Sesuai</h4>
                  <p className={usersStyles.tabEmptyDesc}>
                    {search
                      ? `Tidak ditemukan akun yang cocok dengan kata kunci "${search}".`
                      : waFilter !== 'All'
                      ? `Tidak ada pengguna dengan filter status WhatsApp ini.`
                      : roleFilter !== 'All'
                      ? `Tidak ada pengguna yang terdaftar dengan role ini.`
                      : 'Belum ada pengguna yang terdaftar di sistem.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className={usersStyles.tableContainer}>
                <table className={usersStyles.usersTable}>
                  <thead>
                    <tr>
                      <th className={usersStyles.colUser}>Pengguna</th>
                      <th className={usersStyles.colWhatsapp}>WhatsApp / Kontak</th>
                      <th className={usersStyles.colRole}>Role</th>
                      <th className={usersStyles.colSpend}>Total Belanja</th>
                      <th className={usersStyles.colActions}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const roleObj = roles.find((r) => r.slug === user.role);
                      const roleDisplayName = roleObj ? roleObj.name : user.role.toUpperCase();
                      const isAdminRole = user.role === 'admin';
                      const waUrl = getWhatsAppUrl(user.phone, user.name);

                      return (
                        <tr key={user.id} className={usersStyles.tableRow}>
                          {/* Col 1: Pengguna (Nama, Avatar, Email) */}
                          <td className={usersStyles.colUser}>
                            <div className={usersStyles.userIdentityCell}>
                              <UserAvatar user={user} size="sm" />
                              <div className={usersStyles.userInfo}>
                                <div className={usersStyles.userName}>{user.name}</div>
                                <div className={usersStyles.userEmailSub}>{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: WhatsApp / Kontak */}
                          <td className={usersStyles.colWhatsapp}>
                            <div className={usersStyles.whatsappCell}>
                              <div className={usersStyles.whatsappInfo}>
                                {user.phone ? (
                                  <>
                                    <span className={usersStyles.phoneNumText}>
                                      {formatPhoneDisplay(user.phone)}
                                    </span>
                                    {user.phoneVerified ? (
                                      <span className={usersStyles.badgeWaVerified}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        WA Terverifikasi
                                      </span>
                                    ) : (
                                      <span className={usersStyles.badgeWaPending}>
                                        Belum Verif
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className={usersStyles.badgeWaEmpty}>Tanpa No. WA</span>
                                )}
                              </div>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={usersStyles.btnWaChat}
                                  title="Chat WhatsApp Pengguna"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                  </svg>
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Role */}
                          <td className={usersStyles.colRole}>
                            <span
                              className={roleStyles.userRoleBadge}
                              style={{
                                '--role-color': roleObj?.color || (isAdminRole ? '#FF6B35' : '#3B82F6'),
                              }}
                            >
                              <span className={roleStyles.userRoleBadgeDot} />
                              {roleDisplayName}
                            </span>
                          </td>

                          {/* Col 4: Total Belanja */}
                          <td className={usersStyles.colSpend}>
                            <div className={usersStyles.spendingCell}>
                              <span className={usersStyles.spendAmount}>
                                {formatIDR(user.totalSpent || 0)}
                              </span>
                              <span className={usersStyles.orderCountTag}>
                                {user.ordersCount || 0} pesanan
                              </span>
                            </div>
                          </td>

                          {/* Col 5: Aksi */}
                          <td className={usersStyles.colActions}>
                            <div className={usersStyles.actionGroup}>
                              <button
                                type="button"
                                className={usersStyles.btnControl}
                                onClick={() => setDetailUser(user)}
                                title="Buka Detail & Kontrol Aktivitas"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                Detail
                              </button>

                              {canManageUsers && (
                                <button
                                  type="button"
                                  onClick={() => setRoleModalUser(user)}
                                  className={usersStyles.btnRoleAction}
                                  title="Ubah Role"
                                >
                                  Role
                                </button>
                              )}

                              {canDeleteUsers && (
                                <button
                                  type="button"
                                  onClick={() => askDeleteUser(user)}
                                  className={usersStyles.btnDeleteAction}
                                  disabled={user.id === currentUser.id}
                                  title={
                                    user.id === currentUser.id
                                      ? 'Tidak dapat menghapus akun sendiri'
                                      : 'Hapus User'
                                  }
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

      {/* MODAL 1: DETAIL LENGKAP & KONTROL AKTIVITAS USER */}
      {detailUser && (
        <UserDetailModal
          isOpen={Boolean(detailUser)}
          onClose={() => setDetailUser(null)}
          user={detailUser}
          onUserUpdated={handleUserDeepUpdated}
        />
      )}

      {/* MODAL 2: UBAH ROLE CEPAT */}
      {roleModalUser && (
        <UserRoleModal
          key={roleModalUser.id}
          isOpen={Boolean(roleModalUser)}
          onClose={() => setRoleModalUser(null)}
          user={roleModalUser}
          roles={roles}
          onSaved={handleUserRoleSaved}
          currentUserId={currentUser.id}
        />
      )}

      {/* MODAL 3: KONFIRMASI HAPUS */}
      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
