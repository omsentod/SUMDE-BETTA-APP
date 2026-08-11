import { NextResponse } from 'next/server';
import { getTrackingDetails } from '@/lib/shipping';

export async function GET(request) {
  try {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
