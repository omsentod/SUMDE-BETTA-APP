import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function isAuthorized(request) {
  const expected = process.env.RECONCILE_SECRET || process.env.CRON_SECRET;
  const url = new URL(request.url);
  const provided = request.headers.get('x-cron-key') || request.headers.get('x-reconcile-key') || url.searchParams.get('key') || '';

  if (expected && provided) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }

  try {
    const session = await getSession(request);
    if (session && session.role === 'admin') {
      return true;
    }
  } catch {
    // fallback
  }

  return false;
}

/**
 * GET/POST /api/cron/notifications/cleanup
 * Cron job berkala (Opsi B) untuk membersihkan notifikasi yang sudah dibaca > 24 jam.
 * Sekaligus menjaga database tetap ramping dengan membersihkan notifikasi usang > 60 hari.
 */
export async function GET(request) {
  try {
    const authorized = await isAuthorized(request);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Kunci otentikasi cron atau sesi admin tidak valid.' },
        { status: 401 }
      );
    }

    // 1. Bersihkan notifikasi yang SUDAH DIBACA lebih dari 24 jam lalu
    const readCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const prunedRead = await prisma.notification.deleteMany({
      where: {
        readAt: {
          not: null,
          lt: readCutoff,
        },
      },
    });

    // 2. Pemeliharaan jangka panjang: bersihkan notifikasi usang > 60 hari (bahkan jika belum dibaca)
    const retentionCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const prunedExpired = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: retentionCutoff,
        },
      },
    });

    return NextResponse.json({
      success: true,
      prunedReadCount: prunedRead.count,
      prunedExpiredCount: prunedExpired.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Notification cleanup cron failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
