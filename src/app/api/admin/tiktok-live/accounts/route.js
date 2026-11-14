import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { normalizeTikTokHandle } from '@/lib/tiktokLive';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await requirePermission(request, ['events:view', 'events:manage', 'orders:view', 'products:view']);

    const [accounts, rawTeamUsers] = await Promise.all([
      prisma.tikTokAccount.findMany({
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        include: {
          hostUser: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true },
          },
        },
      }),
      prisma.user.findMany({
        where: { role: { not: 'customer' } },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    let teamUsers = rawTeamUsers;
    if (teamUsers.length === 0) {
      teamUsers = await prisma.user.findMany({
        take: 50,
        select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ accounts, teamUsers });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const { name, handle, avatar, hostUserId } = await request.json();
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

    let hostName = null;
    let resolvedHostUserId = null;
    if (hostUserId) {
      const host = await prisma.user.findUnique({
        where: { id: String(hostUserId) },
        select: { id: true, name: true },
      });
      if (host) {
        resolvedHostUserId = host.id;
        hostName = host.name;
      }
    }

    const count = await prisma.tikTokAccount.count();
    const created = await prisma.tikTokAccount.create({
      data: {
        name: cleanName,
        handle: cleanHandle,
        avatar: avatar ? String(avatar).trim().slice(0, 500) : null,
        hostUserId: resolvedHostUserId,
        hostName,
        orderIndex: count,
        isActive: true,
      },
      include: {
        hostUser: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
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

    const { id, name, handle, isActive, avatar, hostUserId } = await request.json();
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
    if (avatar !== undefined) {
      data.avatar = avatar ? String(avatar).trim().slice(0, 500) : null;
    }
    if (hostUserId !== undefined) {
      if (!hostUserId) {
        data.hostUserId = null;
        data.hostName = null;
      } else {
        const host = await prisma.user.findUnique({
          where: { id: String(hostUserId) },
          select: { id: true, name: true },
        });
        if (host) {
          data.hostUserId = host.id;
          data.hostName = host.name;
        } else {
          data.hostUserId = null;
          data.hostName = null;
        }
      }
    }

    const updated = await prisma.tikTokAccount.update({
      where: { id: existing.id },
      data,
      include: {
        hostUser: {
          select: { id: true, name: true, email: true, role: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID akun wajib disertakan.' }, { status: 400 });
    }

    const openBaskets = await prisma.tikTokLiveBasket.count({
      where: { tiktokAccountId: id, status: 'OPEN' },
    });
    if (openBaskets > 0) {
      return NextResponse.json(
        { error: `Tidak dapat menghapus akun: ada ${openBaskets} keranjang live yang masih OPEN.` },
        { status: 400 }
      );
    }

    await prisma.tikTokAccount.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
