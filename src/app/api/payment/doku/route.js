import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCheckoutSession } from '@/lib/doku';

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

    // Request Checkout Session from Doku Sandbox
    const dokuResponse = await createCheckoutSession({
      invoiceNumber: order.id,
      amount: order.total,
      callbackUrl
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
