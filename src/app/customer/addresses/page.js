'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';
import styles from './addresses.module.css';

const LABELS = ['Rumah', 'Kantor', 'Kos', 'Lainnya'];

const LABEL_COLORS = {
    Rumah:   { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    Kantor:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    Kos:     { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    Lainnya: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

const emptyForm = { label: 'Rumah', recipientName: '', phone: '', streetAddress: '', rtRw: '', province: '', city: '', district: '', village: '', postalCode: '', isDefault: false };

export default function AddressesPage() {
    const { currentUser, isLoading: authLoading, fetchMyAddresses, createAddress, updateAddress, deleteAddress } = useAuth();
    const router = useRouter();

    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    // Wilayah state for cascading dropdowns
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [villages, setVillages] = useState([]);
    const [provId, setProvId] = useState('');
    const [cityId, setCityId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [autofillTarget, setAutofillTarget] = useState(null);
    const [selectAlert, setSelectAlert] = useState({ field: '', message: '' });

    useEffect(() => {
        if (!authLoading && !currentUser) router.push('/login');
    }, [authLoading, currentUser, router]);

    useEffect(() => {
        if (!currentUser) return;
        fetchMyAddresses().then(data => { setAddresses(data); setLoading(false); });
    }, [currentUser]);

    useEffect(() => {
        fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
            .then(r => r.json()).then(setProvinces).catch(() => {});
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!provId) { setCities([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`)
            .then(r => r.json()).then(setCities).catch(() => {});
    }, [provId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!cityId) { setDistricts([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
            .then(r => r.json()).then(setDistricts).catch(() => {});
    }, [cityId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!districtId) { setVillages([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
            .then(r => r.json()).then(setVillages).catch(() => {});
    }, [districtId]);

    useEffect(() => {
        if (!autofillTarget?.province || provinces.length === 0) return;
        const m = provinces.find(p => p.name.toLowerCase() === autofillTarget.province.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (m) setProvId(m.id);
    }, [autofillTarget, provinces]);

    useEffect(() => {
        if (!autofillTarget?.city || cities.length === 0) return;
        const m = cities.find(c => c.name.toLowerCase() === autofillTarget.city.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (m) setCityId(m.id);
    }, [autofillTarget, cities]);

    useEffect(() => {
        if (!autofillTarget?.district || districts.length === 0) return;
        const m = districts.find(d => d.name.toLowerCase() === autofillTarget.district.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (m) setDistrictId(m.id);
    }, [autofillTarget, districts]);

    const triggerAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev), 3000);
    };

    const openAddForm = () => {
        setForm(emptyForm);
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setAutofillTarget(null);
        setEditingId(null); setError(''); setShowForm(true);
    };

    const openEditForm = (addr) => {
        setForm({ label: addr.label, recipientName: addr.recipientName, phone: addr.phone, streetAddress: addr.streetAddress, rtRw: addr.rtRw, province: addr.province, city: addr.city, district: addr.district, village: addr.village, postalCode: addr.postalCode, isDefault: addr.isDefault });
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setAutofillTarget({ province: addr.province, city: addr.city, district: addr.district });
        setEditingId(addr.id); setError(''); setShowForm(true);
    };

    const handleProvince = (id, name) => {
        setAutofillTarget(null);
        setProvId(id); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setForm(p => ({ ...p, province: name, city: '', district: '', village: '' }));
    };
    const handleCity = (id, name) => {
        setAutofillTarget(null);
        setCityId(id); setDistrictId('');
        setDistricts([]); setVillages([]);
        setForm(p => ({ ...p, city: name, district: '', village: '' }));
    };
    const handleDistrict = (id, name) => {
        setAutofillTarget(null);
        setDistrictId(id); setVillages([]);
        setForm(p => ({ ...p, district: name, village: '' }));
    };
    const handleVillage = (id, name) => {
        setForm(p => ({ ...p, village: name }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true); setError('');
        try {
            if (editingId) {
                const updated = await updateAddress(editingId, form);
                setAddresses(prev => prev.map(a => a.id === editingId ? updated : (form.isDefault ? { ...a, isDefault: false } : a)));
            } else {
                const created = await createAddress(form);
                setAddresses(prev => {
                    const list = form.isDefault ? prev.map(a => ({ ...a, isDefault: false })) : prev;
                    return [...list, created];
                });
            }
            setShowForm(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            await deleteAddress(id);
            setAddresses(prev => {
                const remaining = prev.filter(a => a.id !== id);
                fetchMyAddresses().then(setAddresses);
                return remaining;
            });
        } catch {
            alert('Gagal menghapus alamat.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await updateAddress(id, { isDefault: true });
            setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
        } catch {
            alert('Gagal mengatur alamat utama.');
        }
    };

    if (authLoading || !currentUser) {
        return <div className="pageContainer pt-[120px] text-center"><h2 className="text-[var(--text-muted)]">Memverifikasi akun...</h2></div>;
    }

    return (
        <div className={`pageContainer ${styles.pagePadding}`}>
            <div className={`container ${styles.containerWrapper}`}>

                {/* Header */}
                <div className={styles.headerRow}>
                    <div>
                        <span className="text-[var(--primary)] tracking-[0.2rem] text-[0.75rem] font-bold uppercase">Customer Area</span>
                        <h1 className="font-[var(--font-serif)] text-[2.5rem] italic mt-[0.4rem] text-[var(--text-main)]">Alamat Saya</h1>
                    </div>
                    {!showForm && (
                        <button onClick={openAddForm} className={`btn btn-primary ${styles.addBtn}`}>
                            + Tambah Alamat
                        </button>
                    )}
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className={`dashboard-card ${styles.formCard}`}>
                        <h3 className={styles.formTitle}>
                            {editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}
                        </h3>

                        {error && <div className={styles.errorAlert}>{error}</div>}

                        <form onSubmit={handleSubmit}>
                            {/* Label selector */}
                            <div className={styles.labelSection}>
                                <label className={styles.label}>Label Alamat</label>
                                <div className={styles.labelGroup}>
                                    {LABELS.map(l => {
                                        const cfg = LABEL_COLORS[l];
                                        const active = form.label === l;
                                        return (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, label: l }))}
                                                className={styles.labelBtn}
                                                style={{
                                                    borderColor: active ? cfg.color : undefined,
                                                    background: active ? cfg.bg : undefined,
                                                    color: active ? cfg.color : undefined,
                                                }}
                                            >{l}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid-form-2col">
                                <div>
                                    <label className={styles.label}>Nama Penerima</label>
                                    <input className={styles.input} value={form.recipientName} onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))} required placeholder="Nama lengkap penerima" />
                                </div>
                                <div>
                                    <label className={styles.label}>Nomor Telepon</label>
                                    <input className={styles.input} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required placeholder="08xxxxxxxxxx" />
                                </div>

                                <div>
                                    <label className={styles.label}>Provinsi</label>
                                    <SearchableSelect options={provinces} value={provId} onChange={handleProvince} placeholder="-- Pilih Provinsi --" />
                                </div>
                                <div>
                                    <label className={styles.label}>Kabupaten / Kota</label>
                                    <SearchableSelect options={cities} value={cityId} onChange={handleCity} disabled={!provId} placeholder="-- Pilih Kab/Kota --" onClickDisabled={() => triggerAlert('city', 'Pilih Provinsi terlebih dahulu.')} />
                                    {selectAlert.field === 'city' && <span className={styles.selectAlert}>⚠️ {selectAlert.message}</span>}
                                </div>
                                <div>
                                    <label className={styles.label}>Kecamatan</label>
                                    <SearchableSelect options={districts} value={districtId} onChange={handleDistrict} disabled={!cityId} placeholder="-- Pilih Kecamatan --" onClickDisabled={() => triggerAlert('district', 'Pilih Kab/Kota terlebih dahulu.')} />
                                    {selectAlert.field === 'district' && <span className={styles.selectAlert}>⚠️ {selectAlert.message}</span>}
                                </div>
                                <div>
                                    <label className={styles.label}>Kelurahan / Desa</label>
                                    <SearchableSelect options={villages} value={villages.find(v => v.name.toLowerCase() === form.village?.toLowerCase())?.id || ''} onChange={handleVillage} disabled={!districtId} placeholder="-- Pilih Kel/Desa --" onClickDisabled={() => triggerAlert('village', 'Pilih Kecamatan terlebih dahulu.')} />
                                    {selectAlert.field === 'village' && <span className={styles.selectAlert}>⚠️ {selectAlert.message}</span>}
                                </div>

                                <div>
                                    <label className={styles.label}>RT / RW</label>
                                    <input className={styles.input} value={form.rtRw} onChange={e => setForm(p => ({ ...p, rtRw: e.target.value }))} required placeholder="RT 01 / RW 04" />
                                </div>
                                <div>
                                    <label className={styles.label}>Kode Pos</label>
                                    <input className={styles.input} value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))} required placeholder="12345" />
                                </div>

                                <div className={styles.fullCol}>
                                    <label className={styles.label}>Nama Jalan, No. Rumah, Blok</label>
                                    <textarea className={`${styles.input} ${styles.textarea}`} value={form.streetAddress} onChange={e => setForm(p => ({ ...p, streetAddress: e.target.value }))} required placeholder="Jl. Sudirman No. 12..." />
                                </div>

                                <div className={styles.checkboxContainer}>
                                    <label className="flex items-center gap-2 cursor-pointer text-[0.9rem] text-[var(--text-main)]">
                                        <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} className={styles.checkbox} />
                                        Jadikan sebagai alamat utama
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formActions}>
                                <button type="submit" className={`btn btn-primary ${styles.saveBtn}`} disabled={saving}>
                                    {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Alamat')}
                                </button>
                                <button type="button" className={`btn btn-outline ${styles.cancelBtn}`} onClick={() => setShowForm(false)}>
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Address List */}
                {loading ? (
                    <p className="text-[var(--text-muted)]">Memuat alamat...</p>
                ) : addresses.length === 0 && !showForm ? (
                    <div className={styles.emptyStateCard}>
                        <span className={styles.emptyIcon}>📍</span>
                        <h4 className={styles.emptyTitle}>Belum ada alamat tersimpan</h4>
                        <p className={styles.emptySubtitle}>Tambahkan alamat pengiriman untuk memudahkan transaksi.</p>
                        <button onClick={openAddForm} className={`btn btn-primary ${styles.addBtn}`}>+ Tambah Alamat</button>
                    </div>
                ) : (
                    <div className={styles.addressListGrid}>
                        {addresses.map(addr => {
                            const cfg = LABEL_COLORS[addr.label] || LABEL_COLORS.Lainnya;
                            return (
                                <div key={addr.id} className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}>
                                    {/* Badges */}
                                    <div className={styles.addressCardHeader}>
                                        <div className={styles.addressBadges}>
                                            <span className={styles.labelBadge} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}` }}>
                                                {addr.label}
                                            </span>
                                            {addr.isDefault && (
                                                <span className={styles.defaultBadge}>
                                                    ★ Utama
                                                </span>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className={styles.cardActionGroup}>
                                            {!addr.isDefault && (
                                                <button onClick={() => handleSetDefault(addr.id)} className={styles.cardActionBtnDefault}>
                                                    Jadikan Utama
                                                </button>
                                            )}
                                            <button onClick={() => openEditForm(addr)} className={styles.cardActionBtn}>
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(addr.id)}
                                                disabled={deletingId === addr.id}
                                                className={`${styles.cardActionBtn} ${styles.cardActionBtnDelete}`}
                                            >
                                                {deletingId === addr.id ? 'Menghapus...' : 'Hapus'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <p className="font-bold color-[var(--text-main)] mb-1 text-base">{addr.recipientName}</p>
                                    <p className="text-[var(--text-muted)] text-sm mb-1">{addr.phone}</p>
                                    <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                        {addr.streetAddress}, {addr.rtRw}, Kel. {addr.village}, Kec. {addr.district},<br />
                                        {addr.city}, {addr.province} {addr.postalCode}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

