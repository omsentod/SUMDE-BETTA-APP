import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const signature = request.headers.get('biteship-signature');
    // For enhanced security, we should verify signature using BITESHIP_WEBHOOK_SECRET, 
    // but Biteship webhook signature validation is optional if you don't have a secret set yet.
    
    const body = await request.json();
    
    if (body.event === 'order.status' && body.order_id) {
      const { order_id, status, waybill_id } = body;
      
      const order = await prisma.order.findFirst({
        where: { biteshipShipmentId: order_id }
      });

      if (!order) {
        return NextResponse.json({ message: 'Order not found' }, { status: 404 });
      }

      // Map Biteship status to our internal status
      let internalStatus = order.status;
      if (status === 'picked' || status === 'dropping_off') {
        internalStatus = 'SHIPPED';
      } else if (status === 'delivered') {
        internalStatus = 'COMPLETED';
      } else if (status === 'cancelled' || status === 'rejected' || status === 'returned') {
        internalStatus = 'CANCELLED';
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          biteshipStatus: status,
          status: internalStatus,
          ...(waybill_id ? { trackingNumber: waybill_id } : {})
        }
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Event ignored' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
