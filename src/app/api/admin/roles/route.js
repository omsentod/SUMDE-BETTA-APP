import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  SYSTEM_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  requirePermission,
  getRolePermissions,
  invalidateRoleCache,
  ensureSystemRoles,
} from '@/lib/permissions';

const SLUG_REGEX = /^[a-z0-9_-]{2,30}$/;
const RESERVED_SLUGS = ['admin', 'customer', 'superadmin', 'root', 'system'];

/**
 * GET /api/admin/roles
 * Mengambil daftar master role beserta jumlah pengguna aktif dan daftar hak akses sistem.
 */
export async function GET(request) {
  try {
    // Diperlukan permission 'roles:manage' atau 'users:manage' (untuk form pilih role user)
    await requirePermission(request, ['roles:manage', 'users:manage']);
    await ensureSystemRoles();

    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });

    // Hitung jumlah user per role
    const userRoleCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const countMap = new Map();
    userRoleCounts.forEach((item) => {
      countMap.set(item.role, item._count.id);
    });

    const enrichedRoles = roles.map((role) => ({
      ...role,
      userCount: countMap.get(role.slug) || 0,
    }));

    return NextResponse.json({
      roles: enrichedRoles,
      systemPermissions: SYSTEM_PERMISSIONS,
      allPermissionKeys: ALL_PERMISSION_KEYS,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

/**
 * POST /api/admin/roles
 * Membuat role baru dengan validasi whitelist permission dan proteksi eskalasi privilege.
 */
export async function POST(request) {
  try {
    const session = await requirePermission(request, 'roles:manage');
    const body = await request.json();

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    // 1. Validasi Input Dasar
    if (!name || name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { error: 'Nama role wajib diisi (antara 2 - 50 karakter).' },
        { status: 400 }
      );
    }

    if (!slug || !SLUG_REGEX.test(slug)) {
      return NextResponse.json(
        { error: 'Slug role hanya boleh huruf kecil, angka, tanda minus (-), atau underscore (_) sepanjang 2 - 30 karakter.' },
        { status: 400 }
      );
    }

    if (RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json(
        { error: `Slug "${slug}" adalah reserved keyword sistem dan tidak boleh digunakan.` },
        { status: 400 }
      );
    }

    if (description.length > 255) {
      return NextResponse.json(
        { error: 'Deskripsi role maksimal 255 karakter.' },
        { status: 400 }
      );
    }

    // 2. Validasi Whitelist Permission (Anti-Tampering)
    for (const perm of permissions) {
      if (!ALL_PERMISSION_KEYS.includes(perm)) {
        return NextResponse.json(
          { error: `Permission "${perm}" tidak dikenali dalam sistem.` },
          { status: 400 }
        );
      }
    }

    // 3. Proteksi Vertical Privilege Escalation
    // Non-superadmin tidak boleh menetapkan permission yang tidak ia miliki sendiri
    if (session.role !== 'admin') {
      const myPerms = await getRolePermissions(session.role);
      const invalidGrants = permissions.filter((p) => !myPerms.includes(p));
      if (invalidGrants.length > 0) {
        return NextResponse.json(
          { error: `Eskalasi hak akses ditolak: Anda tidak memiliki izin [${invalidGrants.join(', ')}] untuk diberikan ke role lain.` },
          { status: 403 }
        );
      }
    }

    // 4. Cek Keunikan Slug
    const existing = await prisma.role.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Role dengan slug "${slug}" sudah terdaftar.` },
        { status: 409 }
      );
    }

    // 5. Simpan ke Database
    const newRole = await prisma.role.create({
      data: {
        name,
        slug,
        description: description || null,
        permissions,
        isSystem: false,
      },
    });

    invalidateRoleCache(slug);

    return NextResponse.json(
      { ...newRole, userCount: 0 },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
