import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, ['chat:templates', 'chat:view']);

    const templates = await prisma.chatTemplate.findMany({
      orderBy: [
        { targetPos: 'asc' },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memuat template pertanyaan.' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    await requirePermission(request, 'chat:templates');
    const body = await request.json();

    const chipLabel = (body.chipLabel || '').trim();
    const messageText = (body.messageText || '').trim();
    const answerText = typeof body.answerText === 'string' ? body.answerText.trim() : null;
    const isAutoReply = typeof body.isAutoReply === 'boolean' ? body.isAutoReply : true;
    const targetPos = (body.targetPos || 'GLOBAL').toUpperCase();
    const sortOrder = Number.isInteger(body.sortOrder) ? body.sortOrder : 0;
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

    if (!chipLabel) {
      return NextResponse.json(
        { error: 'Label chip / tombol pertanyaan wajib diisi.' },
        { status: 400 }
      );
    }

    if (!messageText) {
      return NextResponse.json(
        { error: 'Isi teks pesan pertanyaan wajib diisi.' },
        { status: 400 }
      );
    }

    const allowedPositions = ['PRODUCT', 'VIP_GALLERY', 'CHECKOUT', 'GLOBAL', 'ALL'];
    if (!allowedPositions.includes(targetPos)) {
      return NextResponse.json(
        { error: 'Target posisi tidak valid. Pilihan: PRODUCT, VIP_GALLERY, CHECKOUT, GLOBAL, ALL' },
        { status: 400 }
      );
    }

    const template = await prisma.chatTemplate.create({
      data: {
        chipLabel,
        messageText,
        answerText: answerText || null,
        isAutoReply,
        targetPos,
        sortOrder,
        isActive,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat template pertanyaan & jawaban.' },
      { status: error.status || 500 }
    );
  }
}
