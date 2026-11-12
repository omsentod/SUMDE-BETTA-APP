import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  ALL_PERMISSION_KEYS,
  requirePermission,
  getRolePermissions,
  invalidateRoleCache,
} from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * PUT /api/admin/roles/[id]
 * Memperbarui nama, deskripsi, dan permissions dari role custom.
 */
export async function PUT(request, { params }) {
  try {
    const session = await requirePermission(request, 'roles:manage');
    const { id } = await params;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role tidak ditemukan.' }, { status: 404 });
    }

    // Role sistem (admin & customer) tidak boleh dimodifikasi izinnya
    if (existing.isSystem) {
      return NextResponse.json(
        { error: `Role sistem ("${existing.name}") bersifat permanen dan tidak dapat diubah hak aksesnya.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const dataToUpdate = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length < 2 || name.length > 50) {
        return NextResponse.json(
          { error: 'Nama role wajib diisi (antara 2 - 50 karakter).' },
          { status: 400 }
        );
      }
      dataToUpdate.name = name;
    }

    if (body.description !== undefined) {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (description.length > 255) {
        return NextResponse.json(
          { error: 'Deskripsi role maksimal 255 karakter.' },
          { status: 400 }
        );
      }
      dataToUpdate.description = description || null;
    }

    if (body.color !== undefined) {
      const colorStr = typeof body.color === 'string' ? body.color.trim() : '';
      if (!HEX_COLOR_REGEX.test(colorStr)) {
        return NextResponse.json(
          { error: 'Format warna tidak valid. Gunakan format kode HEX (contoh: #FF6B35 atau #3B82F6).' },
          { status: 400 }
        );
      }
      let normalizedColor = colorStr;
      if (normalizedColor.length === 4) {
        normalizedColor = `#${normalizedColor[1]}${normalizedColor[1]}${normalizedColor[2]}${normalizedColor[2]}${normalizedColor[3]}${normalizedColor[3]}`.toUpperCase();
      } else {
        normalizedColor = normalizedColor.toUpperCase();
      }
      dataToUpdate.color = normalizedColor;
    }

    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions)) {
        return NextResponse.json(
          { error: 'Permissions harus berupa array string.' },
          { status: 400 }
        );
      }

      // Whitelist validation
      for (const perm of body.permissions) {
        if (!ALL_PERMISSION_KEYS.includes(perm)) {
          return NextResponse.json(
            { error: `Permission "${perm}" tidak dikenali dalam sistem.` },
            { status: 400 }
          );
        }
      }

      // Privilege escalation check
      if (session.role !== 'admin') {
        const myPerms = await getRolePermissions(session.role);
        const invalidGrants = body.permissions.filter((p) => !myPerms.includes(p));
        if (invalidGrants.length > 0) {
          return NextResponse.json(
            { error: `Eskalasi hak akses ditolak: Anda tidak memiliki izin [${invalidGrants.join(', ')}] untuk diberikan ke role lain.` },
            { status: 403 }
          );
        }
      }

      dataToUpdate.permissions = body.permissions;
    }

    const updated = await prisma.role.update({
      where: { id },
      data: dataToUpdate,
    });

    invalidateRoleCache(existing.slug);

    const userCount = await prisma.user.count({ where: { role: updated.slug } });

    return NextResponse.json({
      ...updated,
      userCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/[id]
 * Menghapus role custom dengan proteksi system role dan assigned users.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await requirePermission(request, 'roles:manage');
    const { id } = await params;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role tidak ditemukan.' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json(
        { error: `Role sistem ("${existing.name}") tidak dapat dihapus.` },
        { status: 400 }
      );
    }

    // Cek apakah ada user yang masih menggunakan role ini
    const userCount = await prisma.user.count({ where: { role: existing.slug } });
    if (userCount > 0) {
      return NextResponse.json(
        {
          error: `Tidak dapat menghapus role "${existing.name}" karena masih digunakan oleh ${userCount} user. Silakan ubah role user terkait terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Pindahkan snapshot ke Recycle Bin
    const { moveToRecycleBin } = await import('@/lib/recycleBin');
    await moveToRecycleBin({
      entityType: 'ROLE',
      entityId: id,
      name: existing.name,
      summary: `Peran • Slug: ${existing.slug}`,
      data: existing,
      deletedBy: session?.name || session?.email || 'Admin',
    });

    await prisma.role.delete({ where: { id } });
    invalidateRoleCache(existing.slug);

    return NextResponse.json({
      message: `Role "${existing.name}" dipindahkan ke Recycle Bin.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
