import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PrintButton from './PrintButton';
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
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        }
      `}} />
      <div className={styles.actionBar}>
        <span className={styles.actionBarLabel}>Format: Thermal (100×150 mm)</span>
        <PrintButton />
      </div>

      <LabelContent order={order} />
    </div>
  );
}
