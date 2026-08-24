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
    // pre-picker) or the channel is flagged inactive on this merchant account,
    // leave the filter off so DOKU shows the full catalog instead of rejecting
    // the whole session with "PAYMENT CHANNEL IS INACTIVE".
    const method = order.paymentMethod ? PAYMENT_METHODS[order.paymentMethod] : null;
    const paymentMethodTypes = method?.dokuType && !method.inactive ? [method.dokuType] : undefined;

    // Request Checkout Session from Doku Sandbox
    // Append timestamp to avoid 'INVOICE ALREADY USED' if retrying payment
    const dokuInvoiceNumber = `${order.id}_${Date.now()}`;
    // DOKU require customer.id — pakai userId (kalau login) atau order.id
    // sebagai fallback untuk guest checkout.
    //
    // address/city/state/postcode diambil dari alamat pengiriman order —
    // channel Paylater (Akulaku) menolak sesi tanpa field ini.
    const addressLine = [
      order.streetAddress,
      order.rtRw && `RT/RW ${order.rtRw}`,
      order.village,
      order.district,
    ]
      .filter(Boolean)
      .join(', ');

    const customer = {
      id: order.userId || order.id,
      name: order.name,
      email: order.email,
      phone: order.phone,
      address: addressLine,
      city: order.city,
      state: order.province,
      postcode: order.postalCode,
    };
    let dokuResponse;
    try {
      dokuResponse = await createCheckoutSession({
        invoiceNumber: dokuInvoiceNumber,
        amount: order.total,
        callbackUrl,
        paymentMethodTypes,
        customer,
      });
    } catch (err) {
      // Safety net kalau registry drift dari dashboard DOKU (channel dimatikan
      // tanpa update kode). Ulangi sekali tanpa filter supaya user tetap bisa
      // membayar lewat katalog penuh, bukan buntu di layar error.
      const channelDown = /PAYMENT CHANNEL IS INACTIVE/i.test(err.message || '');
      if (!channelDown || !paymentMethodTypes) throw err;

      console.warn(
        `Doku: channel ${method?.dokuType} inactive for order ${order.id}. Retrying with full catalog.`
      );
      dokuResponse = await createCheckoutSession({
        invoiceNumber: `${order.id}_${Date.now()}`,
        amount: order.total,
        callbackUrl,
        customer,
      });
    }

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
