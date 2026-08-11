import { NextResponse } from 'next/server';
import {
  buildAuthUrl,
  generateState,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from '@/lib/googleAuth';

// GET /api/auth/google?next=/customer/dashboard
// Initiate flow: generate state, save di cookie httpOnly, redirect ke Google consent.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawNext = searchParams.get('next') || '/customer/dashboard';
    // Whitelist next path — mencegah open redirect. Cuma internal path (/xxx)
    // yang diperbolehkan, tidak boleh URL external.
    const next = /^\/[a-zA-Z0-9/\-_?=&]*$/.test(rawNext) ? rawNext : '/customer/dashboard';

    const state = generateState();
    const authUrl = buildAuthUrl({ state, redirectAfter: next });

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
