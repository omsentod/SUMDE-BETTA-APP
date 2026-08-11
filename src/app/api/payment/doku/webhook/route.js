import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateDigest, generateSignature } from '@/lib/doku';
import { createNotification, notifyAllAdmins } from '@/lib/notification';
import { sendMail, orderPaidEmailTemplate } from '@/lib/email';

const requestTarget = '/api/payment/doku/webhook';

// DOKU payment statuses grouped by how we react (P2-a).
const SUCCESS_STATUSES = ['SUCCESS'];
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'VOID', 'CANCELLED'];

// Reject webhooks whose timestamp header is further than this from server clock.
// DOKU normally delivers within seconds; anything older is either replay or a
// broken retry. Keep generous to survive minor clock drift.
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// Constant-time signature comparison (P2-d).
function signaturesMatch(received, expected) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Decrement stock for a paid order, respecting selectedSize when present (P2-b).
// Runs inside a transaction. Stock is only touched here (on payment), never at
// order creation, so abandoned PENDING orders no longer consume stock.
async function decrementStockForOrder(tx, order) {
  for (const item of order.items) {
    const product = item.product;
    if (!product) continue;

    let updatedSizes;
    let newTotalQty;
    if (Array.isArray(product.sizes) && item.selectedSize) {
      updatedSizes = product.sizes.map((s) =>
        s.size === item.selectedSize
          ? { ...s, quantity: Math.max(0, s.quantity - item.quantity) }
          : s
      );
      newTotalQty = updatedSizes.reduce((sum, s) => sum + s.quantity, 0);
    } else {
      newTotalQty = Math.max(0, product.quantity - item.quantity);
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
    const headers = request.headers;

    const clientIdHeader = headers.get('client-id');
    const requestIdHeader = headers.get('request-id');
    const timestampHeader = headers.get('request-timestamp');
    const signatureHeader = headers.get('signature');

    const secretKey = process.env.DOKU_SECRET_KEY;

    // Verify that we have all security headers
    if (!clientIdHeader || !requestIdHeader || !timestampHeader || !signatureHeader) {
      console.error('Missing Doku webhook authentication headers.');
      return NextResponse.json({ error: 'Missing security headers.' }, { status: 401 });
    }

    // Reject stale / replayed webhooks. The timestamp is inside the signature
    // envelope, so it can't be tampered with without breaking signature verification,
    // but an attacker replaying an old signed request would still be caught here.
    const timestampMs = Date.parse(timestampHeader);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_SKEW_MS) {
      console.error(`Doku webhook timestamp rejected (header=${timestampHeader}).`);
      return NextResponse.json({ error: 'Timestamp out of range.' }, { status: 401 });
    }

    // Calculate expected Digest of raw body, then reconstruct the expected Signature
    const calculatedDigest = generateDigest(rawBody);
    const calculatedSignature = generateSignature(
      clientIdHeader,
      requestIdHeader,
      timestampHeader,
      requestTarget,
      calculatedDigest,
      secretKey
    );

    // Verify signature authenticity — constant-time, and never log the values (P2-d).
    if (!signaturesMatch(signatureHeader, calculatedSignature)) {
      console.error('Doku webhook signature verification failed.');
      return NextResponse.json({ error: 'Signature mismatch.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const invoiceNumber = payload.order?.invoice_number;
    // Extract actual order ID (strip off the timestamp suffix if present)
    const actualOrderId = invoiceNumber ? invoiceNumber.split('_')[0] : null;
    const rawStatus = payload.payment?.status;

    if (!actualOrderId || !rawStatus) {
      return NextResponse.json({ error: 'Invalid webhook payload structure.' }, { status: 400 });
    }
    const paymentStatus = rawStatus.toUpperCase();

    const order = await prisma.order.findUnique({
      where: { id: actualOrderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order matching invoice not found.' }, { status: 404 });
    }

    // Idempotency: only act while the order is still PENDING. Any later webhook
    // for an already-finalized order is acknowledged (200) but not re-processed,
    // so stock is never decremented twice.
    if (order.status !== 'PENDING') {
      console.log(`Doku Webhook: Order ${actualOrderId} already ${order.status}. Skipping (DOKU status=${paymentStatus}).`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (SUCCESS_STATUSES.includes(paymentStatus)) {
      // Defense-in-depth: refuse to mark the order paid unless DOKU's reported
      // amount matches what we stored server-side. Guards against any path
      // where the price sent to DOKU could drift from what we charge.
      const paidAmount = Number(payload.order?.amount);
      const expectedAmount = Math.round(order.total);
      if (!Number.isFinite(paidAmount) || paidAmount !== expectedAmount) {
        console.error(
          `Doku Webhook: amount mismatch for order ${actualOrderId} — ` +
          `expected ${expectedAmount}, got ${paidAmount}. Leaving PENDING for human review.`
        );
        return NextResponse.json({ error: 'Amount mismatch.' }, { status: 400 });
      }

      // Payment confirmed → mark PROCESSING and decrement stock atomically (P2-b).
      await prisma.$transaction(async (tx) => {
        await decrementStockForOrder(tx, order);
        await tx.order.update({ where: { id: actualOrderId }, data: { status: 'PROCESSING' } });
      });
      console.log(`Doku Webhook: Order ${actualOrderId} paid → PROCESSING, stock updated.`);

      // Notif: customer (bell + email) + admin (bell). Best-effort — jangan
      // gagalkan webhook kalau notif error, order sudah paid di DB.
      try {
        if (order.userId) {
          await createNotification({
            userId: order.userId,
            type: 'order.paid',
            title: 'Pembayaran diterima',
            body: `Pesanan #${order.id.slice(0, 8)} sedang kami siapkan untuk pengiriman.`,
            link: '/customer/orders',
          });
        }
        await notifyAllAdmins({
          type: 'order.paid',
          title: 'Order dibayar',
          body: `Order #${order.id.slice(0, 8)} lunas — perlu dikirim.`,
          link: '/admin/orders?status=PROCESSING',
        });
        if (order.email) {
          const appUrl = process.env.APP_URL || 'https://sumdebetta.com';
          await sendMail({
            to: order.email,
            subject: `Pembayaran Diterima — Order #${order.id.slice(0, 8)}`,
            html: orderPaidEmailTemplate({
              name: order.name,
              orderId: order.id,
              total: order.total,
              orderUrl: `${appUrl}/customer/orders`,
            }),
          });
        }
      } catch (notifErr) {
        console.error('Order paid notification fanout failed:', notifErr.message);
      }
    } else if (FAILED_STATUSES.includes(paymentStatus)) {
      // Failed / expired / cancelled → cancel the order. No stock was decremented
      // at creation, so there is nothing to restore.
      await prisma.order.update({ where: { id: actualOrderId }, data: { status: 'CANCELLED' } });
      console.log(`Doku Webhook: Order ${actualOrderId} ${paymentStatus} → CANCELLED.`);
    } else if (paymentStatus === 'PENDING') {
      // DOKU still awaiting payment — leave the order as-is.
      console.log(`Doku Webhook: Order ${actualOrderId} still PENDING at DOKU. No-op.`);
    } else {
      // Unknown status (e.g. REFUNDED after capture) — do not guess; log for review.
      console.warn(`Doku Webhook: Unhandled DOKU status "${paymentStatus}" for order ${actualOrderId}. No change applied.`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing Doku webhook:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
