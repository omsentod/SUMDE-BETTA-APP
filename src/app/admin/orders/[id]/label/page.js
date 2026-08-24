import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BatchPrintSidebar from './BatchPrintSidebar';
import LabelContent from './LabelContent';
import styles from './label.module.css';

export default async function ShippingLabelPage({ params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } }
  });

  if (!order) return notFound();

  return (
    <div className={styles.viewport}>
      <div className={styles.previewLayout}>
        <div className={styles.labelStream}>
          <div id={`label-${order.id}`} className={styles.labelWrapper}>
            <div className={styles.labelSequenceBadge}>
              Pratinjau Resi • {order.shippingCourier || 'Kurir'} • ID: {order.id.slice(0, 8)}
            </div>
            <LabelContent order={order} />
          </div>
        </div>

        <div className={styles.sidebarColumn}>
          <BatchPrintSidebar orders={[order]} single={true} />
        </div>
      </div>
    </div>
  );
}
