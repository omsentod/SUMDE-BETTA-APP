'use client';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import SearchableSelect from '@/components/SearchableSelect';

export default function CheckoutPage() {
    const { checkoutItems: cart, checkoutTotal: total, updateQuantity, removeFromCart } = useCart();
    const { currentUser, fetchMyAddresses, createAddress } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        streetAddress: '',
        rtRw: '',
        province: '',
        city: '',
        district: '',
        village: '',
        postalCode: ''
    });

    // States for administrative division API
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [villages, setVillages] = useState([]);

    const [provId, setProvId] = useState('');
    const [cityId, setCityId] = useState('');
    const [districtId, setDistrictId] = useState('');

    // Saved-address picker state
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [autofillTarget, setAutofillTarget] = useState(null); // { province, city, district } names to resolve into dropdown IDs
    const [savingAddress, setSavingAddress] = useState(false);

    const [selectAlert, setSelectAlert] = useState({ field: '', message: '' });

    const triggerSelectAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => {
            setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev);
        }, 3000);
    };

    // Fill the form from a saved Address record (from the address book)
    const applyAddress = (addr) => {
        setFormData({
            name: addr.recipientName || '',
            email: currentUser?.email || '',
            phone: addr.phone || '',
            streetAddress: addr.streetAddress || '',
            rtRw: addr.rtRw || '',
            province: addr.province || '',
            city: addr.city || '',
            district: addr.district || '',
            village: addr.village || '',
            postalCode: addr.postalCode || ''
        });
        // Reset region IDs so the cascading selects re-resolve from the names
        setProvId(''); setCityId(''); setDistrictId('');
        setCities([]); setDistricts([]); setVillages([]);
        setAutofillTarget({ province: addr.province, city: addr.city, district: addr.district });
        setSelectedAddressId(addr.id);
    };

    // Fallback: fill the form from the user's own profile columns
    const applyProfile = () => {
        if (!currentUser) return;
        setFormData({
            name: currentUser.name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            streetAddress: currentUser.streetAddress || '',
            rtRw: currentUser.rtRw || '',
            province: currentUser.province || '',
            city: currentUser.city || '',
            district: currentUser.district || '',
            village: currentUser.village || '',
            postalCode: currentUser.postalCode || ''
        });
        setAutofillTarget({ province: currentUser.province, city: currentUser.city, district: currentUser.district });
    };

    // Load saved addresses on mount; auto-fill the default one (else profile)
    useEffect(() => {
        if (!currentUser) return;
        let cancelled = false;
        fetchMyAddresses().then(list => {
            if (cancelled) return;
            setSavedAddresses(list);
            const def = list.find(a => a.isDefault) || list[0];
            if (def) applyAddress(def);
            else applyProfile();
        });
        return () => { cancelled = true; };
    }, [currentUser]);

    // Fetch provinces once on mount
    useEffect(() => {
        fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
            .then(res => res.json())
            .then(setProvinces)
            .catch(err => console.error('Gagal memuat provinsi:', err));
    }, []);

    // Resolve province ID from the autofill target name
    useEffect(() => {
        if (!autofillTarget?.province || provinces.length === 0) return;
        const match = provinces.find(p => p.name.toLowerCase() === autofillTarget.province.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (match) setProvId(match.id);
    }, [autofillTarget, provinces]);

    // Fetch cities when province changes
    useEffect(() => {
        if (!provId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCities([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`)
            .then(res => res.json())
            .then(setCities)
            .catch(err => console.error('Gagal memuat kabupaten/kota:', err));
    }, [provId]);

    // Resolve city ID from the autofill target name
    useEffect(() => {
        if (!autofillTarget?.city || cities.length === 0) return;
        const match = cities.find(c => c.name.toLowerCase() === autofillTarget.city.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (match) setCityId(match.id);
    }, [autofillTarget, cities]);

    // Fetch districts when city changes
    useEffect(() => {
        if (!cityId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDistricts([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
            .then(res => res.json())
            .then(setDistricts)
            .catch(err => console.error('Gagal memuat kecamatan:', err));
    }, [cityId]);

    // Resolve district ID from the autofill target name
    useEffect(() => {
        if (!autofillTarget?.district || districts.length === 0) return;
        const match = districts.find(d => d.name.toLowerCase() === autofillTarget.district.toLowerCase());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- API-driven cascading autofill
        if (match) setDistrictId(match.id);
    }, [autofillTarget, districts]);

    // Fetch villages when district changes
    useEffect(() => {
        if (!districtId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setVillages([]);
            return;
        }
        fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
            .then(res => res.json())
            .then(setVillages)
            .catch(err => console.error('Gagal memuat kelurahan/desa:', err));
    }, [districtId]);

    const formattedTotal = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(total);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Dropdown Handlers — receive (id, name) directly from SearchableSelect
    const handleProvinceChange = (id, name) => {
        setAutofillTarget(null);
        setSelectedAddressId(null);
        setProvId(id);
        setFormData(prev => ({
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

    const handleCityChange = (id, name) => {
        setAutofillTarget(null);
        setSelectedAddressId(null);
        setCityId(id);
        setFormData(prev => ({
            ...prev,
            city: id ? name : '',
            district: '',
            village: ''
        }));
        setDistrictId('');
        setVillages([]);
    };

    const handleDistrictChange = (id, name) => {
        setAutofillTarget(null);
        setSelectedAddressId(null);
        setDistrictId(id);
        setFormData(prev => ({
            ...prev,
            district: id ? name : '',
            village: ''
        }));
    };

    const handleVillageChange = (id, name) => {
        setFormData(prev => ({
            ...prev,
            village: id ? name : ''
        }));
    };

    // Save the currently-entered form as a new entry in the address book
    const handleSaveAddress = async () => {
        const { name, phone, streetAddress, rtRw, province, city, district, village, postalCode } = formData;
        if (!name || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
            alert('Lengkapi seluruh detail alamat terlebih dahulu sebelum menyimpan.');
            return;
        }
        setSavingAddress(true);
        try {
            const created = await createAddress({
                label: 'Rumah',
                recipientName: name,
                phone,
                streetAddress,
                rtRw,
                province,
                city,
                district,
                village,
                postalCode,
                isDefault: savedAddresses.length === 0
            });
            setSavedAddresses(prev => [...prev, created]);
            setSelectedAddressId(created.id);
            alert('Alamat berhasil disimpan ke buku alamat.');
        } catch (err) {
            alert(err.message || 'Gagal menyimpan alamat.');
        } finally {
            setSavingAddress(false);
        }
    };

    const handleProceed = (e) => {
        e.preventDefault();
        const { name, phone, streetAddress, rtRw, province, city, district, village, postalCode } = formData;
        if (!name || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
            alert('Mohon lengkapi seluruh detail pengiriman.');
            return;
        }
        localStorage.setItem('temp-shipment', JSON.stringify(formData));
        router.push('/payment');
    };

    if (cart.length === 0) {
        return (
            <div className="container" style={{ padding: '10rem 0', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem' }}>Inventaris Anda Kosong</h2>
                <Link href="/produk" className="btn btn-primary" style={{ marginTop: '2rem' }}>Jelajahi Galeri</Link>
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <section className="checkout-section">
                <div className="container">
                    <h1 className="checkout-title">Ringkasan Akuisisi</h1>

                    <div className="grid-checkout-outer">

                        <div className="checkout-left">
                            <div className="cart-items" style={{ marginBottom: '4rem' }}>
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Spesimen Terpilih</h3>
                                {cart.map((item) => (
                                    <div key={`${item.id}-${item.selectedSize}`} className="checkout-item-row">
                                        <div className="checkout-item-image">
                                            <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div className="checkout-item-info">
                                            <h3>{item.name}</h3>
                                            <p className="checkout-item-sub">Spesimen {item.category}</p>
                                            {item.selectedSize && (
                                                <p className="checkout-item-size">
                                                    Size: {item.selectedSize}
                                                </p>
                                            )}
                                        </div>
                                        <div className="qty-control">
                                            <button onClick={() => updateQuantity(item.id, -1, item.selectedSize)} className="qty-btn" style={{ cursor: 'pointer' }}>-</button>
                                            <span style={{ color: 'var(--text-main)' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1, item.selectedSize)} className="qty-btn" style={{ cursor: 'pointer' }}>+</button>
                                        </div>
                                        <div className="checkout-item-price">
                                            <p>
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}
                                            </p>
                                            <button onClick={() => removeFromCart(item.id, item.selectedSize)} className="checkout-item-delete">
                                                HAPUS
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="checkout-form-container">
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Detail Pengiriman Resmi</h3>

                                {/* Saved address picker */}
                                {currentUser && savedAddresses.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Pilih dari alamat tersimpan:</p>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            {savedAddresses.map(addr => {
                                                const active = selectedAddressId === addr.id;
                                                return (
                                                    <button
                                                        key={addr.id}
                                                        type="button"
                                                        onClick={() => applyAddress(addr)}
                                                        style={{
                                                            textAlign: 'left',
                                                            flex: '1 1 240px',
                                                            minWidth: '240px',
                                                            padding: '1rem 1.2rem',
                                                            borderRadius: '0.8rem',
                                                            border: `1px solid ${active ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                                            background: active ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.02)',
                                                            color: 'var(--text-main)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{addr.label}</span>
                                                            {addr.isDefault && <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>★ Utama</span>}
                                                        </div>
                                                        <p style={{ fontWeight: '600', fontSize: '0.9rem', margin: '0 0 0.2rem' }}>{addr.recipientName} · {addr.phone}</p>
                                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                                                            {addr.streetAddress}, Kel. {addr.village}, {addr.city}, {addr.province} {addr.postalCode}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleProceed} className="grid-form-2col">
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nama Penerima</label>
                                        <input type="text" name="name" className="search-input" style={{ width: '100%' }} value={formData.name} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Alamat Email</label>
                                        <input type="email" name="email" className="search-input" style={{ width: '100%' }} value={formData.email} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nomor Telepon</label>
                                        <input type="text" name="phone" className="search-input" style={{ width: '100%' }} value={formData.phone} onChange={handleInputChange} required />
                                    </div>

                                    {/* Cascading dropdown selectors */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Provinsi</label>
                                        <SearchableSelect
                                            options={provinces}
                                            value={provId}
                                            onChange={handleProvinceChange}
                                            placeholder="-- Pilih Provinsi --"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kabupaten / Kota</label>
                                        <SearchableSelect
                                            options={cities}
                                            value={cityId}
                                            onChange={handleCityChange}
                                            disabled={!provId}
                                            placeholder="-- Pilih Kabupaten/Kota --"
                                            onClickDisabled={() => triggerSelectAlert('city', 'Silakan pilih Provinsi terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'city' && (
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kecamatan</label>
                                        <SearchableSelect
                                            options={districts}
                                            value={districtId}
                                            onChange={handleDistrictChange}
                                            disabled={!cityId}
                                            placeholder="-- Pilih Kecamatan --"
                                            onClickDisabled={() => triggerSelectAlert('district', 'Silakan pilih Kabupaten / Kota terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'district' && (
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kelurahan / Desa</label>
                                        <SearchableSelect
                                            options={villages}
                                            value={villages.find(v => v.name.toLowerCase() === formData.village?.toLowerCase())?.id || ''}
                                            onChange={handleVillageChange}
                                            disabled={!districtId}
                                            placeholder="-- Pilih Kelurahan/Desa --"
                                            onClickDisabled={() => triggerSelectAlert('village', 'Silakan pilih Kecamatan terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'village' && (
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.4rem' }}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>

                                    {/* Text fields for specific details */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>RT / RW</label>
                                        <input type="text" name="rtRw" className="search-input" style={{ width: '100%' }} placeholder="Contoh: RT 02 / RW 04" value={formData.rtRw} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kode Pos</label>
                                        <input type="text" name="postalCode" className="search-input" style={{ width: '100%' }} value={formData.postalCode} onChange={handleInputChange} required />
                                    </div>

                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nama Jalan, No. Rumah, Blok</label>
                                        <textarea name="streetAddress" className="search-input" style={{ width: '100%', minHeight: '80px', resize: 'none' }} placeholder="Contoh: Jl. Sudirman No. 12, Komplek Duta Mas Blok A1" value={formData.streetAddress} onChange={handleInputChange} required></textarea>
                                    </div>

                                    {/* Save current form into the address book */}
                                    {currentUser && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <button
                                                type="button"
                                                onClick={handleSaveAddress}
                                                disabled={savingAddress}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    color: 'var(--text-main)',
                                                    padding: '0.8rem 1.5rem',
                                                    borderRadius: '0.6rem',
                                                    cursor: savingAddress ? 'default' : 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {savingAddress ? 'Menyimpan...' : '💾 Simpan alamat ini ke buku alamat'}
                                            </button>
                                        </div>
                                    )}

                                    <button type="submit" id="submit-shipment" style={{ display: 'none' }}></button>
                                </form>
                            </div>
                        </div>

                        <div className="checkout-summary-card">
                            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '2rem', color: 'var(--text-main)' }}>Total Akuisisi</h2>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <span>Subtotal</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                <span>Penanganan Aman</span>
                                <span style={{ color: 'var(--secondary)' }}>Gratis</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', fontSize: '1.8rem', fontWeight: '600', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem', color: 'var(--text-main)' }}>
                                <span>Total</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <button
                                onClick={() => document.getElementById('submit-shipment').click()}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1.2rem', cursor: 'pointer' }}
                            >
                                Lanjutkan Ke Pembayaran
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '1.5rem', lineHeight: '1.5' }}>
                                Dengan melanjutkan, Anda menyetujui syarat akuisisi dan penanganan spesimen elit kami.
                            </p>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
