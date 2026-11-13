import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pos = (searchParams.get('pos') || 'ALL').toUpperCase();

    // Mengambil seluruh template aktif dari database
    const allTemplates = await prisma.chatTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        chipLabel: true,
        messageText: true,
        answerText: true,
        isAutoReply: true,
        targetPos: true,
        sortOrder: true,
      },
    });

    // Urutkan: template yang cocok dengan posisi halaman saat ini atau 'ALL' diletakkan di depan
    const sorted = [...allTemplates].sort((a, b) => {
      const aMatch = a.targetPos === pos || a.targetPos === 'ALL';
      const bMatch = b.targetPos === pos || b.targetPos === 'ALL';
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    return NextResponse.json({ templates: sorted });
  } catch (err) {
    console.error('Error saat GET chat templates:', err.message);
    return NextResponse.json({ templates: [] });
  }
}
