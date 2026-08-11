import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// POST /api/push/subscribe
// Body: { endpoint, keys: { p256dh, auth } } — dari PushSubscription.toJSON()
// Simpan per user + endpoint (unique). Upsert supaya subscribe ulang aman.
export async function POST(request) {
  try {
    const session = await requireUser(request);
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Payload subscribe tidak lengkap.' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: session.id, p256dh, auth },
      create: { userId: session.id, endpoint, p256dh, auth },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

// DELETE /api/push/subscribe — hapus subscription (opt-out).
// Butuh endpoint di body juga karena user bisa punya multiple browser.
export async function DELETE(request) {
  try {
    const session = await requireUser(request);
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint wajib.' }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
