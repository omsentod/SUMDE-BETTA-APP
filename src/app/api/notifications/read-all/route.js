import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

// POST /api/notifications/read-all — mark all (or specific batch) unread as read (per user).
export async function POST(request) {
  try {
    const session = await requireUser(request);

    let ids = null;
    try {
      const body = await request.json();
      if (Array.isArray(body?.ids) && body.ids.length > 0) {
        ids = body.ids.filter((id) => typeof id === 'string');
      }
    } catch {
      // Body may be empty when marking all
    }

    const where = {
      userId: session.id,
      readAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    };

    const result = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
