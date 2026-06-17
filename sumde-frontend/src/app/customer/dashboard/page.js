'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function CustomerDashboard() {
    const { currentUser, isLoading: authLoading, updateUserProfile, fetchMyOrders } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'orders'
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: '',
        phone: '',
        streetAddress: '',
        rtRw: '',
        province: '',
        city: '',
        district: '',
        village: '',
        postalCode: ''
    });
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // States for administrative division API
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [villages, setVillages] = useState([]);

    const [provId, setProvId] = useState('');
    const [cityId, setCityId] = useState('');
    const [districtId, setDistrictId] = useState('');

    const [selectAlert, setSelectAlert] = useState({ field: '', message: '' });

    const triggerSelectAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => {
            setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev);
        }, 3000);
    };

    // Load user profile information
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser) {
                router.push('/login');
            } else {
                setProfileForm({
                    name: currentUser.name || '',
                    phone: currentUser.phone || '',
                    streetAddress: currentUser.streetAddress || '',
                    rtRw: currentUser.rtRw || '',
                    province: currentUser.province || '',
                    city: currentUser.city || '',
                    district: currentUser.district || '',
                    village: currentUser.village || '',
                    postalCode: currentUser.postalCode || ''
                });
            }
        }
    }, [currentUser, authLoading, router]);

    // 1. Fetch Provinces on mount
    useEffect(() => {
        if (currentUser) {
            fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
                .then(res => res.json())
                .then(data => {
                    setProvinces(data);
                    // Autofill province matching
                    if (currentUser.province) {
                        const match = data.find(p => p.name.toLowerCase() === currentUser.province.toLowerCase());
                        if (match) setProvId(match.id);
                    }
                })
                .catch(err => console.error('Gagal memuat provinsi:', err));
        }
    }, [currentUser]);

    // 2. Fetch Cities when province changes
    useEffect(() => {
        if (!provId) {
            setCities([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`)
            .then(res => res.json())
            .then(data => {
                setCities(data);
                // Autofill city matching
                if (currentUser?.city) {
                    const match = data.find(c => c.name.toLowerCase() === currentUser.city.toLowerCase());
                    if (match) setCityId(match.id);
                }
            })
            .catch(err => console.error('Gagal memuat kabupaten/kota:', err));
    }, [provId, currentUser]);

    // 3. Fetch Districts when city changes
    useEffect(() => {
        if (!cityId) {
            setDistricts([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
            .then(res => res.json())
            .then(data => {
                setDistricts(data);
                // Autofill district matching
                if (currentUser?.district) {
                    const match = data.find(d => d.name.toLowerCase() === currentUser.district.toLowerCase());
                    if (match) setDistrictId(match.id);
                }
            })
            .catch(err => console.error('Gagal memuat kecamatan:', err));
    }, [cityId, currentUser]);

    // 4. Fetch Villages when district changes
    useEffect(() => {
        if (!districtId) {
            setVillages([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
            .then(res => res.json())
            .then(data => setVillages(data))
            .catch(err => console.error('Gagal memuat kelurahan/desa:', err));
    }, [districtId]);

    // Load order history
    const loadMyOrders = async () => {
        setOrdersLoading(true);
        try {
            const data = await fetchMyOrders();
            setOrders(data);
        } catch (err) {
            console.error('Gagal memuat riwayat belanja:', err);
        } finally {
            setOrdersLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser && activeTab === 'orders') {
            loadMyOrders();
        }
    }, [activeTab, currentUser]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileSuccess(false);
        setProfileError('');
        setIsUpdating(true);

        try {
            await updateUserProfile(profileForm);
            setProfileSuccess(true);
            setTimeout(() => setProfileSuccess(false), 3000);
        } catch (err) {
            setProfileError(err.message || 'Gagal menyimpan profil.');
        } finally {
            setIsUpdating(false);
        }
    };

    // Dropdown Handlers
    const handleProvinceChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setProvId(id);
        setProfileForm(prev => ({
            ...prev,
            province: id ? name : '',
            city: '',
            district: '',
            village: ''
        }));
        setCityId('');
        setDistrictId('');
        setDistricts([]);
        setVillages([]);
    };

    const handleCityChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setCityId(id);
        setProfileForm(prev => ({
            ...prev,
            city: id ? name : '',
            district: '',
            village: ''
        }));
        setDistrictId('');
        setVillages([]);
    };

    const handleDistrictChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setDistrictId(id);
        setProfileForm(prev => ({
            ...prev,
            district: id ? name : '',
            village: ''
        }));
    };

    const handleVillageChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setProfileForm(prev => ({
            ...prev,
            village: id ? name : ''
        }));
    };

    const formattedCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
    };

    if (authLoading || !currentUser) {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center', color: 'var(--text-main)' }}>
                <h2>Memverifikasi Kredensial Pelanggan...</h2>
            </div>
        );
    }

    return (
        <div className="pageContainer" style={{ paddingTop: '100px', minHeight: '100vh' }}>
            <div className="container" style={{ paddingBottom: '5rem', maxWidth: '1000px' }}>
                {/* Header */}
                <div style={{ marginBottom: '3rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                    <span style={{ color: 'var(--primary)', letterSpacing: '0.2rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
                        Customer Area
                    </span>
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', fontStyle: 'italic', marginTop: '0.5rem', color: 'var(--text-main)' }}>
                        Halo, {currentUser.name}
                    </h1>
                </div>

                {/* Navigator */}
                <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid var(--border-color)', marginBottom: '3rem', paddingBottom: '1rem' }}>
                    {[
                        { id: 'profile', name: 'Profil Saya' },
                        { id: 'orders', name: 'Riwayat Belanja' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: activeTab === tab.id ? '700' : '500',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                paddingBottom: '1rem',
                                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
                                marginBottom: '-1.1rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Tab: Profile */}
                {activeTab === 'profile' && (
                    <div style={{ background: 'var(--bg-card)', padding: '3rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontStyle: 'italic', marginBottom: '2rem', color: 'var(--text-main)' }}>
                            Informasi Pengiriman & Kontak Resmi
                        </h3>

                        {profileSuccess && (
                            <div style={{ padding: '1rem', background: 'rgba(0,180,216,0.1)', border: '1px solid var(--secondary)', borderRadius: '8px', color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '2.5rem', textAlign: 'center' }}>
                                Profil berhasil diperbarui!
                            </div>
                        )}

                        {profileError && (
                            <div style={{ padding: '1rem', background: 'rgba(255,107,53,0.1)', border: '1px solid var(--primary)', borderRadius: '8px', color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '2.5rem', textAlign: 'center' }}>
                                {profileError}
                            </div>
                        )}

                        <form onSubmit={handleProfileSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nama Lengkap</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={profileForm.name}
                                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nomor Telepon</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                    placeholder="Contoh: 08123456789"
                                    required
                                />
                            </div>

                            {/* Cascading dropdown selectors */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Provinsi</label>
                                <select className="sortSelect" style={{ width: '100%' }} value={provId} onChange={handleProvinceChange} required>
                                    <option value="" className="sortOption">-- Pilih Provinsi --</option>
                                    {provinces.map(p => <option key={p.id} value={p.id} className="sortOption">{p.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kabupaten / Kota</label>
                                <div style={{ position: 'relative' }}>
                                    <select className="sortSelect" style={{ width: '100%' }} value={cityId} onChange={handleCityChange} disabled={!provId} required>
                                        <option value="" className="sortOption">-- Pilih Kabupaten/Kota --</option>
                                        {cities.map(c => <option key={c.id} value={c.id} className="sortOption">{c.name}</option>)}
                                    </select>
                                    {!provId && (
                                        <div 
                                            onClick={() => triggerSelectAlert('city', 'Silakan pilih Provinsi terlebih dahulu.')}
                                            style={{ 
                                                position: 'absolute', 
                                                top: 0, 
                                                left: 0, 
                                                right: 0, 
                                                bottom: 0, 
                                                cursor: 'not-allowed',
                                                zIndex: 10
                                            }}
                                        />
                                    )}
                                </div>
                                {selectAlert.field === 'city' && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                        ⚠️ {selectAlert.message}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kecamatan</label>
                                <div style={{ position: 'relative' }}>
                                    <select className="sortSelect" style={{ width: '100%' }} value={districtId} onChange={handleDistrictChange} disabled={!cityId} required>
                                        <option value="" className="sortOption">-- Pilih Kecamatan --</option>
                                        {districts.map(d => <option key={d.id} value={d.id} className="sortOption">{d.name}</option>)}
                                    </select>
                                    {!cityId && (
                                        <div 
                                            onClick={() => triggerSelectAlert('district', 'Silakan pilih Kabupaten / Kota terlebih dahulu.')}
                                            style={{ 
                                                position: 'absolute', 
                                                top: 0, 
                                                left: 0, 
                                                right: 0, 
                                                bottom: 0, 
                                                cursor: 'not-allowed',
                                                zIndex: 10
                                            }}
                                        />
                                    )}
                                </div>
                                {selectAlert.field === 'district' && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                        ⚠️ {selectAlert.message}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kelurahan / Desa</label>
                                <div style={{ position: 'relative' }}>
                                    <select className="sortSelect" style={{ width: '100%' }} value={profileForm.village ? villages.find(v => v.name.toLowerCase() === profileForm.village.toLowerCase())?.id || '' : ''} onChange={handleVillageChange} disabled={!districtId} required>
                                        <option value="" className="sortOption">-- Pilih Kelurahan/Desa --</option>
                                        {villages.map(v => <option key={v.id} value={v.id} className="sortOption">{v.name}</option>)}
                                    </select>
                                    {!districtId && (
                                        <div 
                                            onClick={() => triggerSelectAlert('village', 'Silakan pilih Kecamatan terlebih dahulu.')}
                                            style={{ 
                                                position: 'absolute', 
                                                top: 0, 
                                                left: 0, 
                                                right: 0, 
                                                bottom: 0, 
                                                cursor: 'not-allowed',
                                                zIndex: 10
                                            }}
                                        />
                                    )}
                                </div>
                                {selectAlert.field === 'village' && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                        ⚠️ {selectAlert.message}
                                    </span>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>RT / RW</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    placeholder="Contoh: RT 03 / RW 05"
                                    value={profileForm.rtRw}
                                    onChange={(e) => setProfileForm({ ...profileForm, rtRw: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Kode Pos</label>
                                <input
                                    type="text"
                                    className="search-input"
                                    style={{ width: '100%' }}
                                    value={profileForm.postalCode}
                                    onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Nama Jalan, No. Rumah, Blok</label>
                                <textarea
                                    className="search-input"
                                    style={{ width: '100%', minHeight: '80px', resize: 'none' }}
                                    value={profileForm.streetAddress}
                                    onChange={(e) => setProfileForm({ ...profileForm, streetAddress: e.target.value })}
                                    placeholder="Nama Jalan, Blok, No Rumah..."
                                    required
                                />
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '1.5rem' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%', padding: '1rem', cursor: 'pointer' }}
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? 'Menyimpan...' : 'Perbarui Profil'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Tab: Riwayat Belanja */}
                {activeTab === 'orders' && (
                    <div>
                        {ordersLoading ? (
                            <p style={{ color: 'var(--text-muted)' }}>Memuat riwayat transaksi...</p>
                        ) : orders.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '5rem 0', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                <span style={{ fontSize: '3rem' }}>🐟</span>
                                <h4 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-main)' }}>Belum Ada Transaksi</h4>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Amankan spesimen eksklusif Anda hari ini.</p>
                                <button onClick={() => router.push('/')} className="btn btn-outline" style={{ cursor: 'pointer' }}>Jelajahi Beranda</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                {orders.map(order => (
                                    <div key={order.id} style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                                            <div>
                                                <h4 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-main)' }}>Akuisisi #{order.id.slice(0, 8)}</h4>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    padding: '0.2rem 0.8rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid',
                                                    color: order.status === 'PAID' ? '#10B981' : '#F59E0B',
                                                    borderColor: order.status === 'PAID' ? '#10B981' : '#F59E0B',
                                                    fontWeight: '600'
                                                }}>{order.status === 'PAID' ? 'Pembayaran Sukses' : 'Menunggu Transfer'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                                            <div>
                                                {order.items.map(item => (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                        <span>{item.product?.name || 'Ikan telah dihapus'} (x{item.quantity})</span>
                                                        <span>{formattedCurrency(item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', fontWeight: '700', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                                    <span>Total Biaya</span>
                                                    <span>{formattedCurrency(order.total)}</span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                                <h5 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--primary)', letterSpacing: '0.1rem', marginBottom: '0.5rem' }}>Detail Pengiriman</h5>
                                                <p style={{ color: 'var(--text-main)', fontWeight: '500' }}>{order.name}</p>
                                                <p>Telp: {order.phone}</p>
                                                <p>{order.streetAddress}, {order.rtRw}</p>
                                                <p>Kel. {order.village}, Kec. {order.district}</p>
                                                <p>{order.city}, {order.province}, {order.postalCode}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
