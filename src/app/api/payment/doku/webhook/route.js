import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateDigest, generateSignature } from '@/lib/doku';

const requestTarget = '/api/payment/doku/webhook';

// DOKU payment statuses grouped by how we react (P2-a).
const SUCCESS_STATUSES = ['SUCCESS'];
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'VOID', 'CANCELLED'];

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
    const rawStatus = payload.payment?.status;

    if (!invoiceNumber || !rawStatus) {
      return NextResponse.json({ error: 'Invalid webhook payload structure.' }, { status: 400 });
    }
    const paymentStatus = rawStatus.toUpperCase();

    const order = await prisma.order.findUnique({
      where: { id: invoiceNumber },
      include: { items: { include: { product: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order matching invoice not found.' }, { status: 404 });
    }

    // Idempotency: only act while the order is still PENDING. Any later webhook
    // for an already-finalized order is acknowledged (200) but not re-processed,
    // so stock is never decremented twice.
    if (order.status !== 'PENDING') {
      console.log(`Doku Webhook: Order ${invoiceNumber} already ${order.status}. Skipping (DOKU status=${paymentStatus}).`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (SUCCESS_STATUSES.includes(paymentStatus)) {
      // Payment confirmed → mark PROCESSING and decrement stock atomically (P2-b).
      await prisma.$transaction(async (tx) => {
        await decrementStockForOrder(tx, order);
        await tx.order.update({ where: { id: invoiceNumber }, data: { status: 'PROCESSING' } });
      });
      console.log(`Doku Webhook: Order ${invoiceNumber} paid → PROCESSING, stock updated.`);
    } else if (FAILED_STATUSES.includes(paymentStatus)) {
      // Failed / expired / cancelled → cancel the order. No stock was decremented
      // at creation, so there is nothing to restore.
      await prisma.order.update({ where: { id: invoiceNumber }, data: { status: 'CANCELLED' } });
      console.log(`Doku Webhook: Order ${invoiceNumber} ${paymentStatus} → CANCELLED.`);
    } else if (paymentStatus === 'PENDING') {
      // DOKU still awaiting payment — leave the order as-is.
      console.log(`Doku Webhook: Order ${invoiceNumber} still PENDING at DOKU. No-op.`);
    } else {
      // Unknown status (e.g. REFUNDED after capture) — do not guess; log for review.
      console.warn(`Doku Webhook: Unhandled DOKU status "${paymentStatus}" for order ${invoiceNumber}. No change applied.`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing Doku webhook:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
