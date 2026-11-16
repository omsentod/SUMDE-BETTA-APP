import prisma from '@/lib/prisma';
import Link from 'next/link';
import { buildBaggingRows, resolveTikTokHost, formatVariantLabel } from '@/lib/packingManifest';
import PrintControls from './PrintControls';
import styles from './manifest.module.css';

export default async function PackingManifestPage({ searchParams }) {
  const sp = await searchParams;
  const idsRaw = sp?.ids || '';
  const ids = String(idsRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const stage = (sp?.stage || 'boxing').toLowerCase(); // 'bagging' | 'boxing' | 'ready'
  const autoPrint = sp?.autoPrint === '1' || sp?.autoPrint === 'true';

  let orders = [];

  if (ids.length > 0) {
    orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        orderSource: true,
        tiktokAccountName: true,
        tiktokUsername: true,
        telegramUsername: true,
        tiktokLiveBasket: {
          select: {
            tiktokAccount: {
              select: { handle: true },
            },
          },
        },
        name: true,
        phone: true,
        streetAddress: true,
        district: true,
        city: true,
        province: true,
        postalCode: true,
        shippingCourier: true,
        shippingService: true,
        trackingNumber: true,
        packingStatus: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            customName: true,
            customImage: true,
            selectedSize: true,
            variant: {
              select: {
                imageUrl: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                brand: true,
                department: {
                  select: { isLiveFish: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Hitung total ekor / produk
  const totalItemsCount = orders.reduce((sum, order) => {
    return (
      sum + (order.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 0)
    );
  }, 0);

  const printTimeFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

  if (orders.length === 0) {
    return (
      <div className={styles.pageViewport}>
        <div className={styles.noPrintBar}>
          <div className={styles.barContainer}>
            <Link href="/admin/packing" className={styles.backBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Kembali ke Meja Packing</span>
            </Link>
          </div>
        </div>

        <div className={styles.emptyCard}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2 className={styles.emptyTitle}>Tidak Ada Pesanan Terpilih</h2>
          <p className={styles.emptyDesc}>
            Pilih satu atau beberapa baris menggunakan mode &ldquo;Pilih&rdquo; di halaman packing untuk mencetak lembar dokumen.
          </p>
          <Link href="/admin/packing" className={styles.printActionBtn}>
            Buka Halaman Packing
          </Link>
        </div>
      </div>
    );
  }

  // JIKA TAHAP 1: Cetak Lembar Bungkus Ikan (Kolam & Soliter)
  if (stage === 'bagging') {
    const { baggingRows, totalBaggingFish } = buildBaggingRows(orders);

    return (
      <div className={styles.pageViewport}>
        <PrintControls
          count={baggingRows.length}
          totalItems={totalBaggingFish}
          autoPrint={autoPrint}
          stageLabel="Baris Bungkus"
        />

        <div className={styles.paperSheet}>
          {/* Header Shopee Style Khusus Tahap 1 */}
          <div className={styles.manifestHeader}>
            <div className={styles.headerLeft}>
              <h1 className={styles.storeTitle}>SUMDE BETTA</h1>
              <p className={styles.docSubtitle}>
                Tahap 1 &bull; Lembar Bungkus Plastik Ikan
              </p>
            </div>
            <div className={styles.headerRight}>
              <h2 className={styles.docTitle}>DAFTAR BUNGKUS IKAN</h2>
            </div>
          </div>

          {/* Baris Metadata */}
          <div className={styles.metaRow}>
            <span>Waktu Cetak: <strong>{printTimeFormatted} WIB</strong></span>
            <span className={styles.metaSep}>|</span>
            <span>Total Jenis / Antrean: <strong>{baggingRows.length} Baris</strong></span>
            <span className={styles.metaSep}>|</span>
            <span>Total Ikan Perlu Dibungkus: <strong>{totalBaggingFish} Ekor</strong></span>
          </div>

          {/* Tabel Tahap 1 Murni: No, Foto, Nama Ikan, Varian, Asal/Soliter, Total Ekor, Cek */}
          <table className={styles.manifestTable}>
            <thead>
              <tr>
                <th className={styles.colNum}>No.</th>
                <th className={styles.colThumb}>Foto</th>
                <th>Nama Jenis Ikan</th>
                <th className={styles.colVariant}>Varian</th>
                <th className={styles.colOrigin}>Asal / Lokasi Soliter</th>
                <th className={styles.colQty}>Total Ekor</th>
                <th className={styles.colCheck}>Cek</th>
              </tr>
            </thead>
            <tbody>
              {baggingRows.map((row, idx) => (
                <tr key={row.id} className={styles.tableRow}>
                  <td className={styles.tdNum}>{idx + 1}</td>

                  {/* Foto Ikan (Tersusun vertikal jika pesanan TikTok memiliki multi-item) */}
                  <td className={styles.tdThumb}>
                    {row.items && row.items.length > 1 ? (
                      <div className={styles.verticalThumbList}>
                        {row.items.map((it, i) => (
                          <div key={i} className={styles.verticalThumbItem}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={it.image || '/img/betta-1.png'}
                              alt={it.name}
                              className={styles.productThumb}
                              loading="eager"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={row.items?.[0]?.image || row.image || '/img/betta-1.png'}
                        alt={row.items?.[0]?.name || row.name}
                        className={styles.productThumb}
                        loading="eager"
                      />
                    )}
                  </td>

                  {/* Nama Ikan (Tersusun vertikal per item tanpa koma) */}
                  <td>
                    {row.items && row.items.length > 1 ? (
                      <div className={styles.verticalFishList}>
                        {row.items.map((it, i) => (
                          <div key={i} className={styles.verticalFishRow}>
                            <span className={styles.fishItemQty}>{it.quantity}x</span>
                            <span className={styles.productName}>{it.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.productName}>
                        {row.items?.[0]?.quantity && row.type === 'claim' ? `${row.items[0].quantity}x ` : ''}
                        {row.items?.[0]?.name || row.name}
                      </div>
                    )}
                    <div className={styles.productSubtitle}>{row.subtitle}</div>
                  </td>

                  {/* Varian (Tersusun vertikal berpasangan dengan nama ikan) */}
                  <td className={styles.tdVariant}>
                    {row.items && row.items.length > 1 ? (
                      <div className={styles.verticalVariantList}>
                        {row.items.map((it, i) => (
                          <div key={i} className={styles.verticalVariantRow}>
                            {it.variantText ? (
                              <span className={styles.variantBadgePlain}>
                                {it.variantText}
                              </span>
                            ) : (
                              <span className={styles.dashText}>-</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : formatVariantLabel(row.items?.[0]?.variantText || row.variantText) ? (
                      <span className={styles.variantBadgePlain}>
                        {formatVariantLabel(row.items?.[0]?.variantText || row.variantText)}
                      </span>
                    ) : (
                      <span className={styles.dashText}>-</span>
                    )}
                  </td>

                  {/* Asal / Lokasi Soliter */}
                  <td>
                    {row.type === 'sample' ? (
                      <div className={styles.originTagWeb}>Kolam Sampel</div>
                    ) : row.originType === 'TIKTOK_LIVE' ? (
                      <div className={styles.originCol}>
                        {row.hostAccount && (
                          <div className={styles.hostAccountTag}>
                            Pos: {row.hostAccount}
                          </div>
                        )}
                        <div className={styles.buyerSoliterTag}>
                          Tangki: <strong>{row.buyerTag}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.originCol}>
                        <div className={styles.originTagTelegram}>
                          Telegram Drop
                        </div>
                        <div className={styles.buyerSoliterTag}>
                          Tangki: <strong>{row.buyerTag}</strong>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Total Ekor */}
                  <td className={styles.tdQty}>
                    {row.totalQty} Ekor
                  </td>

                  {/* Kotak Ceklis */}
                  <td className={styles.tdCheck}>
                    <div className={styles.checkSquare} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // JIKA TAHAP 2 & 3: Cetak Daftar Pengiriman & Packing Box ala Shopee Seller Center
  return (
    <div className={styles.pageViewport}>
      <PrintControls
        count={orders.length}
        totalItems={totalItemsCount}
        autoPrint={autoPrint}
        stageLabel="Pesanan"
      />

      <div className={styles.paperSheet}>
        {/* Header Shopee Seller Center Style */}
        <div className={styles.manifestHeader}>
          <div className={styles.headerLeft}>
            <h1 className={styles.storeTitle}>SUMDE BETTA</h1>
            <p className={styles.docSubtitle}>
              {stage === 'ready'
                ? 'Tahap 3 • Manifest Penjemputan Kurir Ekspedisi'
                : 'Tahap 2 • Daftar Pengiriman & Meja Pack Box (Packing List)'}
            </p>
          </div>
          <div className={styles.headerRight}>
            <h2 className={styles.docTitle}>
              {stage === 'ready' ? 'MANIFEST PENJEMPUTAN' : 'DAFTAR PENGIRIMAN'}
            </h2>
          </div>
        </div>

        {/* Baris Metadata */}
        <div className={styles.metaRow}>
          <span>Waktu Cetak: <strong>{printTimeFormatted} WIB</strong></span>
          <span className={styles.metaSep}>|</span>
          <span>Jumlah Pesanan: <strong>{orders.length} Pesanan</strong></span>
          <span className={styles.metaSep}>|</span>
          <span>Total Produk: <strong>{totalItemsCount} Item</strong></span>
        </div>

        {/* Tabel Tahap 2 & 3: No, No. Pesanan, Jasa Kirim & Penerima, Foto, Produk & Variasi, Jumlah, Cek */}
        <table className={styles.manifestTable}>
          <thead>
            <tr>
              <th className={styles.colNum}>No.</th>
              <th className={styles.colOrder}>No. Pesanan</th>
              <th className={styles.colShipping}>Jasa Kirim &amp; Penerima</th>
              <th className={styles.colThumb}>Foto</th>
              <th className={styles.colProduct}>Nama Produk &amp; Variasi</th>
              <th className={styles.colQty}>Jumlah</th>
              <th className={styles.colCheck}>Cek</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, orderIdx) => {
              const items =
                order.items && order.items.length > 0
                  ? order.items
                  : [{ id: 'empty', quantity: 1, customName: 'Item Pesanan' }];
              const rowSpan = items.length;

              const liveHost = resolveTikTokHost(order);
              const sourceText =
                order.orderSource === 'TIKTOK_LIVE'
                  ? `TikTok Live ${liveHost || ''}`.trim()
                  : order.orderSource === 'TELEGRAM'
                  ? `Telegram Drop ${
                      order.telegramUsername
                        ? `@${order.telegramUsername.replace(/^@+/, '')}`
                        : ''
                    }`.trim()
                  : 'Web Store';

              const orderTime = new Intl.DateTimeFormat('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }).format(new Date(order.createdAt));

              return items.map((item, itemIdx) => {
                const isFirst = itemIdx === 0;
                const isLast = itemIdx === items.length - 1;
                const thumbImg =
                  item.customImage ||
                  item.variant?.imageUrl ||
                  item.product?.image ||
                  '/img/betta-1.png';
                const itemName =
                  item.customName || item.product?.name || 'Ikan Betta Hias';
                const variantLabel = formatVariantLabel(item.selectedSize);

                return (
                  <tr
                    key={`${order.id}_${item.id || itemIdx}`}
                    className={`${styles.tableRow} ${
                      isLast ? styles.orderLastRow : ''
                    }`.trim()}
                  >
                    {isFirst && (
                      <>
                        <td rowSpan={rowSpan} className={styles.tdNum}>
                          {orderIdx + 1}
                        </td>
                        <td rowSpan={rowSpan} className={styles.tdOrder}>
                          <div className={styles.orderNumber}>
                            #{order.id.slice(0, 8).toUpperCase()}
                          </div>
                          <div className={styles.orderDate}>{orderTime}</div>
                          <div className={styles.sourceBadge}>{sourceText}</div>
                        </td>
                        <td rowSpan={rowSpan} className={styles.tdShipping}>
                          <div className={styles.courierRow}>
                            <span className={styles.courierName}>
                              {(order.shippingCourier || 'Ekspedisi').toUpperCase()}
                            </span>
                            {order.shippingService && (
                              <span className={styles.courierService}>
                                {order.shippingService}
                              </span>
                            )}
                          </div>
                          <div className={styles.trackingRow}>
                            No. Resi: <strong className={styles.trackingText}>{order.trackingNumber || '-'}</strong>
                          </div>
                          <div className={styles.recipientName}>
                            {order.name} {order.phone ? `(${order.phone})` : ''}
                          </div>
                          <div className={styles.recipientAddress}>
                            {[order.streetAddress, order.district, order.city, order.province]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Foto Item */}
                    <td className={styles.tdThumb}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbImg}
                        alt={itemName}
                        className={styles.productThumb}
                        loading="eager"
                      />
                    </td>

                    {/* Nama Produk & Variasi */}
                    <td className={styles.tdProduct}>
                      <div className={styles.productName}>{itemName}</div>
                      {variantLabel && (
                        <div className={styles.productVariant}>
                          Variasi: <strong>{variantLabel}</strong>
                        </div>
                      )}
                    </td>

                    {/* Kuantitas */}
                    <td className={styles.tdQty}>
                      {item.quantity || 1}
                    </td>

                    {/* Kotak Ceklis */}
                    <td className={styles.tdCheck}>
                      <div className={styles.checkSquare} />
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
