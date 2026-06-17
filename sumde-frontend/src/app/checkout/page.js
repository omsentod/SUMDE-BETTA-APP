'use client';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function CheckoutPage() {
    const { checkoutItems: cart, checkoutTotal: total, updateQuantity, removeFromCart } = useCart();
    const { currentUser } = useAuth();
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

    const [selectAlert, setSelectAlert] = useState({ field: '', message: '' });

    const triggerSelectAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => {
            setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev);
        }, 3000);
    };

    // Load currentUser profile address details if exists
    useEffect(() => {
        if (currentUser) {
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
        }
    }, [currentUser]);

    // 1. Fetch Provinces on mount
    useEffect(() => {
        fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
            .then(res => res.json())
            .then(data => {
                setProvinces(data);
                // Try autofill mapping for province
                if (currentUser?.province) {
                    const match = data.find(p => p.name.toLowerCase() === currentUser.province.toLowerCase());
                    if (match) setProvId(match.id);
                }
            })
            .catch(err => console.error('Gagal memuat provinsi:', err));
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
                // Try autofill mapping for city
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
                // Try autofill mapping for district
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
            .then(data => {
                setVillages(data);
            })
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

    // Dropdown Handlers
    const handleProvinceChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
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

    const handleCityChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
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

    const handleDistrictChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setDistrictId(id);
        setFormData(prev => ({
            ...prev,
            district: id ? name : '',
            village: ''
        }));
    };

    const handleVillageChange = (e) => {
        const id = e.target.value;
        const name = e.target.options[e.target.selectedIndex].text;
        setFormData(prev => ({
            ...prev,
            village: id ? name : ''
        }));
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
            <section style={{ padding: '8rem 0' }}>
                <div className="container">
                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3.5rem', marginBottom: '4rem', color: 'var(--text-main)' }}>Ringkasan Akuisisi</h1>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '4rem' }}>

                        <div className="checkout-left">
                            <div className="cart-items" style={{ marginBottom: '4rem' }}>
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Spesimen Terpilih</h3>
                                {cart.map((item) => (
                                    <div key={item.id} style={{ display: 'flex', gap: '2rem', padding: '2rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                            <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.3rem', color: 'var(--text-main)' }}>{item.name}</h3>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Spesimen {item.category}</p>
                                        </div>
                                        <div className="qty-control">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn" style={{ cursor: 'pointer' }}>-</button>
                                            <span style={{ color: 'var(--text-main)' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn" style={{ cursor: 'pointer' }}>+</button>
                                        </div>
                                        <div style={{ textAlign: 'right', minWidth: '150px' }}>
                                            <p style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.price * item.quantity)}
                                            </p>
                                            <button onClick={() => removeFromCart(item.id)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                                                HAPUS
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="shipment-form" style={{ background: 'rgba(255,255,255,0.02)', padding: '3rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h3 style={{ marginBottom: '2rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.2rem', color: 'var(--primary)' }}>Detail Pengiriman Resmi</h3>
                                <form onSubmit={handleProceed} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
                                        <select className="sortSelect" style={{ width: '100%' }} value={provId} onChange={handleProvinceChange} required>
                                            <option value="" className="sortOption">-- Pilih Provinsi --</option>
                                            {provinces.map(p => <option key={p.id} value={p.id} className="sortOption">{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kabupaten / Kota</label>
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
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kecamatan</label>
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
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Kelurahan / Desa</label>
                                        <div style={{ position: 'relative' }}>
                                            <select className="sortSelect" style={{ width: '100%' }} value={formData.village ? villages.find(v => v.name.toLowerCase() === formData.village.toLowerCase())?.id || '' : ''} onChange={handleVillageChange} disabled={!districtId} required>
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

                                    <button type="submit" id="submit-shipment" style={{ display: 'none' }}></button>
                                </form>
                            </div>
                        </div>

                        <div className="summary-card" style={{ padding: '3rem', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '1rem', height: 'fit-content', position: 'sticky', top: '120px' }}>
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
