import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Edge-runtime guard for /admin/*. Runs BEFORE the page mounts, so a non-admin
// never sees a flash of the dashboard shell (which the client-side check in
// admin/dashboard/page.js does allow). All admin APIs are already covered by
// requireAdmin — this is defense in depth for the UI surface.

const SESSION_COOKIE = 'sumde-session';

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not configured.');
  return new TextEncoder().encode(s);
}

async function readSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const session = await readSession(request);
  if (!session) {
    const base = process.env.APP_URL || request.url;
    const loginUrl = new URL('/login', base);
    // Preserve where they tried to go so the login page can bounce them back.
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Pelanggan reguler (customer) dilarang mengakses panel /admin/*
  if (session.role === 'customer') {
    const base = process.env.APP_URL || request.url;
    return NextResponse.redirect(new URL('/customer/dashboard', base));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
