import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

// Ordered rank so we can refuse backward state transitions from replayed
// or out-of-order Biteship events.
const STATUS_RANK = {
  PENDING: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  COMPLETED: 3,
  RETURNED: 98, // terminal — item was delivered and came back
  CANCELLED: 99, // terminal — never delivered
};

// Biteship status → our internal status.
// `returned` maps to its own RETURNED status (item was delivered then came
// back) — deliberately NOT lumped with CANCELLED, because the two paths need
// different stock handling: CANCELLED must restock, RETURNED must not
// auto-restock (usually dead fish; admin decides case by case).
function mapBiteshipStatus(bs) {
  switch (bs) {
    case 'picked':
    case 'dropping_off':
      return 'SHIPPED';
    case 'delivered':
      return 'COMPLETED';
    case 'cancelled':
    case 'rejected':
      return 'CANCELLED';
    case 'returned':
      return 'RETURNED';
    default:
      return null; // includes confirmed, allocated, picking_up, on_hold, etc.
  }
}

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

// Mirror image of the DOKU webhook's decrementStockForOrder — restores stock
// (and clears isSold) when a shipped order is cancelled by the courier.
async function restockOrder(tx, order) {
  for (const item of order.items) {
    const product = item.product;
    if (!product) continue;

    let updatedSizes;
    let newTotalQty;
    if (Array.isArray(product.sizes) && item.selectedSize) {
      updatedSizes = product.sizes.map((s) =>
        s.size === item.selectedSize
          ? { ...s, quantity: s.quantity + item.quantity }
          : s
      );
      newTotalQty = updatedSizes.reduce((sum, s) => sum + s.quantity, 0);
    } else {
      newTotalQty = product.quantity + item.quantity;
    }

    await tx.product.update({
      where: { id: product.id },
      data: {
        sizes: updatedSizes ?? undefined,
        quantity: newTotalQty,
        isSold: newTotalQty === 0,
      },
    });
  }
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
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

    if (body.event !== 'order.status' || !body.order_id) {
      return NextResponse.json({ message: 'Event ignored.' }, { status: 200 });
    }

    const { order_id: biteshipId, status: biteshipStatus, waybill_id: waybillId } = body;

    const order = await prisma.order.findFirst({
      where: { biteshipShipmentId: biteshipId },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      console.warn(`Biteship webhook: no order matches biteshipShipmentId=${biteshipId}. Acknowledging.`);
      return NextResponse.json({ message: 'Order not found.' }, { status: 200 });
    }

    const mapped = mapBiteshipStatus(biteshipStatus);

    // Statuses without a mapping (confirmed, allocated, picking_up, on_hold…):
    // record Biteship metadata but leave order.status alone.
    if (!mapped) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          biteshipStatus,
          ...(waybillId ? { trackingNumber: waybillId } : {}),
        },
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const currentRank = STATUS_RANK[order.status] ?? -1;
    const nextRank = STATUS_RANK[mapped] ?? -1;

    // Idempotency + guarded transitions per status semantic.
    if (mapped === 'CANCELLED') {
      // CANCELLED = never delivered. Refuse if order is already delivered or in
      // a terminal state — that would be a wrongful stock refund.
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'RETURNED') {
        console.log(`Biteship webhook: ignored ${biteshipStatus} for order ${order.id} (already ${order.status}).`);
        return NextResponse.json({ success: true }, { status: 200 });
      }
    } else if (mapped === 'RETURNED') {
      // RETURNED = delivered then came back. Only makes sense if the order
      // actually got out the door.
      if (order.status !== 'COMPLETED' && order.status !== 'SHIPPED') {
        console.log(`Biteship webhook: ignored 'returned' for order ${order.id} (status=${order.status}).`);
        return NextResponse.json({ success: true }, { status: 200 });
      }
    } else if (nextRank <= currentRank) {
      console.log(`Biteship webhook: ignored backward transition ${order.status} → ${mapped} for order ${order.id}.`);
      // Still persist Biteship-side metadata so tracking stays fresh.
      await prisma.order.update({
        where: { id: order.id },
        data: { biteshipStatus, ...(waybillId ? { trackingNumber: waybillId } : {}) },
      });
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (mapped === 'CANCELLED') {
      // Stock was decremented at DOKU SUCCESS — refund it before flipping status.
      await prisma.$transaction(async (tx) => {
        await restockOrder(tx, order);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            biteshipStatus,
            ...(waybillId ? { trackingNumber: waybillId } : {}),
          },
        });
      });
      console.log(`Biteship webhook: order ${order.id} cancelled by courier (${biteshipStatus}) — stock restored.`);
    } else if (mapped === 'RETURNED') {
      // No auto-restock — for live betta, a returned package usually means the
      // fish is dead. Admin reviews and manually restocks if applicable.
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'RETURNED',
          biteshipStatus,
          ...(waybillId ? { trackingNumber: waybillId } : {}),
        },
      });
      console.warn(`Biteship webhook: order ${order.id} RETURNED. Admin review required — no auto-restock.`);
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: mapped,
          biteshipStatus,
          ...(waybillId ? { trackingNumber: waybillId } : {}),
        },
      });
      console.log(`Biteship webhook: order ${order.id} ${order.status} → ${mapped} (biteship=${biteshipStatus}).`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Biteship webhook error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
