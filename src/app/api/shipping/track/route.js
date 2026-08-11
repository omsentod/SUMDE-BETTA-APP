import { NextResponse } from 'next/server';
import { getTrackingDetails } from '@/lib/shipping';
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
    return NextResponse.json(data);
  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
