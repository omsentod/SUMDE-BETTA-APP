import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { applyBiteshipUpdate } from '@/lib/shipmentStatus';

// Real-time push path for Biteship shipment updates. The actual status
// transition logic lives in src/lib/shipmentStatus.js so it stays identical
// to the scheduled reconcile cron (src/app/api/shipping/reconcile) — this
// route only authenticates the request and unwraps the payload.

// Constant-time signature comparison over hex-encoded HMACs.
function signaturesMatch(receivedHex, expectedHex) {
  if (!receivedHex || !expectedHex) return false;
  let a, b;
  try {
    a = Buffer.from(receivedHex, 'hex');
    b = Buffer.from(expectedHex, 'hex');
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

async function findOrderByShipment(biteshipId) {
  if (!biteshipId) return null;
  return prisma.order.findFirst({
    where: { biteshipShipmentId: biteshipId },
    include: { items: { include: { product: true } } },
  });
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const trimmed = rawBody.trim();

    // Biteship (and most vendors) POSTs an empty body at webhook install time
    // to probe that the URL is reachable, without a signature header. Accept
    // it — no body means no state mutation is possible.
    if (!trimmed || trimmed === '{}') {
      console.log('Biteship webhook: install probe / empty body — acknowledging.');
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const signatureHeader = request.headers.get('biteship-signature');
    const secret = process.env.BITESHIP_WEBHOOK_SECRET;

    if (!secret) {
      console.error('Biteship webhook rejected: BITESHIP_WEBHOOK_SECRET is not configured.');
      return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
    }
    if (!signatureHeader) {
      console.error('Biteship webhook rejected: missing biteship-signature header.');
      return NextResponse.json({ error: 'Missing signature.' }, { status: 401 });
    }

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!signaturesMatch(signatureHeader, expected)) {
      console.error('Biteship webhook signature verification failed.');
      return NextResponse.json({ error: 'Signature mismatch.' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Two event shapes carry a shipment update:
    //  - order.waybill_id : AWB finally assigned (often minutes after booking)
    //  - order.status     : courier progressed (picked / delivered / …)
    // Both reduce to "here's a possibly-new status and/or waybill for this
    // Biteship order" — applyBiteshipUpdate figures out the right transition.
    let biteshipId = null;
    let biteshipStatus = null;
    let waybillId = null;

    if (body.event === 'order.waybill_id') {
      biteshipId = body.order_id;
      waybillId =
        body.waybill_id || body.courier?.waybill_id || body.courier?.tracking_id || null;
      if (!waybillId) {
        return NextResponse.json({ error: 'Missing waybill_id in payload.' }, { status: 400 });
      }
    } else if (body.event === 'order.status') {
      biteshipId = body.order_id;
      biteshipStatus = body.status || null;
      waybillId = body.waybill_id || null;
    } else {
      return NextResponse.json({ message: 'Event ignored.' }, { status: 200 });
    }

    if (!biteshipId) {
      return NextResponse.json({ error: 'Missing order_id.' }, { status: 400 });
    }

    const order = await findOrderByShipment(biteshipId);
    if (!order) {
      console.warn(`Biteship webhook: no order matches biteshipShipmentId=${biteshipId}. Acknowledging.`);
      return NextResponse.json({ message: 'Order not found.' }, { status: 200 });
    }

    await applyBiteshipUpdate({ order, biteshipStatus, waybillId, source: 'webhook' });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Biteship webhook error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
