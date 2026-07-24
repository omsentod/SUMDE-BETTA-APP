'use client';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import styles from './checkout.module.css';

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
                            <div className="cart-items mb-16">
                                <h3 className={styles.sectionTitle}>Spesimen Terpilih</h3>
                                {cart.map((item) => (
                                    <div key={`${item.id}-${item.selectedSize}`} className="checkout-item-row">
                                        <div className="checkout-item-image">
                                            <Image src={item.image} alt={item.name} fill className="object-cover" />
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
                                            <button onClick={() => updateQuantity(item.id, -1, item.selectedSize)} className="qty-btn cursor-pointer">-</button>
                                            <span className="text-[var(--text-main)]">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1, item.selectedSize)} className="qty-btn cursor-pointer">+</button>
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
                                <h3 className={styles.sectionTitle}>Detail Pengiriman Resmi</h3>

                                {/* Saved address picker */}
                                {currentUser && savedAddresses.length > 0 && (
                                    <div className={styles.savedAddressSection}>
                                        <p className={styles.savedAddressLabel}>Pilih dari alamat tersimpan:</p>
                                        <div className={styles.savedAddressGrid}>
                                            {savedAddresses.map(addr => {
                                                const active = selectedAddressId === addr.id;
                                                return (
                                                    <button
                                                        key={addr.id}
                                                        type="button"
                                                        onClick={() => applyAddress(addr)}
                                                        className={`${styles.addressCard} ${active ? styles.addressCardActive : ''}`}
                                                    >
                                                        <div className={styles.addressCardHeader}>
                                                            <span className={styles.addressTag}>{addr.label}</span>
                                                            {addr.isDefault && <span className={styles.addressDefaultBadge}>★ Utama</span>}
                                                        </div>
                                                        <p className={styles.addressRecipient}>{addr.recipientName} · {addr.phone}</p>
                                                        <p className={styles.addressDetailText}>
                                                            {addr.streetAddress}, Kel. {addr.village}, {addr.city}, {addr.province} {addr.postalCode}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleProceed} className="grid-form-2col">
                                    <div className={styles.fullCol}>
                                        <label className={styles.fieldLabel}>Nama Penerima</label>
                                        <input type="text" name="name" className={`search-input ${styles.inputFull}`} value={formData.name} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Alamat Email</label>
                                        <input type="email" name="email" className={`search-input ${styles.inputFull}`} value={formData.email} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Nomor Telepon</label>
                                        <input type="text" name="phone" className={`search-input ${styles.inputFull}`} value={formData.phone} onChange={handleInputChange} required />
                                    </div>

                                    {/* Cascading dropdown selectors */}
                                    <div>
                                        <label className={styles.fieldLabel}>Provinsi</label>
                                        <SearchableSelect
                                            options={provinces}
                                            value={provId}
                                            onChange={handleProvinceChange}
                                            placeholder="-- Pilih Provinsi --"
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Kabupaten / Kota</label>
                                        <SearchableSelect
                                            options={cities}
                                            value={cityId}
                                            onChange={handleCityChange}
                                            disabled={!provId}
                                            placeholder="-- Pilih Kabupaten/Kota --"
                                            onClickDisabled={() => triggerSelectAlert('city', 'Silakan pilih Provinsi terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'city' && (
                                            <span className={styles.selectAlertText}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Kecamatan</label>
                                        <SearchableSelect
                                            options={districts}
                                            value={districtId}
                                            onChange={handleDistrictChange}
                                            disabled={!cityId}
                                            placeholder="-- Pilih Kecamatan --"
                                            onClickDisabled={() => triggerSelectAlert('district', 'Silakan pilih Kabupaten / Kota terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'district' && (
                                            <span className={styles.selectAlertText}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Kelurahan / Desa</label>
                                        <SearchableSelect
                                            options={villages}
                                            value={villages.find(v => v.name.toLowerCase() === formData.village?.toLowerCase())?.id || ''}
                                            onChange={handleVillageChange}
                                            disabled={!districtId}
                                            placeholder="-- Pilih Kelurahan/Desa --"
                                            onClickDisabled={() => triggerSelectAlert('village', 'Silakan pilih Kecamatan terlebih dahulu.')}
                                        />
                                        {selectAlert.field === 'village' && (
                                            <span className={styles.selectAlertText}>
                                                ⚠️ {selectAlert.message}
                                            </span>
                                        )}
                                    </div>

                                    {/* Text fields for specific details */}
                                    <div>
                                        <label className={styles.fieldLabel}>RT / RW</label>
                                        <input type="text" name="rtRw" className={`search-input ${styles.inputFull}`} placeholder="Contoh: RT 02 / RW 04" value={formData.rtRw} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Kode Pos</label>
                                        <input type="text" name="postalCode" className={`search-input ${styles.inputFull}`} value={formData.postalCode} onChange={handleInputChange} required />
                                    </div>

                                    <div className={styles.fullCol}>
                                        <label className={styles.fieldLabel}>Nama Jalan, No. Rumah, Blok</label>
                                        <textarea name="streetAddress" className={`search-input ${styles.streetAddressInput}`} placeholder="Contoh: Jl. Sudirman No. 12, Komplek Duta Mas Blok A1" value={formData.streetAddress} onChange={handleInputChange} required></textarea>
                                    </div>

                                    {/* Save current form into the address book */}
                                    {currentUser && (
                                        <div className={styles.fullCol}>
                                            <button
                                                type="button"
                                                onClick={handleSaveAddress}
                                                disabled={savingAddress}
                                                className={`${styles.saveAddressBtn} ${savingAddress ? styles.saveAddressBtnDisabled : ''}`}
                                            >
                                                {savingAddress ? 'Menyimpan...' : '💾 Simpan alamat ini ke buku alamat'}
                                            </button>
                                        </div>
                                    )}

                                    <button type="submit" id="submit-shipment" className="hidden"></button>
                                </form>
                            </div>
                        </div>

                        <div className="checkout-summary-card">
                            <h2 className={styles.summaryTitle}>Total Akuisisi</h2>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <div className={styles.summaryRowLarge}>
                                <span>Penanganan Aman</span>
                                <span className="color-secondary">Gratis</span>
                            </div>
                            <div className={styles.summaryTotalRow}>
                                <span>Total</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <button
                                onClick={() => document.getElementById('submit-shipment').click()}
                                className={`btn btn-primary ${styles.proceedBtn}`}
                            >
                                Lanjutkan Ke Pembayaran
                            </button>
                            <p className={styles.disclaimerText}>
                                Dengan melanjutkan, Anda menyetujui syarat akuisisi dan penanganan spesimen elit kami.
                            </p>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}
