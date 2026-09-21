import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTrackingDetails } from '@/lib/shipping';
import { applyBiteshipUpdate } from '@/lib/shipmentStatus';
import { consume, clientIp } from '@/lib/rateLimit';

const RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 }; // 30 track lookups / min / IP

export async function GET(request) {
  try {
    const gate = consume(`track:${clientIp(request)}`, RATE_LIMIT);
    if (!gate.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan pelacakan. Coba lagi sebentar.' },
        { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const waybill = searchParams.get('waybill');
    const courier = searchParams.get('courier');

    if (!waybill || !courier) {
      return NextResponse.json({ error: 'Missing waybill or courier' }, { status: 400 });
    }

    const data = await getTrackingDetails(waybill, courier);

    // Opportunistic self-healing sync: jika Biteship mengembalikan status,
    // sinkronkan status Order di database agar badge pesanan tidak tertinggal di PROCESSING/SHIPPED
    if (data && data.status) {
      prisma.order.findFirst({
        where: { trackingNumber: waybill },
        include: { items: { include: { product: true } } },
      }).then((order) => {
        if (order && (order.status === 'PROCESSING' || order.status === 'SHIPPED')) {
          applyBiteshipUpdate({
            order,
            biteshipStatus: data.status,
            waybillId: waybill,
            source: 'track-sync',
          }).catch((err) => console.error('Opportunistic track sync failed:', err.message));
        }
      }).catch((err) => console.error('Find order for track sync failed:', err.message));
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
