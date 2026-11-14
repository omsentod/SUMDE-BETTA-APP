'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
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
  const [newItemsAlert, setNewItemsAlert] = useState(null);

  const prevItemsCountRef = useRef(0);
  const isPollingRef = useRef(false);

  const [activeOrder, setActiveOrder] = useState(() =>
    urlOrderId ? { orderId: urlOrderId, paymentUrl: null, total: null, email: '' } : null
  );
  const [paymentState, setPaymentState] = useState(() => (urlOrderId ? 'waiting' : 'idle'));
  const [resumingId, setResumingId] = useState(null);

  const pollActiveBasket = useCallback(async (tokenToPoll) => {
    if (!tokenToPoll || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const res = await fetch(`/api/live/lookup?token=${encodeURIComponent(tokenToPoll)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.found) return;

      const currentCount = data.openBasket?.items?.length || 0;
      const prevCount = prevItemsCountRef.current;

      if (prevCount > 0 && currentCount > prevCount) {
        const addedCount = currentCount - prevCount;
        const msg = `${addedCount} ikan baru deal dari live streaming masuk ke keranjang!`;
        setNewItemsAlert(msg);
        toast.info(msg);
      }

      prevItemsCountRef.current = currentCount;
      setLookupResult(data);
    } catch {
      // Ignore background network transient jitter
    } finally {
      isPollingRef.current = false;
    }
  }, [toast]);

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

      prevItemsCountRef.current = data.openBasket?.items?.length || 0;
      setLookupResult(data);
    } catch (err) {
      setLookupError(err.message);
      setLookupResult(null);
    } finally {
      setSearching(false);
    }
  }, []);

  const checkOrderStatus = useCallback(async (orderId, showFeedback = false) => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, { cache: 'no-store' });
      if (!res.ok) {
        if (showFeedback) toast.error('Gagal memeriksa status pesanan.');
        return;
      }
      const data = await res.json();
      if (['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(data.status)) {
        setPaymentState('paid');
        if (showFeedback) {
          toast.success('Pembayaran terverifikasi! Pesanan Anda sedang diproses.');
        }
      } else if (data.status === 'CANCELLED') {
        setPaymentState('idle');
        setActiveOrder(null);
        toast.info('Transaksi pembayaran dibatalkan.');
      } else {
        if (showFeedback) {
          toast.info('Status pesanan: Belum Dibayar (PENDING). Selesaikan pembayaran di DOKU atau klik Kembali untuk melihat rincian pesanan.');
        }
      }
    } catch {
      if (showFeedback) toast.error('Koneksi terganggu saat memeriksa status pesanan.');
    }
  }, [toast]);

  const handleBackToBasket = useCallback(() => {
    setPaymentState('idle');
    if (typeof window !== 'undefined') {
      const cleanUrl = urlToken ? `/live/${encodeURIComponent(urlToken)}` : '/live';
      window.history.replaceState({}, '', cleanUrl);
    }
    if (activeToken) {
      performLookup(activeToken);
    }
  }, [urlToken, activeToken, performLookup]);

  useEffect(() => {
    const handlePopState = () => {
      if (paymentState === 'waiting') {
        handleBackToBasket();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [paymentState, handleBackToBasket]);

  useEffect(() => {
    if (!urlOrderId && !urlToken) return;
    const timer = setTimeout(() => {
      if (urlToken) {
        performLookup(urlToken);
      }
      if (urlOrderId) {
        checkOrderStatus(urlOrderId, false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [urlOrderId, urlToken, checkOrderStatus, performLookup]);

  // Real-time background sync every 3.5s while basket is OPEN
  useEffect(() => {
    if (!activeToken || paymentState !== 'waiting' && paymentState !== 'idle') return;
    if (paymentState === 'waiting') return; // Handled by checkOrderStatus

    let cancelled = false;

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !cancelled) {
        await pollActiveBasket(activeToken);
      }
    };

    const interval = setInterval(tick, 3500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeToken, paymentState, pollActiveBasket]);

  // Auto-dismiss new items banner after 6 seconds
  useEffect(() => {
    if (!newItemsAlert) return;
    const t = setTimeout(() => setNewItemsAlert(null), 6000);
    return () => clearTimeout(t);
  }, [newItemsAlert]);

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
        window.location.assign(data.paymentUrl);
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
      window.location.assign(info.paymentUrl);
    }
  };

  const hasDirectToken = Boolean(urlToken);

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={styles.hero}>
          {/* TikTok Live Stream Brand Header */}
          <div className={styles.liveHeaderBadge}>
            <div className={styles.liveBadgeLeft}>
              <div className={styles.tiktokLogoTile} aria-label="TikTok">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </div>
              <span className={styles.livePill}>
                <span className={styles.liveDot} />
                LIVE
              </span>
              <span className={styles.liveSessionTitle}>Sesi Live Streaming</span>
            </div>

            {lookupResult?.openBasket?.liveAccountHandles?.length > 0 && (
              <div className={styles.liveAccountPill}>
                <span className={styles.liveAccountLabel}>Akun Live:</span>
                <span className={styles.liveAccountName}>
                  {lookupResult.openBasket.liveAccountHandles.join(', ')}
                </span>
              </div>
            )}
          </div>

          <h1 className={styles.heroTitle}>
            {lookupResult?.tiktokUsername
              ? `Keranjang Live @${lookupResult.tiktokUsername}`
              : 'Checkout TikTok Live'}
          </h1>
          <p className={styles.heroSubtitle}>
            Semua ikan deal live tersinkronisasi otomatis dalam satu link pribadi. Cukup bayar 1x ongkir untuk seluruh ikan.
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
                  className={styles.primaryBtn}
                >
                  Buka Halaman Pembayaran DOKU
                </a>
              )}
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={() => checkOrderStatus(activeOrder.orderId, true)}
              >
                Cek Status Sekarang
              </button>
              <button
                type="button"
                className={styles.outlineBtn}
                onClick={handleBackToBasket}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Kembali ke Rincian Pesanan
              </button>
              <Link href="/customer/orders" className={styles.ghostBtn}>
                Lihat di Pesanan Saya
              </Link>
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
                      <div className={styles.basketTitleRow}>
                        <h2 className={styles.buyerTitle}>Keranjang @{lookupResult.openBasket.tiktokUsername}</h2>
                        <span className={styles.realtimeSyncBadge} title="Terkoneksi langsung ke admin live streaming">
                          <span className={styles.syncPulseDot} />
                          Live Sync Aktif
                        </span>
                      </div>
                      <p className={styles.helperText}>
                        {lookupResult.openBasket.totalQty} ikan terkumpul dalam 1 tagihan & 1 kali ongkir.
                      </p>
                    </div>
                    <span className={styles.claimBadge}>{lookupResult.openBasket.claimCode}</span>
                  </div>

                  {/* Sesi Live Boundary Notice (Anti-hoarding across live sessions) */}
                  <div className={styles.sessionBoundaryNotice}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <div>
                      <strong>Khusus Sesi Live Saat Ini:</strong> Selesaikan checkout untuk mengamankan ikan sebelum sesi live berakhir. Ikan yang belum dibayar tidak dapat digabung ke sesi live hari berikutnya.
                    </div>
                  </div>

                  {newItemsAlert && (
                    <div className={styles.newItemsAlert}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{newItemsAlert}</span>
                    </div>
                  )}

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
                            {item.note ? ` · ${item.note}` : ''}
                          </div>
                          {item.accountHandle && (
                            <span className={styles.itemAccountBadge}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                              </svg>
                              Deal di {item.accountHandle}
                            </span>
                          )}
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
                    newItemsAlert={newItemsAlert}
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
