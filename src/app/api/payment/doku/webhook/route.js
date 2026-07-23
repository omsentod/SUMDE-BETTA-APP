import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { generateDigest, generateSignature } from '@/lib/doku';

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const headers = request.headers;

    const clientIdHeader = headers.get('client-id');
    const requestIdHeader = headers.get('request-id');
    const timestampHeader = headers.get('request-timestamp');
    const signatureHeader = headers.get('signature');

    const secretKey = process.env.DOKU_SECRET_KEY;
    const requestTarget = '/api/payment/doku/webhook';

    // Verify that we have all security headers
    if (!clientIdHeader || !requestIdHeader || !timestampHeader || !signatureHeader) {
      console.error('Missing Doku webhook authentication headers.');
      return NextResponse.json({ error: 'Missing security headers.' }, { status: 401 });
    }

    // Calculate expected Digest of raw body
    const calculatedDigest = generateDigest(rawBody);

    // Reconstruct and calculate expected Signature
    const calculatedSignature = generateSignature(
      clientIdHeader,
      requestIdHeader,
      timestampHeader,
      requestTarget,
      calculatedDigest,
      secretKey
    );

    // Verify signature authenticity
    if (signatureHeader !== calculatedSignature) {
      console.error('Doku webhook signature verification failed.');
      console.error('Expected Signature:', calculatedSignature);
      console.error('Received Signature:', signatureHeader);
      return NextResponse.json({ error: 'Signature mismatch.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const invoiceNumber = payload.order?.invoice_number;
    const paymentStatus = payload.payment?.status;

    if (!invoiceNumber || !paymentStatus) {
      return NextResponse.json({ error: 'Invalid webhook payload structure.' }, { status: 400 });
    }

    if (paymentStatus.toUpperCase() === 'SUCCESS') {
      // Find the order
      const order = await prisma.order.findUnique({
        where: { id: invoiceNumber }
      });

      if (!order) {
        return NextResponse.json({ error: 'Order matching invoice not found.' }, { status: 404 });
      }

      // Update to PROCESSING if currently PENDING
      if (order.status === 'PENDING') {
        await prisma.order.update({
          where: { id: invoiceNumber },
          data: { status: 'PROCESSING' }
        });
        console.log(`Doku Webhook: Order ${invoiceNumber} updated to PROCESSING.`);
      } else {
        console.log(`Doku Webhook: Order ${invoiceNumber} already has status: ${order.status}. Skipping.`);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error processing Doku webhook:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
