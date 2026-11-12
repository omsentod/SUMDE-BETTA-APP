'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import LiveCheckoutForm from './LiveCheckoutForm';
import styles from './live.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

function isValidTokenFormat(raw) {
  return /^[A-Za-z0-9_-]{12,64}$/.test(String(raw || '').trim());
}

function extractTokenFromInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (isValidTokenFormat(trimmed)) return trimmed;
  try {
    const parsed = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://placeholder.local');
    const q = parsed.searchParams.get('token');
    if (q && isValidTokenFormat(q)) return q;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const liveIdx = parts.indexOf('live');
    if (liveIdx !== -1 && parts[liveIdx + 1] && isValidTokenFormat(parts[liveIdx + 1])) {
      return parts[liveIdx + 1];
    }
  } catch {
    // fallback below
  }
  const match = trimmed.match(/\/live\/([A-Za-z0-9_-]{12,64})/);
  return match ? match[1] : '';
}

function LiveClaimContent({ initialToken = '' }) {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const urlToken = initialToken || searchParams.get('token') || '';
  const urlOrderId = searchParams.get('orderId') || '';

  const [tokenInput, setTokenInput] = useState(urlToken);
  const [activeToken, setActiveToken] = useState(urlToken);
  const [searching, setSearching] = useState(Boolean(urlToken));
  const [lookupError, setLookupError] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const [activeOrder, setActiveOrder] = useState(() =>
    urlOrderId ? { orderId: urlOrderId, paymentUrl: null, total: null, email: '' } : null
  );
  const [paymentState, setPaymentState] = useState(() => (urlOrderId ? 'waiting' : 'idle'));
  const [resumingId, setResumingId] = useState(null);

  const performLookup = useCallback(async (rawVal) => {
    const extracted = extractTokenFromInput(rawVal);
    if (!extracted) {
      setSearching(false);
      setLookupError('Tempel link klaim unik atau kode token dari DM admin TikTok kami.');
      return;
    }

    setSearching(true);
    setLookupError('');
    setShowCheckout(false);
    setActiveToken(extracted);
    try {
      const res = await fetch(`/api/live/lookup?token=${encodeURIComponent(extracted)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuka pesanan live.');

      setLookupResult(data);
    } catch (err) {
      setLookupError(err.message);
      setLookupResult(null);
    } finally {
      setSearching(false);
    }
  }, []);

  const checkOrderStatus = useCallback(async (orderId) => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(data.status)) {
        setPaymentState('paid');
      } else if (data.status === 'CANCELLED') {
        setPaymentState('idle');
        setActiveOrder(null);
        toast.info('Transaksi pembayaran dibatalkan.');
      }
    } catch {
      // ignore transient network polling failure
    }
  }, [toast]);

  useEffect(() => {
    if (!urlOrderId && !urlToken) return;
    const timer = setTimeout(() => {
      if (urlOrderId) {
        checkOrderStatus(urlOrderId);
      } else if (urlToken) {
        performLookup(urlToken);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [urlOrderId, urlToken, checkOrderStatus, performLookup]);

  useEffect(() => {
    if (paymentState !== 'waiting' || !activeOrder?.orderId) return;
    const interval = setInterval(() => {
      checkOrderStatus(activeOrder.orderId);
    }, 4000);
    return () => clearInterval(interval);
  }, [paymentState, activeOrder?.orderId, checkOrderStatus]);

  const handleLookupSubmit = (e) => {
    e.preventDefault();
    setPaymentState('idle');
    setActiveOrder(null);
    performLookup(tokenInput);
  };

  const handleResumePendingOrder = async (pending) => {
    setResumingId(pending.orderId);
    try {
      const tokenForCallback = pending.claimToken || activeToken;
      const callbackBase = tokenForCallback
        ? `${window.location.origin}/live/${encodeURIComponent(tokenForCallback)}`
        : `${window.location.origin}/live`;
      const callbackUrl = `${callbackBase}?orderId=${encodeURIComponent(pending.orderId)}`;
      const res = await fetch('/api/payment/doku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: pending.orderId, callbackUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat link pembayaran.');

      setActiveOrder({
        orderId: pending.orderId,
        paymentUrl: data.paymentUrl,
        total: pending.total,
        email: '',
      });
      setPaymentState('waiting');
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResumingId(null);
    }
  };

  const handlePaymentCreated = (info) => {
    setActiveOrder(info);
    setPaymentState('waiting');
    setShowCheckout(false);
    if (info.paymentUrl) {
      window.open(info.paymentUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const hasDirectToken = Boolean(urlToken);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.hero}>
          <div className={styles.heroIconWrap}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <h1 className={styles.heroTitle}>
            {lookupResult?.tiktokUsername
              ? `Keranjang Live @${lookupResult.tiktokUsername}`
              : 'Klaim Pesanan TikTok Live'}
          </h1>
          <p className={styles.heroSubtitle}>
            Semua ikan yang sudah kamu deal di live streaming dikumpulkan dalam satu link pribadi ini agar cukup bayar 1x ongkos kirim.
          </p>
        </div>

        {/* Jika dibuka tanpa token di URL, tampilkan form paste link/token pribadi */}
        {!hasDirectToken && (
          <div className={styles.card}>
            <form onSubmit={handleLookupSubmit} className={styles.lookupForm}>
              <label className={styles.label} htmlFor="live-token-input">
                Link Klaim Unik / Token dari DM Admin
              </label>
              <div className={styles.lookupRow}>
                <div className={styles.inputPrefixWrap}>
                  <input
                    id="live-token-input"
                    type="text"
                    className={styles.inputBorderless}
                    placeholder="Tempel link klaim unik atau token dari DM..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                  />
                </div>
                <button type="submit" className={styles.primaryBtn} disabled={searching}>
                  {searching ? 'Membuka...' : 'Buka Pesanan'}
                </button>
              </div>
              {lookupError && <p className={styles.inlineError}>{lookupError}</p>}
              <p className={styles.helperText}>
                Demi keamanan pemenang, pesanan hanya bisa dibuka menggunakan link unik pribadi yang dikirim admin lewat DM TikTok — bukan sekadar mengetik username.
              </p>
            </form>
          </div>
        )}

        {hasDirectToken && searching && (
          <div className={`${styles.card} ${styles.emptyState}`}>
            <p className={styles.helperText}>Memuat daftar pesanan live kamu...</p>
          </div>
        )}

        {hasDirectToken && !searching && lookupError && (
          <div className={`${styles.card} ${styles.emptyState}`}>
            <h2 className={styles.emptyTitle}>Link Klaim Tidak Valid</h2>
            <p className={styles.helperText}>{lookupError}</p>
          </div>
        )}

        {/* Status Pembayaran Selesai */}
        {paymentState === 'paid' && activeOrder && (
          <div className={`${styles.card} ${styles.statusCard}`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h2 className={styles.emptyTitle}>Pembayaran Diterima</h2>
            <p className={styles.helperText}>
              Terima kasih! Pesanan #{activeOrder.orderId.slice(0, 8)} sudah lunas dan segera kami siapkan untuk pengiriman.
            </p>
            <div className={styles.statusActions}>
              <Link
                href={`/lacak-pesanan?orderId=${encodeURIComponent(activeOrder.orderId)}${activeOrder.email ? `&email=${encodeURIComponent(activeOrder.email)}` : ''}`}
                className={styles.primaryBtn}
              >
                Lacak Pengiriman
              </Link>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => {
                  setPaymentState('idle');
                  setActiveOrder(null);
                  if (activeToken) performLookup(activeToken);
                }}
              >
                Lihat Status Keranjang
              </button>
            </div>
          </div>
        )}

        {/* Status Menunggu Pembayaran DOKU */}
        {paymentState === 'waiting' && activeOrder && (
          <div className={`${styles.card} ${styles.statusCard}`}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 className={styles.emptyTitle}>Menunggu Pembayaran</h2>
            <p className={styles.helperText}>
              Order #{activeOrder.orderId.slice(0, 8)}
              {activeOrder.total ? ` senilai ${formatIDR(activeOrder.total)}` : ''} sedang menunggu penyelesaian di halaman DOKU. Status diperbarui otomatis.
            </p>
            <div className={styles.statusActions}>
              {activeOrder.paymentUrl && (
                <a
                  href={activeOrder.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryBtn}
                >
                  Buka Halaman Pembayaran DOKU
                </a>
              )}
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => checkOrderStatus(activeOrder.orderId)}
              >
                Cek Status Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Hasil Lookup Keranjang Live */}
        {paymentState === 'idle' && !searching && lookupResult && (
          <>
            {!lookupResult.found && (
              <div className={`${styles.card} ${styles.emptyState}`}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <h2 className={styles.emptyTitle}>Link Klaim Tidak Ditemukan</h2>
                <p className={styles.helperText}>
                  Pastikan kamu membuka link lengkap yang dikirim oleh admin SUMDE BETTA, atau hubungi admin via DM TikTok jika link bermasalah.
                </p>
              </div>
            )}

            {lookupResult.found && lookupResult.isCancelled && !lookupResult.openBasket && lookupResult.pendingOrders.length === 0 && (
              <div className={`${styles.card} ${styles.emptyState}`}>
                <h2 className={styles.emptyTitle}>Pesanan Dibatalkan</h2>
                <p className={styles.helperText}>
                  Keranjang atau pesanan untuk link ini sudah dibatalkan. Hubungi admin jika kamu ingin order ulang saat live berikutnya.
                </p>
              </div>
            )}

            {lookupResult.found && !lookupResult.openBasket && lookupResult.pendingOrders.length === 0 && lookupResult.paidCount > 0 && (
              <div className={`${styles.card} ${styles.emptyState}`}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h2 className={styles.emptyTitle}>Pesanan Sudah Lunas</h2>
                <p className={styles.helperText}>
                  Pesanan live untuk @{lookupResult.tiktokUsername} sudah dibayar dan sedang kami proses untuk pengiriman.
                </p>
                <Link href="/lacak-pesanan" className={styles.primaryBtn}>
                  Lacak Pesanan Saya
                </Link>
              </div>
            )}

            {/* Pesanan Pending yang Belum Selesai Dibayar */}
            {lookupResult.pendingOrders?.map((pending) => (
              <div key={pending.orderId} className={`${styles.card} ${styles.pendingBanner}`}>
                <div className={styles.basketHeader}>
                  <div>
                    <h2 className={styles.buyerTitle}>Pembayaran Tertunda — #{pending.orderId.slice(0, 8)}</h2>
                    <p className={styles.helperText}>
                      Pesanan ini sudah di-checkout. Selesaikan pembayaran agar ikan segera diproses.
                    </p>
                  </div>
                  <span className={styles.claimBadge}>{pending.claimCode}</span>
                </div>

                <div className={styles.itemList}>
                  {pending.items.map((it) => (
                    <div key={it.id} className={styles.itemRow}>
                      <img src={it.image || '/img/betta-1.png'} alt={it.name} className={styles.itemImg} />
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>
                          {it.name} {it.selectedSize ? `(${it.selectedSize})` : ''}
                        </div>
                        <div className={styles.itemMeta}>
                          {it.quantity} × {formatIDR(it.price)}
                        </div>
                      </div>
                      <div className={styles.itemPrice}>{formatIDR((it.price || 0) * (it.quantity || 1))}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.subtotalBar}>
                  <span className={styles.subtotalLabel}>Total Tagihan</span>
                  <span className={styles.subtotalVal}>{formatIDR(pending.total)}</span>
                </div>

                <button
                  type="button"
                  className={`${styles.primaryBtn} ${styles.fullWidthBtn}`.trim()}
                  disabled={resumingId === pending.orderId}
                  onClick={() => handleResumePendingOrder(pending)}
                >
                  {resumingId === pending.orderId ? 'Membuka DOKU...' : 'Lanjutkan Pembayaran DOKU'}
                </button>
              </div>
            ))}

            {/* Keranjang Keep Terbuka */}
            {lookupResult.openBasket && (
              <>
                <div className={styles.card}>
                  <div className={styles.basketHeader}>
                    <div>
                      <h2 className={styles.buyerTitle}>Keranjang @{lookupResult.openBasket.tiktokUsername}</h2>
                      <p className={styles.helperText}>
                        {lookupResult.openBasket.totalQty} item siap di-checkout dalam 1 pengiriman.
                      </p>
                    </div>
                    <span className={styles.claimBadge}>{lookupResult.openBasket.claimCode}</span>
                  </div>

                  <div className={styles.itemList}>
                    {lookupResult.openBasket.items.map((item) => (
                      <div key={item.id} className={styles.itemRow}>
                        <img
                          src={item.image || '/img/betta-1.png'}
                          alt={item.name}
                          className={styles.itemImg}
                        />
                        <div className={styles.itemInfo}>
                          <div className={styles.itemName}>
                            {item.name} {item.selectedSize ? `(${item.selectedSize})` : ''}
                          </div>
                          <div className={styles.itemMeta}>
                            {item.quantity} × {formatIDR(item.price)}
                            {item.accountHandle ? ` · ${item.accountHandle}` : ''}
                            {item.note ? ` · ${item.note}` : ''}
                          </div>
                        </div>
                        <div className={styles.itemPrice}>
                          {formatIDR((item.price || 0) * (item.quantity || 1))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.subtotalBar}>
                    <span className={styles.subtotalLabel}>Subtotal Ikan</span>
                    <span className={styles.subtotalVal}>{formatIDR(lookupResult.openBasket.subtotal)}</span>
                  </div>

                  {!showCheckout && (
                    <button
                      type="button"
                      className={`${styles.primaryBtn} ${styles.fullWidthBtn}`.trim()}
                      onClick={() => setShowCheckout(true)}
                    >
                      Lanjut ke Pengiriman & Pembayaran
                    </button>
                  )}
                </div>

                {showCheckout && (
                  <LiveCheckoutForm
                    basket={lookupResult.openBasket}
                    onCancel={() => setShowCheckout(false)}
                    onPaymentCreated={handlePaymentCreated}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LiveClaimClient({ initialToken = '' }) {
  return (
    <Suspense fallback={<div className={styles.wrapper}><div className={styles.container}>Memuat halaman live...</div></div>}>
      <LiveClaimContent initialToken={initialToken} />
    </Suspense>
  );
}
