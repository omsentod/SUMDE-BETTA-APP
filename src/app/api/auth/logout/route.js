import { NextResponse } from 'next/server';
import { SESSION_COOKIE, clearedCookieOptions, getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { computeChatStatus } from '@/lib/chatStatus';
import { publishChatStatus } from '@/lib/ably';

export async function POST(request) {
  try {
    const session = await getSession(request);

    // Jika admin melakukan logout, tandai aktivitas admin segera selesai
    if (session?.role === 'admin') {
      const updated = await prisma.chatSetting.updateMany({
        where: { id: 'default' },
        data: {
          adminLastActiveAt: new Date(0), // Set ke epoch agar langsung expired
        },
      });

      if (updated.count > 0) {
        const setting = await prisma.chatSetting.findUnique({ where: { id: 'default' } });
        const statusData = computeChatStatus(setting);
        publishChatStatus(statusData).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Error saat logout admin presence cleanup:', err.message);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', clearedCookieOptions());
  return res;
}
