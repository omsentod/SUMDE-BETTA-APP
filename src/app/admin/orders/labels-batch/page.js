import prisma from '@/lib/prisma';
import PrintButton from '../[id]/label/PrintButton';
import LabelContent from '../[id]/label/LabelContent';
import styles from '../[id]/label/label.module.css';

// GET /admin/orders/labels-batch?ids=id1,id2,id3
// Render banyak label thermal berurut. Print sekali → semua label keluar
// dengan page break per label (aturan @media print di label.module.css).
export default async function LabelsBatchPage({ searchParams }) {
  const sp = await searchParams;
  const idsRaw = sp?.ids || '';
  const ids = String(idsRaw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50); // safety cap

  if (ids.length === 0) {
    return (
      <div className={styles.viewport}>
        <div className={styles.actionBar}>
          <span className={styles.actionBarLabel}>Tidak ada ID pesanan di query string.</span>
        </div>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: { items: { include: { product: true } } },
  });

  // Urutkan sesuai urutan query string supaya prediktif.
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const ordered = ids.map((id) => orderById.get(id)).filter(Boolean);

  return (
    <div className={styles.viewport}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        }
      `}} />
      <div className={styles.actionBar}>
        <span className={styles.actionBarLabel}>
          Format: Thermal (100×150 mm) — {ordered.length} label
        </span>
        <PrintButton />
      </div>

      {ordered.map((order) => (
        <LabelContent key={order.id} order={order} />
      ))}
    </div>
  );
}
