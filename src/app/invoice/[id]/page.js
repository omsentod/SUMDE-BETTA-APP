'use client';

import { useState, useEffect, Suspense, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './invoice.module.css';

function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

function InvoiceContent({ paramsPromise }) {
  const params = use(paramsPromise);
  const orderId = params?.id;
  const searchParams = useSearchParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestIdentifier, setGuestIdentifier] = useState(
    () => searchParams.get('email') || searchParams.get('phone') || ''
  );
  const [inputVal, setInputVal] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (!orderId) return;

    async function load() {
      try {
        const query = guestIdentifier ? `?email=${encodeURIComponent(guestIdentifier)}` : '';
        const res = await fetch(`/api/orders/${orderId}/invoice${query}`);
        const data = await res.json();

        if (ignore) return;
        if (!res.ok) {
          if (res.status === 403) {
            setNeedsVerification(true);
            setLoading(false);
            return;
          }
          throw new Error(data.error || 'Gagal memuat faktur pesanan.');
        }

        setOrder(data);
        setNeedsVerification(false);
      } catch (err) {
        if (!ignore) setError(err.message || 'Terjadi kesalahan sistem.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [orderId, guestIdentifier]);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    const clean = inputVal.trim();
    if (!clean) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice?email=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          setError('Email atau nomor HP tidak cocok dengan data pesanan.');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Gagal memuat faktur.');
      }
      setOrder(data);
      setGuestIdentifier(clean);
      setNeedsVerification(false);
    } catch (err) {
      setError(err.message || 'Gagal memverifikasi.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.invoicePage}>
        <div className={styles.invoiceWrapper} style={{ textAlign: 'center', paddingTop: '6rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Memuat faktur resmi...</p>
        </div>
      </div>
    );
  }

  if (needsVerification) {
    return (
      <div className={styles.invoicePage}>
        <div className={styles.invoiceWrapper}>
          <div className={styles.verifyCard}>
            <h2 className={styles.verifyTitle}>Verifikasi Faktur</h2>
            <p className={styles.verifyDesc}>
              Untuk melindungi privasi transaksi, silakan masukkan alamat email atau nomor telepon yang Anda gunakan saat pemesanan.
            </p>
            <form onSubmit={handleVerifySubmit} className={styles.verifyForm}>
              <input
                type="text"
                placeholder="nama@email.com atau 08123456789"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className={styles.inputField}
                required
                autoFocus
              />
              <button type="submit" className={styles.submitBtn}>
                Buka Faktur
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.invoicePage}>
        <div className={styles.invoiceWrapper} style={{ textAlign: 'center', paddingTop: '6rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Faktur Tidak Ditemukan</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error || 'Pesanan tidak tersedia.'}</p>
          <Link href="/" className={styles.btnSecondary}>
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = order.status === 'PAID' || order.status === 'PROCESSING' || order.status === 'SHIPPED' || order.status === 'COMPLETED';
  const fullAddress = [
    order.streetAddress,
    order.rtRw ? `RT/RW ${order.rtRw}` : null,
    order.village ? `Kel. ${order.village}` : null,
    order.district ? `Kec. ${order.district}` : null,
    order.city,
    order.province,
    order.postalCode,
  ].filter(Boolean).join(', ');

  const calculatedSubtotal = order.subtotal !== undefined && order.subtotal > 0
    ? order.subtotal
    : Math.max(0, (order.total || 0) - (order.shippingFee || 0) - (order.paymentFee || 0));

  return (
    <div className={styles.invoicePage}>
      <div className={styles.invoiceWrapper}>
        
        {/* Screen Toolbar */}
        <div className={styles.toolbar}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.btnSecondary}
          >
            <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Kembali
          </button>

          <div className={styles.toolbarActions}>
            <Link
              href={`/lacak-pesanan?orderId=${encodeURIComponent(order.id)}&email=${encodeURIComponent(order.email)}`}
              className={styles.btnSecondary}
            >
              <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.948c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75" />
              </svg>
              Lacak Pengiriman
            </Link>

            <button
              type="button"
              onClick={() => window.print()}
              className={styles.btnPrint}
            >
              <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Cetak / Unduh PDF
            </button>
          </div>
        </div>

        {/* Invoice Paper Document */}
        <div className={styles.invoicePaper}>
          
          {/* Header */}
          <div className={styles.invoiceHeader}>
            <div>
              <h1 className={styles.brandTitle}>SUMDE BETTA</h1>
              <div className={styles.brandSubtitle}>Koleksi Akuatik Eksklusif</div>
              <div className={styles.brandAddress}>
                Breeding Farm &amp; Curatorial Studio<br />
                Surabaya, Jawa Timur · WhatsApp: 0812-3456-7890
              </div>
            </div>

            <div className={styles.invoiceMetaRight}>
              <h2 className={styles.invoiceTitle}>Faktur Pembayaran</h2>
              <div className={styles.invoiceNumber}>No. INV-{order.id.slice(0, 8).toUpperCase()}</div>
              <div className={styles.brandAddress}>Tanggal: {formatDate(order.createdAt)}</div>
              <div>
                {isPaid ? (
                  <span className={styles.statusBadgePaid}>Lunas / Paid</span>
                ) : (
                  <span className={styles.statusBadgePending}>Menunggu Pembayaran</span>
                )}
              </div>
            </div>
          </div>

          {/* Info Grid: Destination & Shipping */}
          <div className={styles.infoGrid}>
            <div>
              <div className={styles.infoBlockHeading}>Tujuan Pengiriman</div>
              <div className={styles.infoName}>{order.name}</div>
              <div className={styles.infoText}>
                {order.phone && <div>No. Telp: <span className={styles.infoHighlight}>{order.phone}</span></div>}
                {order.email && <div>Email: {order.email}</div>}
                <div style={{ marginTop: '0.35rem' }}>{fullAddress}</div>
              </div>
            </div>

            <div>
              <div className={styles.infoBlockHeading}>Rincian Ekspedisi &amp; Pembayaran</div>
              <div className={styles.infoText}>
                <div>Ekspedisi: <span className={styles.infoHighlight}>{order.shippingCourier || 'Kurir Reguler'} {order.shippingService ? `(${order.shippingService})` : ''}</span></div>
                {order.trackingNumber && (
                  <div>No. Resi (AWB): <span className={styles.infoHighlight}>{order.trackingNumber}</span></div>
                )}
                <div style={{ marginTop: '0.35rem' }}>
                  Metode Bayar: <span className={styles.infoHighlight}>{order.paymentMethod ? `DOKU (${order.paymentMethod})` : 'DOKU Checkout'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className={styles.tableContainer}>
            <table className={styles.invoiceTable}>
              <thead>
                <tr>
                  <th>Item / Produk</th>
                  <th>Qty</th>
                  <th>Harga Satuan</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item) => {
                  const name = item.customName || item.product?.name || 'Koleksi Ikan Betta';
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.itemTitle}>{name}</div>
                        {item.selectedSize && (
                          <div className={styles.itemSubtitle}>Ukuran/Varian: <b>{item.selectedSize}</b></div>
                        )}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatIDR(item.price)}</td>
                      <td>{formatIDR(item.price * item.quantity)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className={styles.breakdownWrapper}>
            <div className={styles.breakdownTable}>
              <div className={styles.calcRow}>
                <span>Subtotal Produk</span>
                <span className={styles.calcRowVal}>{formatIDR(calculatedSubtotal)}</span>
              </div>
              <div className={styles.calcRow}>
                <span>Ongkos Kirim ({order.shippingCourier || 'Kurir'})</span>
                <span className={styles.calcRowVal}>{formatIDR(order.shippingFee)}</span>
              </div>
              {order.paymentFee > 0 && (
                <div className={styles.calcRow}>
                  <span>Biaya Layanan</span>
                  <span className={styles.calcRowVal}>{formatIDR(order.paymentFee)}</span>
                </div>
              )}
              <div className={styles.calcTotalRow}>
                <span>Total Tagihan</span>
                <span className={styles.calcTotalVal}>{formatIDR(order.total)}</span>
              </div>
            </div>
          </div>

          {/* DOA Guarantee Assurance */}
          <div className={styles.guaranteeBox}>
            <div className={styles.guaranteeTitle}>Jaminan 100% Ikan Hidup (DOA - Death on Arrival)</div>
            Semua pesanan ikan hidup dikemas secara higienis menggunakan kantong beroksigen ganda dan peredam benturan khusus. Klaim garansi penggantian berlaku dengan melampirkan video unboxing tanpa jeda maksimal 1x24 jam sejak paket diserahkan oleh kurir.
          </div>

          {/* Footer */}
          <div className={styles.invoiceFooter}>
            Faktur ini merupakan bukti transaksi resmi yang diterbitkan secara elektronik oleh SUMDE BETTA.<br />
            Jika Anda memiliki pertanyaan seputar pesanan ini, silakan hubungi Layanan Pelanggan kami.
          </div>

        </div>

      </div>
    </div>
  );
}

export default function InvoicePage({ params }) {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center' }}>Memuat faktur...</div>}>
      <InvoiceContent paramsPromise={params} />
    </Suspense>
  );
}
