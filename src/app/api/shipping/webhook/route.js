import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { applyBiteshipUpdate } from '@/lib/shipmentStatus';

// Real-time push path for Biteship shipment updates. The actual status
// transition logic lives in src/lib/shipmentStatus.js so it stays identical
// to the scheduled reconcile cron (src/app/api/shipping/reconcile) — this
// route only authenticates the request and unwraps the payload.

// Constant-time string comparison to prevent timing attacks.
function constantTimeMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Verifikasi autentikasi webhook Biteship.
// Di dashboard Biteship (Integrasi > Webhook):
// Pengguna mengonfigurasi "Headers Signature Key" dan "Headers Signature Secret".
// Biteship secara default menyematkan secret tersebut sebagai nilai header mentah (token match).
// Namun jika digunakan signature berbasis HMAC-SHA256, fungsi ini juga mendukung verifikasi HMAC.
function verifyBiteshipSignature(request, rawBody, secret) {
  if (!secret) return true;

  const headerVal =
    request.headers.get('biteship-signature') ||
    request.headers.get('x-biteship-signature') ||
    request.headers.get('x-signature-key') ||
    request.headers.get('x-api-key') ||
    request.headers.get('authorization') ||
    request.headers.get('signature');

  if (!headerVal) {
    return false;
  }

  const cleanedHeader = headerVal.replace(/^Bearer\s+/i, '').trim();

  // 1. Literal secret token comparison (Biteship dashboard standard)
  if (constantTimeMatch(cleanedHeader, secret.trim())) {
    return true;
  }

  // 2. HMAC-SHA256 Hex comparison (fallback jika gateway/vendor menghash body)
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (constantTimeMatch(cleanedHeader.toLowerCase(), expectedHex.toLowerCase())) {
    return true;
  }

  // 3. HMAC-SHA256 Base64 comparison
  const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (constantTimeMatch(cleanedHeader, expectedBase64)) {
    return true;
  }

  return false;
}

async function findOrderByShipment({ biteshipId, waybillId }) {
  const or = [];
  if (biteshipId) {
    or.push({ biteshipShipmentId: biteshipId });
    or.push({ id: biteshipId });
  }
  if (waybillId) {
    or.push({ trackingNumber: waybillId });
  }
  if (or.length === 0) return null;

  return prisma.order.findFirst({
    where: { OR: or },
    include: { items: { include: { product: true } } },
  });
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const trimmed = rawBody.trim();

    // Biteship (dan vendor webhook pada umumnya) mengirim request berbadan kosong
    // atau ping probe saat webhook pertama kali disimpan di dashboard.
    // Selalu terima probe ini dengan HTTP 200 OK agar verifikasi URL Biteship berhasil.
    if (!trimmed || trimmed === '{}') {
      console.log('Biteship webhook: install probe / empty body — acknowledging.');
      return NextResponse.json({ success: true, message: 'Probe acknowledged' }, { status: 200 });
    }

    const secret = process.env.BITESHIP_WEBHOOK_SECRET;

    if (secret && !verifyBiteshipSignature(request, rawBody, secret)) {
      console.error('Biteship webhook rejected: signature or token mismatch.');
      return NextResponse.json({ error: 'Signature mismatch.' }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Payload Biteship dapat berbentuk flat { event, order_id, status }
    // atau nested { event, data: { order_id, status, waybill_id } }
    const data = payload.data || payload.order || payload;
    const event = String(payload.event || data.event || '').toLowerCase();

    const biteshipId = data.order_id || data.id || payload.order_id || payload.id || null;
    const biteshipStatus = (data.status || payload.status || '').toLowerCase().trim() || null;
    const waybillId =
      data.waybill_id ||
      data.courier?.waybill_id ||
      data.courier?.tracking_id ||
      payload.waybill_id ||
      payload.courier?.waybill_id ||
      payload.courier?.tracking_id ||
      null;

    const isStatusEvent = event.includes('status') || biteshipStatus !== null;
    const isWaybillEvent = event.includes('waybill') || waybillId !== null;

    if (!isStatusEvent && !isWaybillEvent) {
      console.log(`Biteship webhook: unhandled event "${event}". Ignoring.`);
      return NextResponse.json({ message: 'Event ignored.' }, { status: 200 });
    }

    if (!biteshipId && !waybillId) {
      return NextResponse.json({ error: 'Missing order_id or waybill_id in payload.' }, { status: 400 });
    }

    const order = await findOrderByShipment({ biteshipId, waybillId });
    if (!order) {
      console.warn(`Biteship webhook: no order matches biteshipId=${biteshipId} or waybillId=${waybillId}. Acknowledging.`);
      return NextResponse.json({ message: 'Order not found in database.' }, { status: 200 });
    }

    const updateResult = await applyBiteshipUpdate({
      order,
      biteshipStatus,
      waybillId,
      source: 'webhook',
    });

    console.log(
      `Biteship webhook processed: Order #${order.id.slice(0, 8)} (${order.status} → ${updateResult.to}) | status=${biteshipStatus} waybill=${waybillId || 'none'}`
    );

    return NextResponse.json({ success: true, ...updateResult }, { status: 200 });
  } catch (error) {
    console.error('Biteship webhook error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
