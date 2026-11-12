import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { normalizeTikTokHandle } from '@/lib/tiktokLive';

export async function POST(request) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { name, handle } = await request.json();
    const cleanName = String(name || '').trim().slice(0, 80);
    const cleanHandle = normalizeTikTokHandle(handle);

    if (!cleanName) {
      return NextResponse.json({ error: 'Nama akun wajib diisi.' }, { status: 400 });
    }
    if (!cleanHandle) {
      return NextResponse.json({ error: 'Handle TikTok tidak valid (contoh: @sumdebetta.live).' }, { status: 400 });
    }

    const exists = await prisma.tikTokAccount.findUnique({ where: { handle: cleanHandle } });
    if (exists) {
      return NextResponse.json({ error: `Handle ${cleanHandle} sudah terdaftar.` }, { status: 409 });
    }

    const count = await prisma.tikTokAccount.count();
    const created = await prisma.tikTokAccount.create({
      data: {
        name: cleanName,
        handle: cleanHandle,
        orderIndex: count,
        isActive: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PUT(request) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { id, name, handle, isActive } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID akun wajib diisi.' }, { status: 400 });
    }

    const existing = await prisma.tikTokAccount.findUnique({ where: { id: String(id) } });
    if (!existing) {
      return NextResponse.json({ error: 'Akun TikTok tidak ditemukan.' }, { status: 404 });
    }

    const data = {};
    if (name !== undefined) {
      const cleanName = String(name).trim().slice(0, 80);
      if (!cleanName) {
        return NextResponse.json({ error: 'Nama akun tidak boleh kosong.' }, { status: 400 });
      }
      data.name = cleanName;
    }
    if (handle !== undefined) {
      const cleanHandle = normalizeTikTokHandle(handle);
      if (!cleanHandle) {
        return NextResponse.json({ error: 'Handle TikTok tidak valid.' }, { status: 400 });
      }
      if (cleanHandle !== existing.handle) {
        const dup = await prisma.tikTokAccount.findUnique({ where: { handle: cleanHandle } });
        if (dup) {
          return NextResponse.json({ error: `Handle ${cleanHandle} sudah digunakan akun lain.` }, { status: 409 });
        }
      }
      data.handle = cleanHandle;
    }
    if (typeof isActive === 'boolean') {
      data.isActive = isActive;
    }

    const updated = await prisma.tikTokAccount.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
