import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { createShipment } from '@/lib/shipping';

export async function POST(request, { params }) {
  try {
    await requireAdmin(request);
    
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    if (order.biteshipShipmentId && order.trackingNumber) {
      return NextResponse.json({ error: 'Pesanan ini sudah memiliki jadwal kurir (pickup).' }, { status: 400 });
    }

    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

    // Call Biteship API (or use existing shipmentId if already generated)
    let shipmentData;
    if (order.biteshipShipmentId) {
      shipmentData = { id: order.biteshipShipmentId, status: order.biteshipStatus || 'allocated' };
    } else {
      shipmentData = await createShipment(order, totalQty);
    }

    const waybillNumber = 
      shipmentData.courier?.waybill_id || 
      shipmentData.courier?.tracking_id || 
      shipmentData.waybill_id || 
      `TEST-${(shipmentData.id || order.id).slice(0, 10).toUpperCase()}`;
    
    // shipmentData contains { id, courier: { waybill_id }, status }
    const updated = await prisma.order.update({
      where: { id },
      data: {
        biteshipShipmentId: shipmentData.id,
        trackingNumber: waybillNumber,
        biteshipStatus: shipmentData.status || 'allocated',
        status: 'SHIPPED' // Automatically mark as shipped once courier is booked
      },
      include: { items: { include: { product: true } } }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Shipment error:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
