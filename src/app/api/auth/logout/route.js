import { NextResponse } from 'next/server';
import { SESSION_COOKIE, clearedCookieOptions } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', clearedCookieOptions());
  return res;
}
