import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createTokenRequest, isEnabled } from '@/lib/ably';

// GET /api/ably/auth
// Endpoint yang di-poll Ably library untuk dapat token JWT-like.
// Return HARUS raw token request object (Ably library parse langsung).
// Token cuma allow subscribe ke channel `user:<userId>`.
export async function GET(request) {
  try {
    if (!isEnabled()) {
      return NextResponse.json({ error: 'Ably not configured.' }, { status: 503 });
    }
    const session = await requireUser(request);
    const tokenRequest = await createTokenRequest(session.id);
    return NextResponse.json(tokenRequest);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
