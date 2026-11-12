'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';
import { useToast } from '@/context/ToastContext';
import styles from './addresses.module.css';

const PRESET_LABELS = ['Rumah', 'Kantor', 'Kos', 'Lainnya'];

function getBadgeVariantClass(label) {
    if (label === 'Rumah') return styles.labelBadgeSuccess;
    if (label === 'Kantor') return styles.labelBadgeInfo;
    if (label === 'Kos') return styles.labelBadgeNeutral;
    if (label === 'Lainnya') return '';
    return styles.labelBadgeCustom;
}

const emptyForm = { label: 'Rumah', recipientName: '', phone: '', streetAddress: '', rtRw: '', province: '', city: '', district: '', village: '', postalCode: '', isDefault: false };

export default function AddressesPage() {
    const { currentUser, isLoading: authLoading, fetchMyAddresses, createAddress, updateAddress, deleteAddress } = useAuth();
    const { toast, confirmDialog } = useToast();
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
    const [customLabels, setCustomLabels] = useState([]);
    const [showCustomLabelInput, setShowCustomLabelInput] = useState(false);
    const [customLabelDraft, setCustomLabelDraft] = useState('');

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
        setShowCustomLabelInput(false);
        setCustomLabelDraft('');
        setEditingId(null); setError(''); setShowForm(true);
    };

    const openEditForm = (addr) => {
        setForm({ label: addr.label, recipientName: addr.recipientName, phone: addr.phone, streetAddress: addr.streetAddress, rtRw: addr.rtRw, province: addr.province, city: addr.city, district: addr.district, village: addr.village, postalCode: addr.postalCode, isDefault: addr.isDefault });
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setAutofillTarget({ province: addr.province, city: addr.city, district: addr.district });
        setShowCustomLabelInput(false);
        setCustomLabelDraft('');
        setEditingId(addr.id); setError(''); setShowForm(true);
    };

    const availableLabels = Array.from(
        new Set([
            ...PRESET_LABELS,
            ...addresses.map((a) => (a.label || '').trim()).filter(Boolean),
            ...customLabels,
            ...(form.label ? [form.label.trim()] : []),
        ])
    );

    const handleApplyCustomLabel = () => {
        const cleaned = customLabelDraft.trim().slice(0, 30);
        if (!cleaned) return;
        setCustomLabels((prev) => (prev.includes(cleaned) ? prev : [...prev, cleaned]));
        setForm((p) => ({ ...p, label: cleaned }));
        setCustomLabelDraft('');
        setShowCustomLabelInput(false);
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
        if (!/^\d{5}$/.test(form.postalCode)) {
            setError('Kode pos harus terdiri dari 5 digit angka.');
            return;
        }
        const resolvedLabel = (showCustomLabelInput && customLabelDraft.trim() ? customLabelDraft.trim() : form.label).trim().slice(0, 30) || 'Rumah';
        const payload = { ...form, label: resolvedLabel };

        setSaving(true); setError('');
        try {
            if (editingId) {
                const updated = await updateAddress(editingId, payload);
                setAddresses(prev => prev.map(a => a.id === editingId ? updated : (payload.isDefault ? { ...a, isDefault: false } : a)));
            } else {
                const created = await createAddress(payload);
                setAddresses(prev => {
                    const list = payload.isDefault ? prev.map(a => ({ ...a, isDefault: false })) : prev;
                    return [...list, created];
                });
            }
            setShowCustomLabelInput(false);
            setCustomLabelDraft('');
            setShowForm(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmDialog({
            title: 'Hapus Alamat?',
            message: 'Apakah Anda yakin ingin menghapus alamat ini dari buku alamat?',
            confirmText: 'Hapus',
            cancelText: 'Batal',
            isDanger: true,
        });
        if (!confirmed) return;

        setDeletingId(id);
        try {
            await deleteAddress(id);
            setAddresses(prev => {
                const remaining = prev.filter(a => a.id !== id);
                fetchMyAddresses().then(setAddresses);
                return remaining;
            });
            toast.success('Alamat berhasil dihapus.');
        } catch {
            toast.error('Gagal menghapus alamat.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await updateAddress(id, { isDefault: true });
            setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
            toast.success('Alamat utama berhasil diperbarui.');
        } catch {
            toast.error('Gagal mengatur alamat utama.');
        }
    };

    if (authLoading && !currentUser) {
        return <div className={`skeleton-box ${styles.skeletonPanel}`} aria-busy="true" aria-label="Memuat alamat" />;
    }
    if (!currentUser) return null;

    return (
        <div className={styles.pagePadding}>
            <div className={styles.containerWrapper}>

                {/* Header */}
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.pageTitle}>Alamat Saya</h1>
                        <p className={styles.pageSubtitle}>Kelola alamat pengiriman untuk checkout lebih cepat.</p>
                    </div>
                    {!loading && !showForm && addresses.length > 0 && (
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
                                    {availableLabels.map((l) => {
                                        const active = form.label === l;
                                        return (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => {
                                                    setForm((p) => ({ ...p, label: l }));
                                                    setShowCustomLabelInput(false);
                                                }}
                                                className={`${styles.labelBtn} ${active ? styles.labelBtnActive : ''}`.trim()}
                                            >
                                                {l}
                                            </button>
                                        );
                                    })}
                                    {!showCustomLabelInput && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomLabelInput(true)}
                                            className={`${styles.labelBtn} ${styles.labelBtnAdd}`}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <line x1="12" y1="5" x2="12" y2="19" />
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Label Baru
                                        </button>
                                    )}
                                </div>

                                {showCustomLabelInput && (
                                    <div className={styles.customLabelRow}>
                                        <input
                                            type="text"
                                            maxLength={30}
                                            className={styles.customLabelInput}
                                            value={customLabelDraft}
                                            onChange={(e) => setCustomLabelDraft(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleApplyCustomLabel();
                                                } else if (e.key === 'Escape') {
                                                    setShowCustomLabelInput(false);
                                                    setCustomLabelDraft('');
                                                }
                                            }}
                                            placeholder="Mis. Gudang, Toko, Rumah Orang Tua"
                                            aria-label="Nama label alamat baru"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            className={styles.customLabelApplyBtn}
                                            onClick={handleApplyCustomLabel}
                                            disabled={!customLabelDraft.trim()}
                                        >
                                            Pakai
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.customLabelCancelBtn}
                                            onClick={() => {
                                                setShowCustomLabelInput(false);
                                                setCustomLabelDraft('');
                                            }}
                                        >
                                            Batal
                                        </button>
                                    </div>
                                )}
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
                                    {selectAlert.field === 'city' && (
                                        <span className={styles.selectAlert}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            {selectAlert.message}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label className={styles.label}>Kecamatan</label>
                                    <SearchableSelect options={districts} value={districtId} onChange={handleDistrict} disabled={!cityId} placeholder="-- Pilih Kecamatan --" onClickDisabled={() => triggerAlert('district', 'Pilih Kab/Kota terlebih dahulu.')} />
                                    {selectAlert.field === 'district' && (
                                        <span className={styles.selectAlert}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            {selectAlert.message}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label className={styles.label}>Kelurahan / Desa</label>
                                    <SearchableSelect options={villages} value={villages.find(v => v.name.toLowerCase() === form.village?.toLowerCase())?.id || ''} onChange={handleVillage} disabled={!districtId} placeholder="-- Pilih Kel/Desa --" onClickDisabled={() => triggerAlert('village', 'Pilih Kecamatan terlebih dahulu.')} />
                                    {selectAlert.field === 'village' && (
                                        <span className={styles.selectAlert}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            {selectAlert.message}
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <label className={styles.label}>RT / RW</label>
                                    <input className={styles.input} value={form.rtRw} onChange={e => setForm(p => ({ ...p, rtRw: e.target.value }))} required placeholder="RT 01 / RW 04" />
                                </div>
                                <div>
                                    <label className={styles.label}>Kode Pos</label>
                                    <input
                                        className={styles.input}
                                        inputMode="numeric"
                                        maxLength={5}
                                        value={form.postalCode}
                                        onChange={e => {
                                            const numeric = e.target.value.replace(/\D/g, '').slice(0, 5);
                                            setForm(p => ({ ...p, postalCode: numeric }));
                                        }}
                                        required
                                        placeholder="Contoh: 12190"
                                    />
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
                    <div className={styles.skeletonList} aria-busy="true" aria-label="Memuat daftar alamat">
                        <div className={`skeleton-box ${styles.skeletonAddressCard}`} />
                        <div className={`skeleton-box ${styles.skeletonAddressCard}`} />
                    </div>
                ) : addresses.length === 0 && !showForm ? (
                    <div className={styles.emptyStateCard}>
                        <span className={styles.emptyIcon} aria-hidden="true">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                        </span>
                        <h4 className={styles.emptyTitle}>Belum ada alamat tersimpan</h4>
                        <p className={styles.emptySubtitle}>Tambahkan alamat pengiriman agar proses checkout lebih cepat.</p>
                        <button onClick={openAddForm} className={`btn btn-primary ${styles.addBtn} ${styles.emptyAction}`}>
                            + Tambah Alamat
                        </button>
                    </div>
                ) : (
                    <div className={styles.addressListGrid}>
                        {addresses.map(addr => {
                            const badgeVariant = getBadgeVariantClass(addr.label);
                            return (
                                <div key={addr.id} className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}>
                                    {/* Badges */}
                                    <div className={styles.addressCardHeader}>
                                        <div className={styles.addressBadges}>
                                            <span className={`${styles.labelBadge} ${badgeVariant}`.trim()}>
                                                {addr.label}
                                            </span>
                                            {addr.isDefault && (
                                                <span className={styles.defaultBadge}>
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                    Utama
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
                                    <p className="font-bold text-[var(--text-main)] mb-1 text-base">{addr.recipientName}</p>
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

