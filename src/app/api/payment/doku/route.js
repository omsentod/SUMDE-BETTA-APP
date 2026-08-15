import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCheckoutSession } from '@/lib/doku';
import { PAYMENT_METHODS } from '@/lib/paymentFee';

export async function POST(request) {
  try {
    const { orderId, callbackUrl } = await request.json();

    if (!orderId || !callbackUrl) {
      return NextResponse.json({ error: 'Order ID dan Callback URL wajib diisi.' }, { status: 400 });
    }

    // Retrieve order details from database
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    // Restrict DOKU hosted page to the specific channel the customer picked
    // when creating the order. If paymentMethod is missing (legacy orders
    // pre-picker), leave the filter off so DOKU shows the full catalog.
    const method = order.paymentMethod ? PAYMENT_METHODS[order.paymentMethod] : null;
    const paymentMethodTypes = method?.dokuType ? [method.dokuType] : undefined;

    // Request Checkout Session from Doku Sandbox
    // Append timestamp to avoid 'INVOICE ALREADY USED' if retrying payment
    const dokuInvoiceNumber = `${order.id}_${Date.now()}`;
    const dokuResponse = await createCheckoutSession({
      invoiceNumber: dokuInvoiceNumber,
      amount: order.total,
      callbackUrl,
      paymentMethodTypes,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: dokuResponse.response.payment.url,
      amount: order.total,
      orderId: order.id
    });
  } catch (error) {
    console.error('Error generating Doku Checkout URL:', error);
    return NextResponse.json({ error: error.message || 'Gagal membuat sesi pembayaran.' }, { status: 500 });
  }
}
