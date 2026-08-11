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

    // Only bookable once payment succeeded and stock has been reserved.
    // Prevents burning Biteship quota on PENDING (unpaid) or CANCELLED orders.
    if (order.status !== 'PROCESSING') {
      return NextResponse.json(
        { error: `Pesanan tidak bisa dibuat pickup (status saat ini: ${order.status}).` },
        { status: 409 }
      );
    }

    // If a shipment already exists AND we already have a real waybill, this
    // request is a duplicate — reject so the admin doesn't burn quota re-booking.
    if (order.biteshipShipmentId && order.trackingNumber) {
      return NextResponse.json(
        { error: 'Pesanan ini sudah memiliki jadwal kurir (pickup).' },
        { status: 409 }
      );
    }

    const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

    // Book (or, when Biteship's async allocation hasn't produced a waybill yet,
    // re-use the existing shipment id and simply wait for the webhook to fill
    // the waybill in).
    let shipmentData;
    let bookedFresh = false;
    if (order.biteshipShipmentId) {
      // Shipment already booked; waybill will arrive via webhook. Don't call
      // Biteship again — that would create a duplicate shipment.
      shipmentData = {
        id: order.biteshipShipmentId,
        status: order.biteshipStatus || 'allocated',
        courier: {},
      };
    } else {
      shipmentData = await createShipment(order, totalQty);
      bookedFresh = true;
    }

    const freshWaybill =
      shipmentData.courier?.waybill_id ||
      shipmentData.courier?.tracking_id ||
      shipmentData.waybill_id ||
      null;

    // Only write trackingNumber when it came from a fresh Biteship response.
    // Prior code fell back to `TEST-<truncated-id>` which would overwrite a
    // real waybill once the webhook filled one in.
    const data = {
      biteshipShipmentId: shipmentData.id,
      biteshipStatus: shipmentData.status || 'allocated',
    };
    if (freshWaybill) {
      data.trackingNumber = freshWaybill;
      // We only flip to SHIPPED when we actually have a waybill to show the
      // customer. Otherwise leave the order as PROCESSING and let the webhook
      // move it forward.
      data.status = 'SHIPPED';
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: { items: { include: { product: true } } }
    });

    return NextResponse.json({
      ...updated,
      _meta: {
        bookedFresh,
        awaitingWaybill: !freshWaybill,
      },
    });
  } catch (error) {
    console.error('Shipment error:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
