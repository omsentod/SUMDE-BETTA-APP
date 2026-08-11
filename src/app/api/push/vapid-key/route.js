import { NextResponse } from 'next/server';

// GET /api/push/vapid-key
// Client butuh public key untuk subscribe. Public key aman di-expose.
// (Private key TIDAK PERNAH dikirim ke client.)
export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  return NextResponse.json({ publicKey });
}
