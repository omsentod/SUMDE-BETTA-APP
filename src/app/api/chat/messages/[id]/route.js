import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { publishToConversation } from '@/lib/ably';
import { consume } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/chat/messages/[id]
 * Mengedit pesan yang dikirim (WhatsApp-Style Edit)
 */
export async function PATCH(request, context) {
  try {
    const session = await getSession(request);
    if (!session?.id) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan untuk mengedit pesan.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID pesan tidak valid.' }, { status: 400 });
    }

    // Rate limit edit pesan: 20x per menit
    const { ok: rateOk } = consume(`chat:edit:${session.id}`, { limit: 20, windowMs: 60 * 1000 });
    if (!rateOk) {
      return NextResponse.json(
        { error: 'Terlalu sering mengedit pesan. Mohon tunggu sejenak.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const newText = (body.message || '').trim();

    if (!newText) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 });
    }
    if (newText.length > 2000) {
      return NextResponse.json(
        { error: 'Pesan terlalu panjang (maksimal 2000 karakter).' },
        { status: 400 }
      );
    }

    const existingMessage = await prisma.chatMessage.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Pesan tidak ditemukan.' }, { status: 404 });
    }

    if (existingMessage.isDeleted) {
      return NextResponse.json(
        { error: 'Pesan yang sudah dihapus tidak dapat diedit.' },
        { status: 400 }
      );
    }

    const isAdmin =
      session.role === 'admin' ||
      (Array.isArray(session.permissions) && session.permissions.includes('chat:reply'));

    // Customer hanya boleh edit pesan miliknya sendiri
    // Admin hanya boleh edit pesan admin
    let canEdit = false;
    if (isAdmin) {
      canEdit = existingMessage.senderRole === 'ADMIN';
    } else {
      canEdit =
        existingMessage.senderRole === 'CUSTOMER' &&
        (existingMessage.senderId === session.id ||
          existingMessage.conversation?.userId === session.id);
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki hak untuk mengedit pesan ini.' },
        { status: 403 }
      );
    }

    const updated = await prisma.chatMessage.update({
      where: { id: existingMessage.id },
      data: {
        message: newText,
        isEdited: true,
        editedAt: new Date(),
      },
    });

    // Broadcast ke realtime channel percakapan
    await publishToConversation(existingMessage.conversationId, 'message-updated', {
      id: updated.id,
      conversationId: updated.conversationId,
      message: updated.message,
      isEdited: true,
      editedAt: updated.editedAt,
    });

    return NextResponse.json({
      success: true,
      message: updated,
    });
  } catch (err) {
    console.error('Error saat edit pesan chat:', err.message);
    return NextResponse.json(
      { error: 'Gagal memperbarui pesan chat.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/messages/[id]
 * Menghapus pesan secara soft-delete (WhatsApp-Style "Pesan ini telah dihapus")
 */
export async function DELETE(request, context) {
  try {
    const session = await getSession(request);
    if (!session?.id) {
      return NextResponse.json(
        { error: 'Autentikasi diperlukan untuk menghapus pesan.' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'ID pesan tidak valid.' }, { status: 400 });
    }

    const existingMessage = await prisma.chatMessage.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!existingMessage) {
      return NextResponse.json({ error: 'Pesan tidak ditemukan.' }, { status: 404 });
    }

    if (existingMessage.isDeleted) {
      return NextResponse.json({
        success: true,
        id: existingMessage.id,
        alreadyDeleted: true,
      });
    }

    const isAdmin =
      session.role === 'admin' ||
      (Array.isArray(session.permissions) && session.permissions.includes('chat:reply'));

    // Customer hanya boleh hapus pesannya sendiri
    // Admin boleh hapus pesan di obrolan (moderasi / hapus pesan admin)
    let canDelete = false;
    if (isAdmin) {
      canDelete = true;
    } else {
      canDelete =
        existingMessage.senderRole === 'CUSTOMER' &&
        (existingMessage.senderId === session.id ||
          existingMessage.conversation?.userId === session.id);
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki hak untuk menghapus pesan ini.' },
        { status: 403 }
      );
    }

    const deleted = await prisma.chatMessage.update({
      where: { id: existingMessage.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        message: 'Pesan ini telah dihapus',
        attachedType: null,
        attachedId: null,
        attachedMeta: null,
      },
    });

    // Broadcast ke realtime channel percakapan
    await publishToConversation(existingMessage.conversationId, 'message-deleted', {
      id: deleted.id,
      conversationId: deleted.conversationId,
      isDeleted: true,
      message: 'Pesan ini telah dihapus',
      deletedAt: deleted.deletedAt,
    });

    return NextResponse.json({
      success: true,
      id: deleted.id,
    });
  } catch (err) {
    console.error('Error saat hapus pesan chat:', err.message);
    return NextResponse.json(
      { error: 'Gagal menghapus pesan chat.' },
      { status: 500 }
    );
  }
}
