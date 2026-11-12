import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeChatStatus } from '@/lib/chatStatus';
import { publishChatStatus } from '@/lib/ably';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await getSession(request);

    if (!session?.id || session.role !== 'admin') {
      return NextResponse.json(
        { active: false, error: 'Sesi admin tidak ditemukan atau telah kedaluwarsa.' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Catat detak jantung (heartbeat) aktivitas admin
    const updated = await prisma.chatSetting.upsert({
      where: { id: 'default' },
      update: {
        adminLastActiveAt: now,
      },
      create: {
        id: 'default',
        adminStatus: 'AUTO',
        operatingHoursStart: '08:00',
        operatingHoursEnd: '21:00',
        offlineMessage:
          'Halo! Admin saat ini sedang beristirahat/di farm. Pesanmu sudah tersimpan aman dan akan kami balas segera setelah operasional kembali buka. Terima kasih!',
        emergencyWaNumber: '6281234567890',
        adminLastActiveAt: now,
      },
    });

    const statusData = computeChatStatus(updated);

    // Broadcast ke seluruh client (Customer & Admin) via Ably Realtime
    publishChatStatus(statusData).catch(() => {});

    return NextResponse.json({
      success: true,
      active: true,
      ...statusData,
    });
  } catch (error) {
    console.error('Error saat POST chat heartbeat:', error.message);
    return NextResponse.json(
      { active: false, error: 'Gagal memperbarui heartbeat admin.' },
      { status: 500 }
    );
  }
}
