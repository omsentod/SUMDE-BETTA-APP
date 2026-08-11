import { NextResponse } from 'next/server';
import { isEnabled } from '@/lib/ably';

// GET /api/ably/status
// Ringan — client bell pakai untuk cek apakah worth setup Ably connection.
// Kalau enabled=false, client silent fallback ke polling.
export async function GET() {
  return NextResponse.json({ enabled: isEnabled() });
}
