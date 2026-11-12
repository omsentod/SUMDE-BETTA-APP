import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function PUT(request, context) {
  try {
    await requirePermission(request, 'chat:templates');
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.chatTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template pertanyaan tidak ditemukan.' },
        { status: 404 }
      );
    }

    const data = {};
    if (typeof body.chipLabel === 'string') {
      const trimmed = body.chipLabel.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Label chip tidak boleh kosong.' },
          { status: 400 }
        );
      }
      data.chipLabel = trimmed;
    }

    if (typeof body.messageText === 'string') {
      const trimmed = body.messageText.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Isi pesan tidak boleh kosong.' },
          { status: 400 }
        );
      }
      data.messageText = trimmed;
    }

    if (body.answerText !== undefined) {
      if (typeof body.answerText === 'string') {
        const trimmed = body.answerText.trim();
        data.answerText = trimmed || null;
      } else {
        data.answerText = null;
      }
    }

    if (typeof body.isAutoReply === 'boolean') {
      data.isAutoReply = body.isAutoReply;
    }

    if (typeof body.targetPos === 'string') {
      const pos = body.targetPos.toUpperCase();
      const allowed = ['PRODUCT', 'VIP_GALLERY', 'CHECKOUT', 'GLOBAL', 'ALL'];
      if (!allowed.includes(pos)) {
        return NextResponse.json(
          { error: 'Target posisi tidak valid.' },
          { status: 400 }
        );
      }
      data.targetPos = pos;
    }

    if (Number.isInteger(body.sortOrder)) {
      data.sortOrder = body.sortOrder;
    }

    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive;
    }

    const updated = await prisma.chatTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui template pertanyaan.' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    await requirePermission(request, 'chat:templates');
    const { id } = await context.params;

    const existing = await prisma.chatTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Template pertanyaan tidak ditemukan.' },
        { status: 404 }
      );
    }

    await prisma.chatTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Template berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus template pertanyaan.' },
      { status: error.status || 500 }
    );
  }
}
