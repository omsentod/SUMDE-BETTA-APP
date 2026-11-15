import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendPackingBaggingAlertTelegram } from '@/lib/telegram';
import { getSession } from '@/lib/auth';

/**
 * Endpoint Cron Notifikasi Antrean Bungkus Ikan Packing Gudang
 * Dipanggil otomatis oleh Scheduler (misal Hostinger Cron) atau manual oleh admin.
 *
 * Mengambil seluruh pesanan yang resinya sudah dicetak (status: 'PROCESSING')
 * dan belum dibungkus (packingStatus: 'PENDING'), lalu mengirimkan rekap ringkas
 * beserta lampiran file PDF Lembar Manifest Bungkus Ikan ke Bot Telegram.
 *
 * Query Params / Headers:
 * - key: secret key yang cocok dengan RECONCILE_SECRET atau CRON_SECRET di .env
 * - force: 1 (opsional, untuk tes kirim)
 * - targets: comma-separated chat IDs (opsional)
 */

async function isAuthorized(request) {
  const expected = process.env.RECONCILE_SECRET || process.env.CRON_SECRET;
  const url = new URL(request.url);
  const provided =
    request.headers.get('x-cron-key') ||
    request.headers.get('x-reconcile-key') ||
    url.searchParams.get('key') ||
    '';

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
    const force =
      searchParams.get('force') === '1' ||
      searchParams.get('force') === 'true' ||
      searchParams.get('test') === '1';

    const targetsParam = searchParams.get('targets');
    const customTargets = targetsParam
      ? targetsParam.split(',').map((t) => t.trim()).filter(Boolean)
      : null;

    // Cari pesanan yang sudah dicetak resinya (PROCESSING) dan masih menunggu dibungkus (PENDING)
    const pendingOrders = await prisma.order.findMany({
      where: {
        status: 'PROCESSING',
        packingStatus: 'PENDING',
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (pendingOrders.length === 0 && !force) {
      return NextResponse.json({
        success: true,
        sent: false,
        count: 0,
        reason: 'Tidak ada antrean pesanan yang menunggu dibungkus plastik (senyap total). Gunakan ?force=1 untuk tes kirim.',
      });
    }

    let targetIds = pendingOrders.map((o) => o.id);

    // Jika force=1 dan sedang tidak ada pesanan PROCESSING, ambil 1 pesanan terakhir untuk tes preview PDF
    if (targetIds.length === 0 && force) {
      const anyOrder = await prisma.order.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (anyOrder) targetIds = [anyOrder.id];
    }

    if (targetIds.length === 0) {
      return NextResponse.json({
        success: true,
        sent: false,
        count: 0,
        reason: 'Database kosong, tidak ada pesanan untuk dijadikan sampel lembar manifest.',
      });
    }

    const result = await sendPackingBaggingAlertTelegram(targetIds, customTargets);

    return NextResponse.json({
      success: true,
      count: targetIds.length,
      result,
    });
  } catch (error) {
    console.error('Error GET /api/cron/bagging-digest:', error.message);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses notifikasi antrean bungkus ikan.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
