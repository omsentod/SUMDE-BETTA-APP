import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendAdminPackingDigestTelegram } from '@/lib/telegram';
import { getSession } from '@/lib/auth';

/**
 * Endpoint Cron Notifikasi Rekap Jam Packing Toko
 * Dipanggil otomatis oleh Scheduler (misal Hostinger Cron pada 10:00 & 15:00 WIB)
 * Atau dipanggil manual oleh Admin dari Dashboard/Postman.
 *
 * Query Params / Headers:
 * - key: secret key yang cocok dengan RECONCILE_SECRET atau CRON_SECRET di .env
 * - kloter: string label kloter opsional (contoh: "Kloter 10.00" atau "Kloter 15.00")
 * - targets: comma-separated chat IDs (opsional jika ingin override default targets)
 */

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

export async function GET(request) {
  try {
    const authorized = await isAuthorized(request);
    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Kunci otentikasi cron atau sesi admin tidak valid.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true' || searchParams.get('test') === '1';
    const targetsParam = searchParams.get('targets');
    const customTargets = targetsParam
      ? targetsParam.split(',').map((t) => t.trim()).filter(Boolean)
      : null;

    const result = await sendAdminPackingDigestTelegram('', customTargets, { force });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error GET /api/cron/packing-digest:', error.message);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses rekap notifikasi packing.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  // Dukung juga pemanggilan via POST
  return GET(request);
}

