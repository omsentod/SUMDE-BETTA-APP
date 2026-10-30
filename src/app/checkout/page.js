'use client';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import CourierLogo from '@/components/CourierLogo';
import { useToast } from '@/context/ToastContext';
import styles from './checkout.module.css';

function CheckoutContent() {
    const { checkoutItems: cart, checkoutTotal: total, updateQuantity, removeFromCart, buyNow } = useCart();
    const { currentUser, fetchMyAddresses, createAddress } = useAuth();
    const { toast, confirmDialog } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();

    const buyNowParam = searchParams.get('buyNow');
    const dropNumberParam = searchParams.get('dropNumber');
    const telegramUserParam = searchParams.get('telegramUser');
    const eventIdParam = searchParams.get('eventId');

    const [dropBooking, setDropBooking] = useState(null);

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

    // Shipping / courier state — populated once the buyer's postal code is set
    const [rates, setRates] = useState([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesError, setRatesError] = useState('');
    // selectedRate = { courier_code, courier_service_code, price, courier_service_name, duration }
    const [selectedRate, setSelectedRate] = useState(null);

    const triggerSelectAlert = (field, message) => {
        setSelectAlert({ field, message });
        setTimeout(() => {
            setSelectAlert(prev => prev.field === field ? { field: '', message: '' } : prev);
        }, 3000);
    };

    // Auto-load buyNow drop product from query params and lock booking in Telegram
    useEffect(() => {
        if (!buyNowParam) return;
        let cancelled = false;

        let tgUser = telegramUserParam || '';
        if (!tgUser && typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
            tgUser = window.Telegram.WebApp.initDataUnsafe.user.username || window.Telegram.WebApp.initDataUnsafe.user.first_name || '';
        }

        fetch(`/api/products/${buyNowParam}`)
            .then(res => res.json())
            .then(async (prod) => {
                if (cancelled || !prod || prod.error) return;
                buyNow({
                    id: prod.id,
                    name: prod.name,
                    price: prod.price,
                    image: prod.image || (prod.images && prod.images[0]) || '/img/betta-1.png',
                    category: prod.category,
                    dropNumber: dropNumberParam || prod.dropNumber,
                });

                if (prod.isDailyDrop || dropNumberParam) {
                    try {
                        const tgId = typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.id
                            ? String(window.Telegram.WebApp.initDataUnsafe.user.id)
                            : null;

                        const bookRes = await fetch('/api/telegram/book', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                productId: prod.id,
                                telegramUser: tgUser || 'Pembeli',
                                telegramId: tgId,
                            }),
                        });
                        const bookData = await bookRes.json();
                        if (bookRes.ok && !cancelled) {
                            setDropBooking({
                                dropNumber: dropNumberParam || prod.dropNumber || '#DROP',
                                telegramUser: tgUser || 'Pembeli',
                                bookedUntil: bookData.product?.bookedUntil,
                            });
                        }
                    } catch (bookErr) {
                        console.warn('Gagal book drop Telegram:', bookErr.message);
                    }
                }
            })
            .catch(err => console.error('Gagal mengambil data buyNow:', err));

        return () => { cancelled = true; };
    }, [buyNowParam, dropNumberParam, telegramUserParam, buyNow]);

    const handleCancelDropBooking = async () => {
        if (!buyNowParam) return;
        const confirmed = await confirmDialog({
            title: 'Batalkan Flash Deal?',
            message: 'Apakah Anda yakin ingin membatalkan transaksi ini? Ikan akan kembali dibuka untuk anggota lain di grup Telegram.',
            confirmText: 'Ya, Batalkan',
            cancelText: 'Lanjutkan Transaksi',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await fetch('/api/telegram/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: buyNowParam }),
            });
            toast.info('Booking telah dibatalkan.');
            router.push('/produk');
        } catch {
            router.push('/produk');
        }
    };

    const handleDeleteCheckoutItem = async (item) => {
        const confirmed = await confirmDialog({
            title: 'Hapus Ikan dari Pesanan?',
            message: `Hapus "${item.name}"${item.selectedSize ? ` (Varian: ${item.selectedSize})` : ''} dari pesanan Anda?`,
            confirmText: 'Ya, Hapus',
            cancelText: 'Batal',
            isDanger: true,
        });
        if (!confirmed) return;
        removeFromCart(item.id, item.selectedSize);
        toast.info(`"${item.name}" dihapus dari pesanan.`);
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
        if (name === 'postalCode') {
            const numeric = value.replace(/\D/g, '').slice(0, 5);
            setFormData(prev => ({ ...prev, postalCode: numeric }));
            return;
        }
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
            village: '',
            postalCode: ''
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
            village: '',
            postalCode: ''
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
            village: '',
            postalCode: ''
        }));
    };

    const handleVillageChange = (id, name) => {
        setFormData(prev => ({
            ...prev,
            village: id ? name : ''
        }));
    };

    // Stable fingerprint of cart contents. The cart array reference from context
    // is re-created on every parent render — if we put `cart` directly into the
    // effect deps below, the effect fires every render, launches infinite
    // fetches, and eventually OOMs the Node process.
    const cartFingerprint = useMemo(
        () => cart.map((i) => `${i.id}:${i.quantity}`).join('|'),
        [cart]
    );

    // Manual + auto trigger for rate lookup. Extracted so a "Cek Ongkir" button
    // can call the same code path.
    const fetchShippingRates = useCallback(async () => {
        const postal = formData.postalCode;
        if (!/^\d{5}$/.test(postal)) {
            setRatesError('Isi kode pos 5 digit dulu.');
            return;
        }
        if (cart.length === 0) return;
        setRatesLoading(true);
        setRatesError('');
        try {
            const res = await fetch('/api/shipping/rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destinationPostal: postal,
                    destinationCity: formData.city,
                    destinationProvince: formData.province,
                    items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal mengambil ongkir.');
            const newRates = data.rates || [];
            setRates(newRates);
            setSelectedRate((prev) => {
                if (newRates.length === 0) return null;
                if (prev) {
                    const match = newRates.find(
                        (r) => r.courier_code === prev.courier_code && r.courier_service_code === prev.courier_service_code
                    );
                    if (match) return match;
                }
                // Otomatis pilih kurir pertama yang tersedia agar user tidak perlu klik manual
                return newRates[0];
            });
        } catch (err) {
            setRatesError(err.message);
            setRates([]);
            setSelectedRate(null);
        } finally {
            setRatesLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.postalCode, formData.city, formData.province, cartFingerprint]);

    // Auto-fetch when postal code, province, or cart contents actually change.
    useEffect(() => {
        const postal = formData.postalCode;
        if (!/^\d{5}$/.test(postal) || cart.length === 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset shipping rates when postal code is invalid or cart empty
            setRates([]);
            setSelectedRate(null);
            setRatesError('');
            return;
        }
        fetchShippingRates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.postalCode, formData.province, cartFingerprint]);

    // Save the currently-entered form as a new entry in the address book
    const handleSaveAddress = async () => {
        const { name, phone, streetAddress, rtRw, province, city, district, village, postalCode } = formData;
        if (!name || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
            toast.warning('Lengkapi seluruh detail alamat terlebih dahulu.');
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
            toast.success('Alamat berhasil disimpan ke buku alamat.');
        } catch (err) {
            toast.error(err.message || 'Gagal menyimpan alamat.');
        } finally {
            setSavingAddress(false);
        }
    };

    const handleProceed = (e) => {
        e.preventDefault();
        const { name, phone, streetAddress, rtRw, province, city, district, village, postalCode } = formData;
        if (!name || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode) {
            toast.warning('Mohon lengkapi seluruh detail pengiriman.');
            return;
        }
        if (ratesLoading) {
            toast.info('Sedang menghitung ongkos kirim, silakan tunggu...');
            return;
        }
        if (ratesError) {
            toast.error(ratesError);
            return;
        }
        if (!selectedRate) {
            if (rates.length === 0) {
                toast.warning('Layanan pengiriman belum tersedia untuk lokasi ini.');
                return;
            }
            toast.warning('Pilih kurir pengiriman terlebih dahulu.');
            return;
        }
        const shipping = {
            courier: selectedRate.courier_code,
            service: selectedRate.courier_service_code,
            serviceName: selectedRate.courier_service_name,
            fee: Number(selectedRate.price) || 0,
            eta: selectedRate.duration || null,
            isOuterJava: Boolean(selectedRate.is_outer_java),
            surcharge: Number(selectedRate.surcharge) || 0,
        };
        const tgUser = dropBooking?.telegramUser || telegramUserParam || (typeof window !== 'undefined' && (window.Telegram?.WebApp?.initDataUnsafe?.user?.username || window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name)) || '';

        localStorage.removeItem('active-payment');
        localStorage.setItem('temp-shipment', JSON.stringify({
            ...formData,
            telegramUsername: tgUser ? `@${tgUser.replace(/^@/, '')}` : null,
            shipping,
            createdAt: Date.now()
        }));
        router.push('/payment');
    };

    if (cart.length === 0) {
        return (
            <div className={`container ${styles.emptyStateContainer}`}>
                <svg className={styles.emptyStateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <h2 className={styles.emptyStateTitle}>Inventaris Anda Kosong</h2>
                <p className={styles.emptyStateSubtitle}>
                    Belum ada ikan pilihan yang ditambahkan ke pesanan. Silakan jelajahi galeri koleksi akuatik kami.
                </p>
                <Link href="/produk" className={`btn btn-primary ${styles.emptyStateBtn}`}>
                    Jelajahi Galeri
                </Link>
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <section className="checkout-section">
                <div className="container">
                    <h1 className="checkout-title">Ringkasan Pembelian</h1>

                    {dropBooking && (
                        <div className={styles.telegramDropBanner}>
                            <div className={styles.dropBannerLeft}>
                                <span className={styles.dropBadge}>{dropBooking.dropNumber}</span>
                                <div>
                                    <div className={styles.dropBannerTitle}>Flash Deal Sedang Diamankan</div>
                                    <div className={styles.dropBannerSub}>
                                        Ikan ini terkunci untuk akun Telegram @{dropBooking.telegramUser.replace(/^@/, '')} (Batas Waktu: 15 Menit).
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelDropBooking}
                                className={styles.dropCancelBtn}
                            >
                                Batalkan Booking
                            </button>
                        </div>
                    )}

                    <div className="grid-checkout-outer">

                        <div className="checkout-left">
                            <div className="cart-items mb-16">
                                <h3 className={styles.sectionTitle}>Koleksi Terpilih</h3>
                                {cart.map((item) => (
                                    <div key={`${item.id}-${item.selectedSize}`} className="checkout-item-row">
                                        <div className="checkout-item-image">
                                            <Image src={item.image || '/img/betta-1.png'} alt={item.name} fill className="object-cover" />
                                        </div>
                                        <div className="checkout-item-info">
                                            <h3>{item.name}</h3>
                                            <p className="checkout-item-sub">Kategori {item.category}</p>
                                            {item.selectedSize && (
                                                <p className="checkout-item-size">
                                                    Varian: {item.selectedSize}
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
                                            <button onClick={() => handleDeleteCheckoutItem(item)} className="checkout-item-delete">
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
                                                            {addr.isDefault && (
                                                                <span className={styles.addressDefaultBadge}>
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                                    </svg>
                                                                    Utama
                                                                </span>
                                                            )}
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
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                                {selectAlert.message}
                                            </span>
                                        )}
                                    </div>

                                    {/* Text fields for specific details */}
                                    <div>
                                        <label className={styles.fieldLabel}>RT / RW</label>
                                        <input type="text" name="rtRw" className={`search-input ${styles.inputFull}`} placeholder="Contoh: RT 02 / RW 04" value={formData.rtRw} onChange={handleInputChange} required />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel}>Kode Pos (5 Digit)</label>
                                        <input
                                            type="text"
                                            name="postalCode"
                                            inputMode="numeric"
                                            maxLength={5}
                                            placeholder="Contoh: 12190"
                                            className={`search-input ${styles.inputFull} ${ratesError && ratesError.toLowerCase().includes('kode pos') ? styles.inputError : ''}`}
                                            value={formData.postalCode}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        {ratesError && ratesError.toLowerCase().includes('kode pos') && (
                                            <span className={styles.postalErrorText}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="12" />
                                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                                </svg>
                                                {ratesError}
                                            </span>
                                        )}
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
                                                {savingAddress ? 'Menyimpan...' : (
                                                    <>
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                            <polyline points="17 21 17 13 7 13 7 21" />
                                                            <polyline points="7 3 7 8 15 8" />
                                                        </svg>
                                                        Simpan alamat ini ke buku alamat
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    <button type="submit" id="submit-shipment" className="hidden"></button>
                                </form>
                            </div>

                            {/* Shipping / courier picker */}
                            <div className="checkout-shipping-container">
                                <div className="checkout-shipping-header">
                                    <h3 className={styles.sectionTitle}>Kurir Pengiriman</h3>
                                    <button
                                        type="button"
                                        onClick={fetchShippingRates}
                                        disabled={ratesLoading || !/^\d{5}$/.test(formData.postalCode) || cart.length === 0}
                                        className="checkout-shipping-refresh"
                                        title="Cek ulang ongkir dengan alamat sekarang"
                                    >
                                        {ratesLoading ? 'Memuat...' : 'Cek Ongkir'}
                                    </button>
                                </div>
                                {!/^\d{5}$/.test(formData.postalCode) ? (
                                    <p className="checkout-shipping-hint">
                                        Isi kode pos untuk melihat opsi ongkir, atau klik &quot;Cek Ongkir&quot; setelah ganti alamat.
                                    </p>
                                ) : ratesLoading ? (
                                    <p className="checkout-shipping-hint">Mengambil ongkir...</p>
                                ) : ratesError ? (
                                    <p className="checkout-shipping-error">{ratesError}</p>
                                ) : rates.length === 0 ? (
                                    <p className="checkout-shipping-hint">
                                        Tidak ada layanan kurir tersedia ke lokasi ini.
                                    </p>
                                ) : (
                                    <>
                                        {rates[0]?.is_outer_java && (
                                            <div className={styles.outerJavaNotice}>
                                                <svg className={styles.outerJavaIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                </svg>
                                                <div className={styles.outerJavaText}>
                                                    <span className={styles.outerJavaTitle}>Tujuan Luar Pulau Jawa</span>
                                                    <span className={styles.outerJavaSub}>
                                                        Tarif ongkir otomatis mencakup biaya karantina BKIPM &amp; packing khusus luar pulau (+{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(rates[0]?.surcharge || 10000)}).
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="checkout-shipping-list">
                                            {rates.map((r) => {
                                                const active =
                                                    selectedRate?.courier_code === r.courier_code &&
                                                    selectedRate?.courier_service_code === r.courier_service_code;
                                                return (
                                                    <button
                                                        key={`${r.courier_code}-${r.courier_service_code}`}
                                                        type="button"
                                                        onClick={() => setSelectedRate(r)}
                                                        className={`checkout-shipping-option ${active ? 'active' : ''}`}
                                                    >
                                                        <div className="checkout-shipping-option-main">
                                                            <CourierLogo code={r.courier_code} />
                                                            <div className="checkout-shipping-option-text">
                                                                <span className="checkout-shipping-courier">
                                                                    {(r.courier_name || r.courier_code).toUpperCase()}
                                                                </span>
                                                                <span className="checkout-shipping-service">
                                                                    {r.courier_service_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="checkout-shipping-option-side">
                                                            <span className="checkout-shipping-price">
                                                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(r.price)}
                                                            </span>
                                                            {r.duration && (
                                                                <span className="checkout-shipping-eta">
                                                                    {r.duration.replace(/\bdays?\b/gi, 'hari').replace(/\bhours?\b/gi, 'jam')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="checkout-summary-card">
                            <h2 className={styles.summaryTitle}>Total Akuisisi</h2>
                            <div className={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>{formattedTotal}</span>
                            </div>
                            <div className={styles.summaryRowLarge}>
                                <span>Ongkir {selectedRate ? `(${(selectedRate.courier_code || '').toUpperCase()} ${selectedRate.courier_service_code})` : ''}</span>
                                <span>
                                    {selectedRate
                                        ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(selectedRate.price)
                                        : !/^\d{5}$/.test(formData.postalCode)
                                            ? <span className="color-secondary">Masukkan kode pos</span>
                                            : ratesLoading
                                                ? <span className="color-secondary">Menghitung...</span>
                                                : <span className="color-secondary">—</span>}
                                </span>
                            </div>
                            {selectedRate?.is_outer_java && (
                                <div className={styles.summarySurchargeNote}>
                                    Termasuk karantina &amp; packing luar Jawa (+{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(selectedRate.surcharge || 10000)})
                                </div>
                            )}
                            <div className={styles.summaryTotalRow}>
                                <span>Total</span>
                                <span>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(total + (Number(selectedRate?.price) || 0))}
                                </span>
                            </div>
                            <button
                                onClick={() => document.getElementById('submit-shipment').click()}
                                className={`btn btn-primary ${styles.proceedBtn}`}
                            >
                                Lanjutkan Ke Pembayaran
                            </button>
                            <p className={styles.disclaimerText}>
                                Dengan melanjutkan, Anda menyetujui syarat pembelian dan penanganan pengiriman ikan kami.
                            </p>
                        </div>

                    </div>
                </div>
            </section>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className={`container ${styles.emptyStateContainer}`}>
                <p className={styles.emptyStateSubtitle}>Memuat Halaman Checkout...</p>
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
