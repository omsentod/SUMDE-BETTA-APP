import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import {
  requirePermission,
  hasPermission,
  getRolePermissions,
} from '@/lib/permissions';

export async function GET(request) {
  try {
    await requirePermission(request, 'users:manage');
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    const sanitizedUsers = users.map(({ password, ...u }) => u);
    return NextResponse.json(sanitizedUsers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireUser(request);
    const {
      id,
      name,
      phone,
      streetAddress,
      rtRw,
      province,
      city,
      district,
      village,
      postalCode,
      role,
    } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const isSelf = session.id === id;
    const canManageUsers =
      session.role === 'admin' || (await hasPermission(session.role, 'users:manage'));

    // User biasa hanya boleh mengubah profilnya sendiri; users:manage boleh ubah user lain
    if (!canManageUsers && !isSelf) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki hak untuk mengubah data user lain.' },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (streetAddress !== undefined) dataToUpdate.streetAddress = streetAddress;
    if (rtRw !== undefined) dataToUpdate.rtRw = rtRw;
    if (province !== undefined) dataToUpdate.province = province;
    if (city !== undefined) dataToUpdate.city = city;
    if (district !== undefined) dataToUpdate.district = district;
    if (village !== undefined) dataToUpdate.village = village;
    if (postalCode !== undefined) dataToUpdate.postalCode = postalCode;

    // Perubahan role pengguna
    if (role !== undefined) {
      if (!canManageUsers) {
        return NextResponse.json(
          { error: 'Hanya pengguna dengan wewenang yang dapat mengubah role.' },
          { status: 403 }
        );
      }

      // 1. Cegah pengubahan role diri sendiri (Self-Escalation / Self-Lockout)
      if (isSelf && role !== session.role) {
        return NextResponse.json(
          { error: 'Anda tidak dapat mengubah role akun Anda sendiri.' },
          { status: 400 }
        );
      }

      // 2. Validasi bahwa role tujuan ada di master Role
      const targetRoleDoc = await prisma.role.findUnique({ where: { slug: role } });
      if (!targetRoleDoc) {
        return NextResponse.json(
          { error: `Role "${role}" tidak terdaftar dalam sistem.` },
          { status: 400 }
        );
      }

      // 3. Cegah pencabutan admin terakhir (Anti-Lockout)
      if (targetUser.role === 'admin' && role !== 'admin') {
        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Tidak dapat mengubah role admin terakhir. Sistem harus memiliki minimal satu admin.' },
            { status: 400 }
          );
        }
      }

      // 4. Cegah Vertical Privilege Escalation
      // Non-superadmin tidak boleh mempromosikan user ke role dengan hak akses lebih tinggi dari dirinya
      if (session.role !== 'admin') {
        if (role === 'admin') {
          return NextResponse.json(
            { error: 'Hanya superadmin yang dapat mengangkat user menjadi admin.' },
            { status: 403 }
          );
        }

        const myPerms = await getRolePermissions(session.role);
        const targetPerms = Array.isArray(targetRoleDoc.permissions) ? targetRoleDoc.permissions : [];
        const unauthorized = targetPerms.filter((p) => !myPerms.includes(p));
        if (unauthorized.length > 0) {
          return NextResponse.json(
            {
              error: `Eskalasi hak akses ditolak: Anda tidak dapat menetapkan role yang memiliki izin melebihi wewenang Anda ([${unauthorized.join(', ')}]).`,
            },
            { status: 403 }
          );
        }
      }

      dataToUpdate.role = role;
    }

    const updatedUser = await prisma.user.update({ where: { id }, data: dataToUpdate });
    const { password: _, ...userData } = updatedUser;
    return NextResponse.json(userData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requirePermission(request, 'users:manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    if (id === session.id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat menghapus akun Anda sendiri.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    if (targetUser.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Tidak dapat menghapus admin terakhir dalam sistem.' },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: 'User berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
