'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import SearchableSelect from '@/components/SearchableSelect';
import CourierLogo from '@/components/CourierLogo';
import PaymentMethodPicker from '@/components/PaymentMethodPicker';
import { calcPaymentFee, isValidPaymentMethod } from '@/lib/paymentFee';
import styles from './live.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

export default function LiveCheckoutForm({ basket, onCancel, onPaymentCreated }) {
  const { currentUser, fetchMyAddresses, createAddress } = useAuth();
  const { toast } = useToast();

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(false);

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
    postalCode: '',
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [provId, setProvId] = useState('');
  const [cityId, setCityId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [autofillTarget, setAutofillTarget] = useState(null);

  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState('');
  const [selectedRate, setSelectedRate] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const applySavedAddress = useCallback(
    (addr) => {
      if (!addr) return;
      setSelectedAddressId(addr.id);
      setSaveAddressToAccount(false);
      setRates([]);
      setSelectedRate(null);
      setRatesError('');
      setFormError('');
      setFormData({
        name: addr.recipientName || currentUser?.name || '',
        email: currentUser?.email || '',
        phone: addr.phone || currentUser?.phone || '',
        streetAddress: addr.streetAddress || '',
        rtRw: addr.rtRw || '',
        province: addr.province || '',
        city: addr.city || '',
        district: addr.district || '',
        village: addr.village || '',
        postalCode: addr.postalCode || '',
      });
      setAutofillTarget({
        province: addr.province || '',
        city: addr.city || '',
        district: addr.district || '',
      });
    },
    [currentUser?.name, currentUser?.email, currentUser?.phone]
  );

  const handleUseNewAddress = () => {
    setSelectedAddressId(null);
    setAutofillTarget(null);
    setProvId('');
    setCityId('');
    setDistrictId('');
    setCities([]);
    setDistricts([]);
    setVillages([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError('');
    setFormData({
      name: currentUser?.name || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
      streetAddress: '',
      rtRw: '',
      province: '',
      city: '',
      district: '',
      village: '',
      postalCode: '',
    });
  };

  // Muat alamat tersimpan jika pembeli sudah login & auto-fill alamat utama
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    fetchMyAddresses().then((list) => {
      if (cancelled) return;
      const validList = Array.isArray(list) ? list : [];
      setSavedAddresses(validList);
      const def = validList.find((a) => a.isDefault) || validList[0];
      if (def) {
        applySavedAddress(def);
      } else {
        setSaveAddressToAccount(true);
        setFormData((prev) => ({
          ...prev,
          name: currentUser.name || prev.name,
          email: currentUser.email || prev.email,
          phone: currentUser.phone || prev.phone,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, fetchMyAddresses, applySavedAddress]);

  // Fetch daftar provinsi sekali saat mount
  useEffect(() => {
    let cancelled = false;
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled) setProvinces(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve provinsi ID dari alamat tersimpan
  useEffect(() => {
    if (!autofillTarget?.province || provinces.length === 0) return;
    const match = provinces.find(
      (p) => p.name.toLowerCase() === autofillTarget.province.toLowerCase()
    );
    if (!match) return;
    const timer = setTimeout(() => {
      setProvId((prev) => (prev === match.id ? prev : match.id));
    }, 0);
    return () => clearTimeout(timer);
  }, [autofillTarget?.province, provinces]);

  // Fetch kota saat provinsi berubah
  useEffect(() => {
    if (!provId) return;
    let cancelled = false;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provId}.json`)
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled) setCities(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provId]);

  // Resolve kota ID dari alamat tersimpan
  useEffect(() => {
    if (!autofillTarget?.city || cities.length === 0) return;
    const match = cities.find(
      (c) => c.name.toLowerCase() === autofillTarget.city.toLowerCase()
    );
    if (!match) return;
    const timer = setTimeout(() => {
      setCityId((prev) => (prev === match.id ? prev : match.id));
    }, 0);
    return () => clearTimeout(timer);
  }, [autofillTarget?.city, cities]);

  // Fetch kecamatan saat kota berubah
  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${cityId}.json`)
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled) setDistricts(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  // Resolve kecamatan ID dari alamat tersimpan
  useEffect(() => {
    if (!autofillTarget?.district || districts.length === 0) return;
    const match = districts.find(
      (d) => d.name.toLowerCase() === autofillTarget.district.toLowerCase()
    );
    if (!match) return;
    const timer = setTimeout(() => {
      setDistrictId((prev) => (prev === match.id ? prev : match.id));
    }, 0);
    return () => clearTimeout(timer);
  }, [autofillTarget?.district, districts]);

  // Fetch kelurahan saat kecamatan berubah
  useEffect(() => {
    if (!districtId) return;
    let cancelled = false;
    fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`)
      .then((res) => res.json())
      .then((list) => {
        if (!cancelled) setVillages(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const basketFingerprint = useMemo(
    () => (basket?.items || []).map((i) => `${i.id}:${i.quantity}`).join('|'),
    [basket?.items]
  );

  const fetchShippingRates = useCallback(async () => {
    const postal = formData.postalCode;
    if (!/^\d{5}$/.test(postal)) {
      setRatesError('Masukkan 5 digit kode pos tujuan terlebih dahulu.');
      return;
    }
    if (!basket?.items?.length) return;

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
          items: basket.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat tarif kurir.');
      const list = data.rates || [];
      setRates(list);
      setSelectedRate((prev) => {
        if (list.length === 0) return null;
        if (prev) {
          const same = list.find(
            (r) => r.courier_code === prev.courier_code && r.courier_service_code === prev.courier_service_code
          );
          if (same) return same;
        }
        return list[0];
      });
    } catch (err) {
      setRatesError(err.message);
      setRates([]);
      setSelectedRate(null);
    } finally {
      setRatesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.postalCode, formData.city, formData.province, basketFingerprint]);

  useEffect(() => {
    if (!/^\d{5}$/.test(formData.postalCode)) return;
    const timer = setTimeout(() => {
      fetchShippingRates();
    }, 150);
    return () => clearTimeout(timer);
  }, [formData.postalCode, formData.province, fetchShippingRates]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name !== 'email') setSelectedAddressId(null);
    if (name === 'postalCode') {
      const numeric = value.replace(/\D/g, '').slice(0, 5);
      setFormData((prev) => ({ ...prev, postalCode: numeric }));
      if (numeric.length < 5) {
        setRates([]);
        setSelectedRate(null);
        setRatesError('');
      }
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProvinceChange = (id, name) => {
    setSelectedAddressId(null);
    setAutofillTarget(null);
    setProvId(id);
    setCities([]);
    setCityId('');
    setDistrictId('');
    setDistricts([]);
    setVillages([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError('');
    setFormData((prev) => ({
      ...prev,
      province: id ? name : '',
      city: '',
      district: '',
      village: '',
      postalCode: '',
    }));
  };

  const handleCityChange = (id, name) => {
    setSelectedAddressId(null);
    setAutofillTarget(null);
    setCityId(id);
    setDistrictId('');
    setDistricts([]);
    setVillages([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError('');
    setFormData((prev) => ({
      ...prev,
      city: id ? name : '',
      district: '',
      village: '',
      postalCode: '',
    }));
  };

  const handleDistrictChange = (id, name) => {
    setSelectedAddressId(null);
    setAutofillTarget(null);
    setDistrictId(id);
    setVillages([]);
    setRates([]);
    setSelectedRate(null);
    setRatesError('');
    setFormData((prev) => ({
      ...prev,
      district: id ? name : '',
      village: '',
      postalCode: '',
    }));
  };

  const handleVillageChange = (id, name) => {
    setSelectedAddressId(null);
    setFormData((prev) => ({
      ...prev,
      village: id ? name : '',
    }));
  };

  const subtotal = Number(basket?.subtotal) || 0;
  const shippingFee = Number(selectedRate?.price) || 0;
  const paymentFee = isValidPaymentMethod(paymentMethod)
    ? calcPaymentFee(paymentMethod, subtotal + shippingFee)
    : 0;
  const grandTotal = subtotal + shippingFee + paymentFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode } = formData;
    if (!name.trim() || !email.trim() || !phone.trim() || !streetAddress.trim() || !rtRw.trim()) {
      setFormError('Lengkapi nama penerima, email, WhatsApp, dan alamat jalan terlebih dahulu.');
      return;
    }
    if (!province || !city || !district || !village || !/^\d{5}$/.test(postalCode)) {
      setFormError('Lengkapi provinsi, kota, kecamatan, kelurahan, dan 5 digit kode pos.');
      return;
    }
    if (!selectedRate) {
      setFormError('Pilih kurir pengiriman terlebih dahulu.');
      return;
    }
    if (!isValidPaymentMethod(paymentMethod)) {
      setFormError('Pilih metode pembayaran terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    try {
      const orderRes = await fetch('/api/live/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basketId: basket.id,
          claimToken: basket.claimToken,
          tiktokUsername: basket.tiktokUsername,
          ...formData,
          shipping: {
            courier: selectedRate.courier_code,
            service: selectedRate.courier_service_code,
          },
          paymentMethod,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Gagal membuat pesanan.');

      if (currentUser && !selectedAddressId && saveAddressToAccount && createAddress) {
        try {
          await createAddress({
            label: savedAddresses.length === 0 ? 'Alamat Utama' : `Alamat ${savedAddresses.length + 1}`,
            recipientName: name.trim(),
            phone: phone.trim(),
            streetAddress: streetAddress.trim(),
            rtRw: rtRw.trim(),
            province,
            city,
            district,
            village,
            postalCode,
            isDefault: savedAddresses.length === 0,
          });
        } catch {
          // Best-effort save address without blocking DOKU payment flow
        }
      }

      const callbackBase = basket.claimToken
        ? `${window.location.origin}/live/${encodeURIComponent(basket.claimToken)}`
        : `${window.location.origin}/live`;
      const callbackUrl = `${callbackBase}?orderId=${encodeURIComponent(orderData.id)}`;
      const dokuRes = await fetch('/api/payment/doku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.id, callbackUrl }),
      });
      const dokuData = await dokuRes.json();
      if (!dokuRes.ok) throw new Error(dokuData.error || 'Gagal membuka halaman pembayaran DOKU.');

      onPaymentCreated({
        orderId: orderData.id,
        paymentUrl: dokuData.paymentUrl,
        total: orderData.total,
        email: email.trim(),
      });
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.card}>
      <div className={styles.basketHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Data Penerima & Pengiriman</h2>
          <p className={styles.helperText}>
            Pengiriman seluruh ikan dari Markas Sumde Betta, Tulungagung.
          </p>
        </div>
        <button type="button" className={styles.outlineBtn} onClick={onCancel}>
          Kembali
        </button>
      </div>

      {!currentUser && (
        <div className={styles.accountBanner}>
          <span>Sudah punya akun dengan alamat tersimpan?</span>
          <Link
            href={
              basket?.claimToken
                ? `/login?next=${encodeURIComponent(`/live/${basket.claimToken}`)}`
                : '/login?next=/live'
            }
            className={styles.textActionBtn}
          >
            Login untuk pakai alamat tersimpan
          </Link>
        </div>
      )}

      {currentUser && savedAddresses.length > 0 && (
        <div className={styles.savedAddressSection}>
          <div className={styles.savedAddressHeader}>
            <p className={styles.savedAddressLabel}>Pilih dari Alamat Tersimpan:</p>
            <div className={styles.savedAddressLinks}>
              {selectedAddressId && (
                <button
                  type="button"
                  className={styles.textActionBtn}
                  onClick={handleUseNewAddress}
                >
                  + Tulis Alamat Lain
                </button>
              )}
              <Link href="/customer/addresses" className={styles.textActionBtn}>
                Kelola Alamat
              </Link>
            </div>
          </div>

          <div className={styles.savedAddressGrid}>
            {savedAddresses.map((addr) => {
              const active = selectedAddressId === addr.id;
              return (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => applySavedAddress(addr)}
                  className={`${styles.addressCard} ${active ? styles.addressCardActive : ''}`.trim()}
                >
                  <div className={styles.addressCardHeader}>
                    <span className={styles.addressTag}>{addr.label || 'Alamat'}</span>
                    {addr.isDefault && (
                      <span className={styles.addressDefaultBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Utama
                      </span>
                    )}
                  </div>
                  <p className={styles.addressRecipient}>
                    {addr.recipientName} · {addr.phone}
                  </p>
                  <p className={styles.addressDetailText}>
                    {addr.streetAddress}, {addr.rtRw ? `RT/RW ${addr.rtRw}, ` : ''}Kel. {addr.village}, Kec. {addr.district}, {addr.city}, {addr.province} {addr.postalCode}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-name">Nama Penerima</label>
          <input
            id="live-name"
            name="name"
            type="text"
            className={styles.input}
            placeholder="Nama lengkap penerima"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-phone">No. WhatsApp</label>
          <input
            id="live-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className={styles.input}
            placeholder="0812xxxxxxxx"
            value={formData.phone}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={`${styles.field} ${styles.fullSpan}`}>
          <label className={styles.label} htmlFor="live-email">Email (Untuk Bukti Bayar & Lacak Resi)</label>
          <input
            id="live-email"
            name="email"
            type="email"
            autoComplete="email"
            className={styles.input}
            placeholder="email@contoh.com"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={`${styles.field} ${styles.fullSpan}`}>
          <label className={styles.label} htmlFor="live-street">Alamat Lengkap</label>
          <input
            id="live-street"
            name="streetAddress"
            type="text"
            className={styles.input}
            placeholder="Nama jalan, nomor rumah, blok, patokan"
            value={formData.streetAddress}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-rtrw">RT / RW</label>
          <input
            id="live-rtrw"
            name="rtRw"
            type="text"
            className={styles.input}
            placeholder="Mis. 002/005"
            value={formData.rtRw}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Provinsi</span>
          <SearchableSelect
            options={provinces}
            value={provId}
            onChange={handleProvinceChange}
            placeholder="-- Pilih Provinsi --"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Kota / Kabupaten</span>
          <SearchableSelect
            options={cities}
            value={cityId}
            onChange={handleCityChange}
            disabled={!provId}
            placeholder="-- Pilih Kota/Kabupaten --"
            onClickDisabled={() => setFormError('Pilih provinsi terlebih dahulu.')}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Kecamatan</span>
          <SearchableSelect
            options={districts}
            value={districtId}
            onChange={handleDistrictChange}
            disabled={!cityId}
            placeholder="-- Pilih Kecamatan --"
            onClickDisabled={() => setFormError('Pilih kota/kabupaten terlebih dahulu.')}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Kelurahan / Desa</span>
          <SearchableSelect
            options={villages}
            value={villages.find((v) => v.name === formData.village)?.id || ''}
            onChange={handleVillageChange}
            disabled={!districtId}
            placeholder="-- Pilih Kelurahan/Desa --"
            onClickDisabled={() => setFormError('Pilih kecamatan terlebih dahulu.')}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="live-postal">Kode Pos (5 Digit)</label>
          <input
            id="live-postal"
            name="postalCode"
            type="text"
            inputMode="numeric"
            maxLength={5}
            className={styles.input}
            placeholder="Mis. 66218"
            value={formData.postalCode}
            onChange={handleInputChange}
            required
          />
        </div>
      </div>

      <div className={styles.ratesHeader}>
        <h3 className={styles.sectionTitle}>Kurir Pengiriman</h3>
        <button
          type="button"
          className={styles.outlineBtn}
          onClick={fetchShippingRates}
          disabled={ratesLoading || !/^\d{5}$/.test(formData.postalCode)}
        >
          {ratesLoading ? 'Mengecek...' : 'Cek Ongkir'}
        </button>
      </div>

      {ratesError && <p className={styles.inlineError}>{ratesError}</p>}

      {!/^\d{5}$/.test(formData.postalCode) ? (
        <p className={styles.helperText}>Isi 5 digit kode pos di atas untuk menampilkan pilihan ongkos kirim.</p>
      ) : ratesLoading ? (
        <p className={styles.helperText}>Menghitung tarif pengiriman terbaik...</p>
      ) : rates.length === 0 ? (
        <p className={styles.helperText}>Belum ada kurir tersedia untuk kode pos ini.</p>
      ) : (
        <div className={styles.ratesList}>
          {rates.map((rate) => {
            const key = `${rate.courier_code}:${rate.courier_service_code}`;
            const isSelected =
              selectedRate?.courier_code === rate.courier_code &&
              selectedRate?.courier_service_code === rate.courier_service_code;
            return (
              <button
                key={key}
                type="button"
                className={`${styles.rateOption} ${isSelected ? styles.rateOptionSelected : ''}`.trim()}
                onClick={() => setSelectedRate(rate)}
              >
                <CourierLogo code={rate.courier_code} size="sm" />
                <div className={styles.rateMeta}>
                  <div className={styles.rateTitle}>
                    {rate.courier_name} — {rate.courier_service_name}
                  </div>
                  <div className={styles.rateDuration}>
                    {rate.duration || 'Estimasi standar'}
                    {rate.is_outer_java ? ' · Termasuk biaya karantina luar Jawa' : ''}
                  </div>
                </div>
                <div className={styles.ratePrice}>{formatIDR(rate.price)}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.paymentSection}>
        <h3 className={styles.sectionTitle}>Metode Pembayaran</h3>
        <PaymentMethodPicker
          value={paymentMethod}
          onChange={setPaymentMethod}
        />
      </div>

      <div className={styles.summaryBox}>
        <div className={styles.summaryRow}>
          <span>Subtotal ({basket.totalQty} item)</span>
          <span>{formatIDR(subtotal)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>Ongkos Kirim</span>
          <span>{selectedRate ? formatIDR(shippingFee) : 'Pilih kurir'}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>Biaya Layanan</span>
          <span>{paymentFee === 0 && isValidPaymentMethod(paymentMethod) ? 'Gratis' : formatIDR(paymentFee)}</span>
        </div>
        <div className={styles.summaryTotal}>
          <span>Total Pembayaran</span>
          <span>{formatIDR(grandTotal)}</span>
        </div>
      </div>

      {currentUser && !selectedAddressId && (
        <label className={styles.saveAddressCheck}>
          <input
            type="checkbox"
            checked={saveAddressToAccount}
            onChange={(e) => setSaveAddressToAccount(e.target.checked)}
          />
          <span>Simpan alamat ini ke daftar alamat tersimpan akun saya</span>
        </label>
      )}

      {formError && <p className={styles.inlineError}>{formError}</p>}

      <button
        type="submit"
        className={`${styles.primaryBtn} ${styles.fullWidthBtn}`.trim()}
        disabled={submitting || ratesLoading}
      >
        {submitting ? 'Membuat Pembayaran...' : `Bayar Sekarang — ${formatIDR(grandTotal)}`}
      </button>

      <p className={styles.trustNote}>
        Pembayaran aman otomatis via DOKU (QRIS, Virtual Account, e-Wallet). Garansi 100% DOA ikan hidup.
      </p>
    </form>
  );
}
