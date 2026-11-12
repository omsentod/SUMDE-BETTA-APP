import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Edge-runtime guard for /admin/* and /customer/*. Runs BEFORE the page mounts, so an
// unauthenticated user never sees a flash of protected page shells or skeletons.
// All APIs are already covered by requireAdmin / requireUser — this is defense in depth
// for the UI surface.

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
  const base = process.env.APP_URL || request.url;
  const { pathname } = request.nextUrl;

  // 1. Guard /admin/*: Wajib login & role admin
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', base);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Pelanggan reguler (customer) dilarang mengakses panel /admin/*
    if (session.role === 'customer') {
      return NextResponse.redirect(new URL('/customer/dashboard', base));
    }
  }

  // 2. Guard /customer/*: Wajib login
  if (pathname.startsWith('/customer')) {
    if (!session) {
      const loginUrl = new URL('/login', base);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Reverse Guard /login & /register: Jika sudah login, langsung lempar ke dashboard
  if (pathname === '/login' || pathname === '/register') {
    if (session) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const safeNext = nextParam && /^\/[a-zA-Z0-9/\-_?=&]*$/.test(nextParam) ? nextParam : null;
      const defaultDest = session.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard';
      return NextResponse.redirect(new URL(safeNext || defaultDest, base));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/customer/:path*', '/login', '/register'],
};
