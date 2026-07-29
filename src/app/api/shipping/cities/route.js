import { NextResponse } from 'next/server';
import { searchCities } from '@/lib/shipping';
import { requireAdmin } from '@/lib/auth';

// Admin-only search across Komerce's destination database. Used ONCE during
// setup to find the merchant's own SHIPPING_ORIGIN_CITY_ID.
//
// Usage: GET /api/shipping/cities?q=tulungagung
//   Returns { count, cities: [{ id, label, subdistrict_name, district_name,
//     city_name, province_name, zip_code }, ...] }
//
// Pick the one where city_name + zip_code matches your merchant address, then
// put its `id` into SHIPPING_ORIGIN_CITY_ID in .env.
export async function GET(request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json(
        { error: 'Parameter ?q= wajib diisi. Contoh: /api/shipping/cities?q=tulungagung' },
        { status: 400 }
      );
    }
    const cities = await searchCities(q, { limit: 25 });
    return NextResponse.json({ count: cities.length, cities });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
