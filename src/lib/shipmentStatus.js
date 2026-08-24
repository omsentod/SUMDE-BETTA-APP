// Single source of truth for applying a Biteship-reported shipment status to
// an order. Consumed by BOTH the push webhook (src/app/api/shipping/webhook)
// and the scheduled reconciliation cron (src/app/api/shipping/reconcile).
//
// Keeping this here — rather than inline in the webhook — is what makes order
// status "berkesinambungan": the webhook is the real-time path, but if a
// webhook is ever missed (dashboard misconfig, downtime, network) the cron
// pulls the same status from Biteship and runs it through the exact same
// guarded transition, so an order can never get stuck out of sync forever.

import prisma from '@/lib/prisma';
import { createNotification, notifyAllAdmins } from '@/lib/notification';
import { sendMail, orderShippedEmailTemplate } from '@/lib/email';

// Ordered rank so we can refuse backward state transitions from replayed or
// out-of-order events (and from a cron that re-reads an already-final order).
export const STATUS_RANK = {
  PENDING: 0,
  PAID: 1,       // uang masuk, belum panggil kurir
  PROCESSING: 2, // resi sudah dipanggil, menunggu kurir ambil paket
  SHIPPED: 3,
  COMPLETED: 4,
  RETURNED: 98,  // terminal — delivered then came back
  CANCELLED: 99, // terminal — never delivered
};

// Biteship status → our internal status.
// `returned` maps to its own RETURNED status (delivered then came back) —
// deliberately NOT lumped with CANCELLED, because the two need different stock
// handling: CANCELLED must restock, RETURNED must not auto-restock (usually
// dead fish; admin decides case by case).
export function mapBiteshipStatus(bs) {
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
      return null; // confirmed, allocated, picking_up, on_hold, etc.
  }
}

// Restore stock (and clear isSold) when a shipped order is cancelled by the
// courier. Mirror image of the DOKU webhook's decrementStockForOrder.
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

// Fan out "pesanan dikirim" notifications (customer bell + email with AWB,
// admin bell). Best-effort — never throw; the status change already committed.
async function sendShippedNotifications(order, waybill) {
  try {
    if (order.userId) {
      await createNotification({
        userId: order.userId,
        type: 'order.shipped',
        title: 'Pesanan sudah dikirim',
        body: waybill
          ? `Order #${order.id.slice(0, 8)} — AWB ${waybill}`
          : `Order #${order.id.slice(0, 8)} sedang dalam perjalanan.`,
        link: '/customer/orders',
      });
    }
    await notifyAllAdmins({
      type: 'order.shipped',
      title: 'Pesanan dikirim',
      body: `Order #${order.id.slice(0, 8)}${waybill ? ` — ${waybill}` : ''}`,
      link: '/admin/orders?status=SHIPPED',
    });
    if (order.email) {
      const appUrl = process.env.APP_URL || 'https://sumdebetta.com';
      await sendMail({
        to: order.email,
        subject: `Pesanan Dikirim — Order #${order.id.slice(0, 8)}`,
        html: orderShippedEmailTemplate({
          name: order.name,
          orderId: order.id,
          courier: order.shippingCourier,
          waybill: waybill || order.trackingNumber || '-',
          orderUrl: `${appUrl}/customer/orders`,
        }),
      });
    }
  } catch (notifErr) {
    console.error('Order shipped notification fanout failed:', notifErr.message);
  }
}

/**
 * Apply a Biteship-reported status/waybill to an order, idempotently and with
 * guarded transitions. Safe to call repeatedly (webhook retries, cron) and
 * from either source.
 *
 * @param {object}   order          Order row WITH `items: { include: product }`.
 * @param {string?}  biteshipStatus Raw Biteship status (e.g. "picked"), or null.
 * @param {string?}  waybillId      AWB from Biteship, or null.
 * @param {string}   source         'webhook' | 'reconcile' — for logs only.
 * @returns {Promise<{changed: boolean, from: string, to: string}>}
 */
export async function applyBiteshipUpdate({ order, biteshipStatus, waybillId, source = 'webhook' }) {
  const mapped = mapBiteshipStatus(biteshipStatus);
  // Waybill numbers never change once issued — only ever FILL a missing one.
  const newWaybill = waybillId && !order.trackingNumber ? waybillId : null;

  const metaPatch = {
    ...(biteshipStatus ? { biteshipStatus } : {}),
    ...(newWaybill ? { trackingNumber: newWaybill } : {}),
  };

  const currentRank = STATUS_RANK[order.status] ?? -1;

  // --- Stock-affecting terminal states: cancel / return -------------------
  if (mapped === 'CANCELLED') {
    // CANCELLED = never delivered. Refuse if already delivered / terminal —
    // that would be a wrongful stock refund.
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'RETURNED') {
      if (Object.keys(metaPatch).length) {
        await prisma.order.update({ where: { id: order.id }, data: metaPatch });
      }
      return { changed: false, from: order.status, to: order.status };
    }
    // Stock was decremented at DOKU SUCCESS — refund it before flipping status.
    await prisma.$transaction(async (tx) => {
      await restockOrder(tx, order);
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', ...metaPatch },
      });
    });
    console.log(`Shipment(${source}): order ${order.id} cancelled by courier (${biteshipStatus}) — stock restored.`);
    return { changed: true, from: order.status, to: 'CANCELLED' };
  }

  if (mapped === 'RETURNED') {
    // RETURNED = delivered then came back. Only makes sense if it got out the
    // door. No auto-restock — a returned live betta is usually dead; admin
    // reviews and restocks manually if applicable.
    if (order.status !== 'COMPLETED' && order.status !== 'SHIPPED') {
      if (Object.keys(metaPatch).length) {
        await prisma.order.update({ where: { id: order.id }, data: metaPatch });
      }
      return { changed: false, from: order.status, to: order.status };
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'RETURNED', ...metaPatch },
    });
    console.warn(`Shipment(${source}): order ${order.id} RETURNED. Admin review required — no auto-restock.`);
    return { changed: true, from: order.status, to: 'RETURNED' };
  }

  // --- Forward progression: PROCESSING → SHIPPED → COMPLETED --------------
  // A newly-assigned waybill on a still-PROCESSING order also means the
  // package is out the door → treat as SHIPPED, matching the old behavior of
  // the `order.waybill_id` webhook event.
  let target = null;
  if (mapped === 'SHIPPED' || mapped === 'COMPLETED') target = mapped;
  if (newWaybill && order.status === 'PROCESSING') {
    if (!target || STATUS_RANK['SHIPPED'] > STATUS_RANK[target]) target = target === 'COMPLETED' ? 'COMPLETED' : 'SHIPPED';
  }

  // No forward movement (confirmed/allocated/picking_up, or already ahead):
  // just keep Biteship-side metadata fresh.
  if (!target || (STATUS_RANK[target] ?? -1) <= currentRank) {
    if (Object.keys(metaPatch).length) {
      await prisma.order.update({ where: { id: order.id }, data: metaPatch });
    }
    return { changed: false, from: order.status, to: order.status };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: target, ...metaPatch },
  });
  console.log(`Shipment(${source}): order ${order.id} ${order.status} → ${target} (biteship=${biteshipStatus || 'waybill'}).`);

  // Fire the shipped notification exactly once, when the order first crosses
  // into SHIPPED (from anything below it).
  if (STATUS_RANK[target] >= STATUS_RANK['SHIPPED'] && currentRank < STATUS_RANK['SHIPPED']) {
    await sendShippedNotifications(order, newWaybill || order.trackingNumber);
  }

  return { changed: true, from: order.status, to: target };
}
