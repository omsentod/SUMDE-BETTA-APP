'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';

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
        if (!provId) { setCities([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`)
            .then(r => r.json()).then(setCities).catch(() => {});
    }, [provId]);

    useEffect(() => {
        if (!cityId) { setDistricts([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
            .then(r => r.json()).then(setDistricts).catch(() => {});
    }, [cityId]);

    useEffect(() => {
        if (!districtId) { setVillages([]); return; }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
            .then(r => r.json()).then(setVillages).catch(() => {});
    }, [districtId]);

    const triggerAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev), 3000);
    };

    const openAddForm = () => {
        setForm(emptyForm);
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setEditingId(null); setError(''); setShowForm(true);
    };

    const openEditForm = (addr) => {
        setForm({ label: addr.label, recipientName: addr.recipientName, phone: addr.phone, streetAddress: addr.streetAddress, rtRw: addr.rtRw, province: addr.province, city: addr.city, district: addr.district, village: addr.village, postalCode: addr.postalCode, isDefault: addr.isDefault });
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setEditingId(addr.id); setError(''); setShowForm(true);
    };

    const handleProvince = (id, name) => {
        setProvId(id); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setForm(p => ({ ...p, province: name, city: '', district: '', village: '' }));
    };
    const handleCity = (id, name) => {
        setCityId(id); setDistrictId('');
        setDistricts([]); setVillages([]);
        setForm(p => ({ ...p, city: name, district: '', village: '' }));
    };
    const handleDistrict = (id, name) => {
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
                // If deleted was default, backend auto-sets next; refetch
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
        return <div className="pageContainer" style={{ paddingTop: '120px', textAlign: 'center' }}><h2 style={{ color: 'var(--text-muted)' }}>Memverifikasi akun...</h2></div>;
    }

    const inputStyle = { width: '100%', padding: '0.7rem 1rem', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' };

    return (
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '900px', paddingBottom: '5rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Customer Area</span>
                        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontStyle: 'italic', marginTop: '0.4rem', color: 'var(--text-main)' }}>Alamat Saya</h1>
                    </div>
                    {!showForm && (
                        <button onClick={openAddForm} className="btn btn-primary" style={{ cursor: 'pointer', alignSelf: 'center' }}>
                            + Tambah Alamat
                        </button>
                    )}
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <div className="dashboard-card" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontStyle: 'italic', marginBottom: '1.5rem', color: 'var(--text-main)' }}>
                            {editingId ? 'Edit Alamat' : 'Tambah Alamat Baru'}
                        </h3>

                        {error && <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: '8px', color: '#EF4444', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{error}</div>}

                        <form onSubmit={handleSubmit}>
                            {/* Label selector */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={labelStyle}>Label Alamat</label>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {LABELS.map(l => {
                                        const cfg = LABEL_COLORS[l];
                                        const active = form.label === l;
                                        return (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, label: l }))}
                                                style={{
                                                    padding: '0.4rem 1.1rem',
                                                    borderRadius: '20px',
                                                    border: `1px solid ${active ? cfg.color : 'var(--border-color)'}`,
                                                    background: active ? cfg.bg : 'transparent',
                                                    color: active ? cfg.color : 'var(--text-muted)',
                                                    fontWeight: '600',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                }}
                                            >{l}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid-form-2col">
                                <div>
                                    <label style={labelStyle}>Nama Penerima</label>
                                    <input style={inputStyle} value={form.recipientName} onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))} required placeholder="Nama lengkap penerima" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Nomor Telepon</label>
                                    <input style={inputStyle} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required placeholder="08xxxxxxxxxx" />
                                </div>

                                <div>
                                    <label style={labelStyle}>Provinsi</label>
                                    <SearchableSelect options={provinces} value={provId} onChange={handleProvince} placeholder="-- Pilih Provinsi --" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Kabupaten / Kota</label>
                                    <SearchableSelect options={cities} value={cityId} onChange={handleCity} disabled={!provId} placeholder="-- Pilih Kab/Kota --" onClickDisabled={() => triggerAlert('city', 'Pilih Provinsi terlebih dahulu.')} />
                                    {selectAlert.field === 'city' && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.3rem', display: 'block' }}>⚠️ {selectAlert.message}</span>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Kecamatan</label>
                                    <SearchableSelect options={districts} value={districtId} onChange={handleDistrict} disabled={!cityId} placeholder="-- Pilih Kecamatan --" onClickDisabled={() => triggerAlert('district', 'Pilih Kab/Kota terlebih dahulu.')} />
                                    {selectAlert.field === 'district' && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.3rem', display: 'block' }}>⚠️ {selectAlert.message}</span>}
                                </div>
                                <div>
                                    <label style={labelStyle}>Kelurahan / Desa</label>
                                    <SearchableSelect options={villages} value={villages.find(v => v.name.toLowerCase() === form.village?.toLowerCase())?.id || ''} onChange={handleVillage} disabled={!districtId} placeholder="-- Pilih Kel/Desa --" onClickDisabled={() => triggerAlert('village', 'Pilih Kecamatan terlebih dahulu.')} />
                                    {selectAlert.field === 'village' && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.3rem', display: 'block' }}>⚠️ {selectAlert.message}</span>}
                                </div>

                                <div>
                                    <label style={labelStyle}>RT / RW</label>
                                    <input style={inputStyle} value={form.rtRw} onChange={e => setForm(p => ({ ...p, rtRw: e.target.value }))} required placeholder="RT 01 / RW 04" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Kode Pos</label>
                                    <input style={inputStyle} value={form.postalCode} onChange={e => setForm(p => ({ ...p, postalCode: e.target.value }))} required placeholder="12345" />
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={labelStyle}>Nama Jalan, No. Rumah, Blok</label>
                                    <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'none' }} value={form.streetAddress} onChange={e => setForm(p => ({ ...p, streetAddress: e.target.value }))} required placeholder="Jl. Sudirman No. 12..." />
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                        <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                        Jadikan sebagai alamat utama
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ cursor: 'pointer' }} disabled={saving}>
                                    {saving ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Alamat')}
                                </button>
                                <button type="button" className="btn btn-outline" style={{ cursor: 'pointer' }} onClick={() => setShowForm(false)}>
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Address List */}
                {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Memuat alamat...</p>
                ) : addresses.length === 0 && !showForm ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '3rem' }}>📍</span>
                        <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-main)' }}>Belum ada alamat tersimpan</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Tambahkan alamat pengiriman untuk memudahkan transaksi.</p>
                        <button onClick={openAddForm} className="btn btn-primary" style={{ cursor: 'pointer' }}>+ Tambah Alamat</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {addresses.map(addr => {
                            const cfg = LABEL_COLORS[addr.label] || LABEL_COLORS.Lainnya;
                            return (
                                <div key={addr.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: addr.isDefault ? '1.5px solid var(--primary)' : '1px solid var(--border-color)', padding: '1.5rem', position: 'relative', transition: 'border-color 0.2s' }}>
                                    {/* Badges */}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}` }}>
                                            {addr.label}
                                        </span>
                                        {addr.isDefault && (
                                            <span style={{ padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'rgba(255,107,53,0.1)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                                                ★ Utama
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <p style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem', fontSize: '1rem' }}>{addr.recipientName}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>{addr.phone}</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                        {addr.streetAddress}, {addr.rtRw}, Kel. {addr.village}, Kec. {addr.district},<br />
                                        {addr.city}, {addr.province} {addr.postalCode}
                                    </p>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                        {!addr.isDefault && (
                                            <button onClick={() => handleSetDefault(addr.id)} style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                                                Jadikan Utama
                                            </button>
                                        )}
                                        <button onClick={() => openEditForm(addr)} style={{ fontSize: '0.8rem', color: 'var(--text-main)', background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(addr.id)}
                                            disabled={deletingId === addr.id}
                                            style={{ fontSize: '0.8rem', color: '#EF4444', background: 'none', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}
                                        >
                                            {deletingId === addr.id ? 'Menghapus...' : 'Hapus'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
