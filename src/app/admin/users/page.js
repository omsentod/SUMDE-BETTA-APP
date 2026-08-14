'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import styles from '../dashboard/adminDashboard.module.css';

export default function AdminUsersPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
      loadUsers();
    }
  }, [currentUser]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === 'All' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'customer' : 'admin';
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role: newRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const askDelete = (user) => {
    if (user.id === currentUser.id) {
      alert('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    confirm.open({
      title: 'Hapus User',
      desc: `Apakah Anda yakin ingin menghapus akun "${user.name}" (${user.email})?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users?id=${user.id}`, { method: 'DELETE' });
          if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== user.id));
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return (
      <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
        <h2>Memverifikasi Otoritas Admin...</h2>
      </div>
    );
  }

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Master Data</span>
            <h1 className={styles.headerTitle}>Kelola User</h1>
          </div>
        </div>

        <div className={styles.controlBar}>
          <div className={styles.searchBox}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Cari nama atau email pengguna..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={styles.selectInput}>
              <option value="All">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="customer">Customer</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Memuat pengguna...</p>
        ) : filtered.length === 0 ? (
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Tidak ada pengguna yang sesuai dengan pencarian.
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th className={styles.hideOnMobile}>Email</th>
                  <th>Role</th>
                  <th className={styles.hideOnMobile}>No. Telepon</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className={styles.tableRow}>
                    <td style={{ fontWeight: '600', maxWidth: '160px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                    </td>
                    <td className={styles.hideOnMobile}>{user.email}</td>
                    <td>
                      <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeWarning : styles.badgeInfo}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.hideOnMobile} style={{ color: 'var(--text-muted)' }}>{user.phone || '-'}</td>
                    <td>
                      <div className={styles.actionGroup}>
                        <button
                          onClick={() => handleToggleRole(user)}
                          className="btn btn-outline"
                          style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                        >
                          Ubah Role
                        </button>
                        <button
                          onClick={() => askDelete(user)}
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          disabled={user.id === currentUser.id}
                          title="Hapus User"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
