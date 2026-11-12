import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { computeChatStatus } from '@/lib/chatStatus';
import { publishChatStatus } from '@/lib/ably';

export const dynamic = 'force-dynamic';

async function getOrCreateSetting() {
  let setting = await prisma.chatSetting.findUnique({
    where: { id: 'default' },
  });

  if (!setting) {
    setting = await prisma.chatSetting.create({
      data: {
        id: 'default',
        adminStatus: 'AUTO',
        operatingHoursStart: '08:00',
        operatingHoursEnd: '21:00',
        offlineMessage:
          'Halo! Admin saat ini sedang beristirahat/di farm. Pesanmu sudah tersimpan aman dan akan kami balas segera setelah operasional kembali buka. Terima kasih!',
        emergencyWaNumber: '6281234567890',
      },
    });
  }

  return setting;
}

export async function GET() {
  try {
    const setting = await getOrCreateSetting();
    const statusData = computeChatStatus(setting);

    return NextResponse.json(statusData);
  } catch (err) {
    console.error('Error saat GET chat settings:', err.message);
    return NextResponse.json(
      { error: 'Gagal mengambil pengaturan chat.' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    await requirePermission(request, ['chat:templates', 'chat:reply']);
    const body = await request.json();

    const allowedStatuses = ['AUTO', 'ONLINE', 'AWAY', 'OFFLINE'];
    const adminStatus = allowedStatuses.includes(body.adminStatus)
      ? body.adminStatus
      : 'AUTO';

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const operatingHoursStart = timeRegex.test(body.operatingHoursStart)
      ? body.operatingHoursStart
      : '08:00';
    const operatingHoursEnd = timeRegex.test(body.operatingHoursEnd)
      ? body.operatingHoursEnd
      : '21:00';

    const offlineMessage =
      typeof body.offlineMessage === 'string' && body.offlineMessage.trim()
        ? body.offlineMessage.trim()
        : 'Halo! Admin sedang di luar jam operasional. Pesanmu akan kami balas segera.';

    const emergencyWaNumber =
      typeof body.emergencyWaNumber === 'string'
        ? body.emergencyWaNumber.trim().replace(/[^\d+]/g, '')
        : null;

    const updated = await prisma.chatSetting.upsert({
      where: { id: 'default' },
      update: {
        adminStatus,
        operatingHoursStart,
        operatingHoursEnd,
        offlineMessage,
        emergencyWaNumber,
      },
      create: {
        id: 'default',
        adminStatus,
        operatingHoursStart,
        operatingHoursEnd,
        offlineMessage,
        emergencyWaNumber,
      },
    });

    const statusData = computeChatStatus(updated);

    // Broadcast ke seluruh client (Customer & Admin) via Ably Realtime
    publishChatStatus(statusData).catch(() => {});

    return NextResponse.json({
      success: true,
      data: updated,
      ...statusData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui status chat admin.' },
      { status: error.status || 500 }
    );
  }
}
