import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sweepExpiredPendingOrders } from '@/lib/orderExpiry';

// GET/POST /api/cron/orders/auto-cancel
// Cron endpoint untuk membatalkan otomatis semua pesanan PENDING yang telah melebihi batas waktu 24 jam.
// Aman dipanggil berkala via Hostinger Cron / external scheduler.
export async function GET(request) {
  try {
    const count = await sweepExpiredPendingOrders(prisma);
    return NextResponse.json({
      success: true,
      sweptOrdersCount: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto-cancel cron failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
