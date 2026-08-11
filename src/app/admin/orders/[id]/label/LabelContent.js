import CourierLogo from '@/components/CourierLogo';
import styles from './label.module.css';

// Isi 1 label (100mm x 150mm thermal). Digunakan oleh:
// - /admin/orders/[id]/label/page.js — single label print
// - /admin/orders/labels-batch/page.js — multi label print (page-break per label)
export default function LabelContent({ order }) {
  const waybill = order.trackingNumber || 'PENDING';
  const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={styles.label}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <CourierLogo code={order.shippingCourier || ''} size="lg" />
          <span className={styles.serviceTag}>
            {(order.shippingService || 'REG').toUpperCase()}
          </span>
        </div>
        <div className={styles.codBadge}>NON-COD</div>
      </div>

      <div className={styles.waybillRow}>
        {waybill && (
          <div className={styles.barcodeWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(waybill)}&scale=2&height=12&includetext=0`}
              alt="Barcode AWB"
              className={styles.barcodeImg}
            />
          </div>
        )}
        <div className={styles.waybillNumber}>{waybill}</div>
      </div>

      <div className={styles.addressGrid}>
        <div className={styles.destination}>
          <div className={styles.sectionLabel}>PENERIMA:</div>
          <div className={styles.personName}>{order.name}</div>
          <div className={styles.personPhone}>{order.phone}</div>
          <div className={styles.addressBlock}>
            {order.streetAddress}, {order.rtRw}<br />
            Kel. {order.village}, Kec. {order.district}<br />
            <span className={styles.cityLine}>
              {order.city.toUpperCase()}, {order.province.toUpperCase()}
            </span>
          </div>
          <div className={styles.postalTag}>KODE POS: {order.postalCode}</div>
        </div>

        <div>
          <div className={styles.sectionLabel}>PENGIRIM:</div>
          <div className={styles.shipperName}>SUMDE BETTA</div>
          <div>081234567890</div>
          <div className={styles.addressBlock}>
            Kab. Tulungagung, Jawa Timur<br />
            66218
          </div>
          <div className={styles.shipperDate}>
            Tgl: {new Date(order.createdAt).toLocaleDateString('id-ID')}
          </div>
        </div>
      </div>

      <div className={styles.itemsSection}>
        <div className={styles.itemsHeader}>
          <span>RINCIAN PRODUK</span>
          <span>TOTAL: {totalQty} PCS</span>
        </div>
        <table className={styles.itemsTable}>
          <tbody>
            {order.items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className={styles.itemsQty}>{item.quantity}x</td>
                <td>
                  {item.product?.name || 'Produk Specimen'}
                  {item.selectedSize ? ` (Size: ${item.selectedSize})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.warning}>
        <svg
          className={styles.warningIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <div className={styles.warningTitle}>HEWAN HIDUP / IKAN HIAS</div>
          <div className={styles.warningBody}>
            JANGAN DIBANTING / JANGAN DITINDIH BENDA BERAT
          </div>
        </div>
      </div>
    </div>
  );
}
