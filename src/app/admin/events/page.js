'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import AdminConfirmModal, { useConfirmModal } from '@/components/admin/AdminConfirmModal';
import styles from '../dashboard/adminDashboard.module.css';

const emptyEventForm = () => ({
  title: '',
  subtitle: '',
  description: '',
  image: '/betta-2.png',
  targetUrl: '',
  buttonText: 'Lihat Event',
  isActive: true,
  startDate: '',
  endDate: '',
});

const formatDateInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AdminEventsPage() {
  const { currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState(null);
  const [form, setForm] = useState(emptyEventForm());

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      if (res.ok) setEvents(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
      loadEvents();
    }
  }, [currentUser]);

  const filtered = useMemo(() => {
    return events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));
  }, [events, search]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar.');
      setForm((prev) => ({ ...prev, image: data.url }));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const openAdd = () => {
    setForm(emptyEventForm());
    setIsAddOpen(true);
  };

  const openEdit = (event) => {
    setCurrentEdit(event);
    setForm({
      title: event.title,
      subtitle: event.subtitle || '',
      description: event.description,
      image: event.image,
      targetUrl: event.targetUrl,
      buttonText: event.buttonText || 'Lihat Event',
      isActive: event.isActive,
      startDate: formatDateInput(event.startDate),
      endDate: formatDateInput(event.endDate),
    });
    setIsEditOpen(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambahkan event.');
      setEvents((prev) => [data, ...prev]);
      setIsAddOpen(false);
      setForm(emptyEventForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentEdit.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui event.');
      setEvents((prev) => prev.map((ev) => (ev.id === currentEdit.id ? data : ev)));
      setIsEditOpen(false);
      setCurrentEdit(null);
      setForm(emptyEventForm());
    } catch (err) {
      alert(err.message);
    }
  };

  const askDelete = (event) => {
    confirm.open({
      title: 'Hapus Event Banner',
      desc: `Apakah Anda yakin ingin menghapus event "${event.title}"?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/events?id=${event.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus event.');
          setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
        } catch (err) {
          alert(err.message);
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

  const isModalOpen = isAddOpen || isEditOpen;

  return (
    <div className={styles.dashboardWrapper}>
      <div className="container">
        <div className={styles.dashboardHeader}>
          <div>
            <span className={styles.headerBadge}>Master Data</span>
            <h1 className={styles.headerTitle}>Kelola Event</h1>
          </div>
          <div className={styles.headerButtons}>
            <button
              onClick={openAdd}
              className="btn btn-primary"
              style={{ borderRadius: '30px', padding: '0.65rem 1.4rem' }}
            >
              + Tambah Event
            </button>
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
              placeholder="Cari judul event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Memuat event...</p>
        ) : filtered.length === 0 ? (
          <div className={styles.tableCard} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Belum ada event terdaftar.
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Banner</th>
                  <th>Judul Event</th>
                  <th className={styles.hideOnMobile}>Link Target</th>
                  <th className={styles.hideOnMobile}>Jadwal Waktu</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => {
                  const now = new Date();
                  const start = event.startDate ? new Date(event.startDate) : null;
                  const end = event.endDate ? new Date(event.endDate) : null;

                  let timeStatus = 'Aktif';
                  let badgeStyle = styles.badgeSuccess;

                  if (!event.isActive) {
                    timeStatus = 'Nonaktif';
                    badgeStyle = styles.badgeMuted;
                  } else if (start && start > now) {
                    timeStatus = 'Segera';
                    badgeStyle = styles.badgeInfo;
                  } else if (end && end < now) {
                    timeStatus = 'Selesai';
                    badgeStyle = styles.badgeDanger;
                  }

                  return (
                    <tr key={event.id} className={styles.tableRow}>
                      <td>
                        <div className={styles.eventThumb}>
                          <Image src={event.image} alt={event.title} fill style={{ objectFit: 'cover' }} />
                        </div>
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        <div>{event.title}</div>
                        {event.subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{event.subtitle}</div>}
                      </td>
                      <td className={styles.hideOnMobile} style={{ fontSize: '0.85rem' }}>
                        <a href={event.targetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                          {event.targetUrl.length > 30 ? `${event.targetUrl.slice(0, 30)}...` : event.targetUrl}
                        </a>
                      </td>
                      <td className={styles.hideOnMobile} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        <div>Mulai: {start ? start.toLocaleString('id-ID') : 'Langsung'}</div>
                        <div>Selesai: {end ? end.toLocaleString('id-ID') : 'Selamanya'}</div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${badgeStyle}`}>{timeStatus}</span>
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          <button onClick={() => openEdit(event)} className={styles.iconBtn} title="Edit Event">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button onClick={() => askDelete(event)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Hapus Event">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
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

      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalContainer}>
            <h3 className={styles.modalTitle}>{isAddOpen ? 'Tambah Event Baru' : 'Edit Detail Event'}</h3>
            <form onSubmit={isAddOpen ? handleAdd : handleEditSubmit} className={styles.formGrid}>
              <div className={styles.formFullWidth}>
                <label className={styles.formLabel}>Judul Event / Promo</label>
                <input
                  type="text"
                  placeholder="Contoh: TikTok Shop Live Streaming"
                  className={styles.formInput}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel}>Subjudul Event (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Dapatkan diskon 50% dan gift menarik selama live!"
                  className={styles.formInput}
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel}>Deskripsi Event</label>
                <textarea
                  placeholder="Jelaskan detail event Anda..."
                  className={styles.formInput}
                  style={{ minHeight: '80px', resize: 'none' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className={styles.formLabel}>Link Target (URL)</label>
                <input
                  type="url"
                  placeholder="Contoh: https://tiktok.com/@sumdebetta/live"
                  className={styles.formInput}
                  value={form.targetUrl}
                  onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className={styles.formLabel}>Teks Tombol (Button Text)</label>
                <input
                  type="text"
                  placeholder="Contoh: Gabung Live, Beli Sekarang"
                  className={styles.formInput}
                  value={form.buttonText}
                  onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className={styles.formLabel}>Waktu Mulai (Opsional)</label>
                <input
                  type="datetime-local"
                  className={styles.formInput}
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className={styles.formLabel}>Waktu Selesai (Opsional)</label>
                <input
                  type="datetime-local"
                  className={styles.formInput}
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>

              <div className={styles.formFullWidth}>
                <label className={styles.formLabel} style={{ textAlign: 'center' }}>Banner / Gambar Promosi</label>
                <div className={styles.uploadBox}>
                  <div className={styles.eventPreviewThumb}>
                    {form.image ? (
                      <Image src={form.image} alt="Preview Banner" fill style={{ objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        No Image Preview
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="file" accept="image/*" onChange={handleFileUpload} id="event-image-upload" style={{ display: 'none' }} />
                    <label htmlFor="event-image-upload" className="btn btn-outline" style={{ cursor: 'pointer', padding: '0.6rem 1.5rem', fontSize: '0.85rem', borderRadius: '30px' }}>
                      {isUploading ? 'Mengunggah...' : 'Pilih Banner dari Komputer'}
                    </label>
                    {uploadError && <p style={{ fontSize: '0.75rem', color: '#EF4444' }}>Error: {uploadError}</p>}
                  </div>
                </div>
              </div>

              <div className={styles.formFullWidth} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.2rem' }}>
                <input
                  type="checkbox"
                  id="isEventActiveCheck"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="isEventActiveCheck" style={{ fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Event Aktif (Ditampilkan di Website)
                </label>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.9rem', borderRadius: '30px' }}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminConfirmModal state={confirm.state} onClose={confirm.close} />
    </div>
  );
}
