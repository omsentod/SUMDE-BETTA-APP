import { NextResponse } from 'next/server';
import { fetchRates } from '@/lib/shipping';
import { consume, clientIp } from '@/lib/rateLimit';

// Public endpoint — the checkout page hits it to get live courier quotes
// once the buyer has filled in a destination postal code. Rate-limited so
// scrapers can't burn our Biteship API quota.
export async function POST(request) {
  try {
    const ip = clientIp(request);
    const rl = consume(`rates:${ip}`, { limit: 30, windowMs: 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan ongkir. Coba lagi sebentar.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const { destinationPostal, destinationCity, items } = await request.json();
    const rates = await fetchRates({ destinationPostal, destinationCity, items });
    return NextResponse.json({ rates });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
