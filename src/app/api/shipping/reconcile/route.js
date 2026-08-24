import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getBiteshipOrder } from '@/lib/shipping';
import { applyBiteshipUpdate } from '@/lib/shipmentStatus';

// Scheduled reconciliation for shipment status. A Hostinger cron hits this
// endpoint every few minutes; for every order that is still mid-shipment it
// re-reads the authoritative status from Biteship and applies the SAME
// transition the webhook would (via applyBiteshipUpdate). This is the safety
// net that keeps order status "berkesinambungan" even when a Biteship webhook
// never arrives (dashboard misconfig, downtime, network).
//
// Protect with a shared secret so only the cron (and admins) can trigger it.
// Accepts the secret via `x-reconcile-key` header or `?key=` query param.

// Non-terminal shipment states worth polling. PENDING/PAID have no shipment
// yet; COMPLETED/CANCELLED/RETURNED are terminal.
const RECONCILABLE_STATUSES = ['PROCESSING', 'SHIPPED'];

// How many orders to reconcile per run — bounds Biteship calls per cron tick.
const BATCH_LIMIT = 50;

function secretOk(request) {
  const expected = process.env.RECONCILE_SECRET;
  if (!expected) return false;
  const url = new URL(request.url);
  const provided = request.headers.get('x-reconcile-key') || url.searchParams.get('key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

async function runReconcile() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: RECONCILABLE_STATUSES },
      biteshipShipmentId: { not: null },
    },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_LIMIT,
  });

  const results = { checked: orders.length, changed: 0, errors: 0, transitions: [] };

  for (const order of orders) {
    try {
      const detail = await getBiteshipOrder(order.biteshipShipmentId);
      const biteshipStatus = detail.status || null;
      const waybillId = detail.courier?.waybill_id || detail.waybill_id || null;

      const res = await applyBiteshipUpdate({ order, biteshipStatus, waybillId, source: 'reconcile' });
      if (res.changed) {
        results.changed += 1;
        results.transitions.push({ orderId: order.id, from: res.from, to: res.to });
      }
    } catch (err) {
      results.errors += 1;
      console.error(`Reconcile failed for order ${order.id}:`, err.message);
    }
  }

  return results;
}

export async function POST(request) {
  if (!secretOk(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const results = await runReconcile();
  return NextResponse.json({ success: true, ...results });
}

// GET is allowed too so a plain `curl` cron (no method flag) works.
export async function GET(request) {
  return POST(request);
}
