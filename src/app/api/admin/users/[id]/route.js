import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission, hasPermission, getRolePermissions } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';

/**
 * GET /api/admin/users/[id]
 * Mengambil profil lengkap user beserta seluruh aktivitasnya:
 * - Riwayat pesanan & item
 * - Buku alamat tersimpan
 * - Percakapan chat dengan CS
 * - Notifikasi yang pernah diterima
 * - Riwayat reset password
 * - Ringkasan metrik aktivitas belanja
 */
export async function GET(request, { params }) {
  try {
    await requirePermission(request, ['users:view', 'users:manage']);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        googleId: true,
        avatarUrl: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        streetAddress: true,
        rtRw: true,
        province: true,
        city: true,
        district: true,
        village: true,
        postalCode: true,
        createdAt: true,
        updatedAt: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Ambil seluruh pesanan user ini (termasuk matching email jika ada guest order sebelumnya)
    const orders = await prisma.order.findMany({
      where: {
        OR: [{ userId: id }, { email: user.email }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Ambil buku alamat tersimpan
    const addresses = await prisma.address.findMany({
      where: { userId: id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    // Ambil sesi percakapan chat
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userId: id }, { guestEmail: user.email }],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          take: 15,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Ambil notifikasi terbaru
    const notifications = await prisma.notification.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Ambil riwayat reset password
    const passwordResets = await prisma.passwordReset.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
    });

    // Hitung ringkasan statistik belanja
    const paidOrders = orders.filter((o) =>
      ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'].includes(o.status)
    );
    const totalSpent = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;
    const activeOrdersCount = orders.filter((o) =>
      ['PAID', 'PROCESSING', 'SHIPPED'].includes(o.status)
    );
    const cancelledOrdersCount = orders.filter((o) => o.status === 'CANCELLED').length;
    const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING').length;
    const avgOrderValue = paidOrders.length > 0 ? Math.round(totalSpent / paidOrders.length) : 0;
    const firstOrderAt = orders.length > 0 ? orders[orders.length - 1].createdAt : null;
    const lastOrderAt = orders.length > 0 ? orders[0].createdAt : null;

    const { password, ...safeUser } = user;

    return NextResponse.json({
      user: {
        ...safeUser,
        hasPassword: Boolean(password),
        isGoogleLinked: Boolean(user.googleId),
      },
      orders,
      addresses,
      conversations,
      notifications,
      passwordResets,
      summary: {
        totalOrders: orders.length,
        paidOrdersCount: paidOrders.length,
        totalSpent,
        completedOrdersCount,
        activeOrdersCount: activeOrdersCount.length,
        cancelledOrdersCount,
        pendingOrdersCount,
        avgOrderValue,
        firstOrderAt,
        lastOrderAt,
        addressesCount: addresses.length,
        conversationsCount: conversations.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Kontrol dan pembaruan data pengguna oleh admin:
 * - Update profil dasar (nama, email unik, telepon, avatarUrl)
 * - Update alamat profil
 * - Ubah role jabatan (dengan validasi anti-lockout & anti-escalation)
 * - Kontrol status verifikasi email (manual toggle true/false)
 * - Ubah password langsung oleh admin
 * - Putus tautan akun Google OAuth
 */
export async function PATCH(request, { params }) {
  try {
    const session = await requirePermission(request, ['users:update', 'users:manage']);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      avatarUrl,
      streetAddress,
      rtRw,
      province,
      city,
      district,
      village,
      postalCode,
      role,
      emailVerified,
      phoneVerified,
      newPassword,
      unlinkGoogle,
    } = body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const dataToUpdate = {};

    // 1. Validasi nama
    if (name !== undefined) {
      const cleanName = String(name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'Nama pengguna tidak boleh kosong.' }, { status: 400 });
      }
      dataToUpdate.name = cleanName;
    }

    // 2. Validasi & normalisasi email
    if (email !== undefined) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 });
      }
      if (cleanEmail !== targetUser.email) {
        const existingWithEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (existingWithEmail) {
          return NextResponse.json(
            { error: 'Email tersebut sudah digunakan oleh akun lain.' },
            { status: 400 }
          );
        }
        dataToUpdate.email = cleanEmail;
      }
    }

    // 3. Telepon & Avatar
    if (phone !== undefined) dataToUpdate.phone = phone ? String(phone).trim() : null;
    if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl ? String(avatarUrl).trim() : null;

    // 4. Kolom alamat profil
    if (streetAddress !== undefined) dataToUpdate.streetAddress = streetAddress ? String(streetAddress).trim() : null;
    if (rtRw !== undefined) dataToUpdate.rtRw = rtRw ? String(rtRw).trim() : null;
    if (province !== undefined) dataToUpdate.province = province ? String(province).trim() : null;
    if (city !== undefined) dataToUpdate.city = city ? String(city).trim() : null;
    if (district !== undefined) dataToUpdate.district = district ? String(district).trim() : null;
    if (village !== undefined) dataToUpdate.village = village ? String(village).trim() : null;
    if (postalCode !== undefined) {
      const cleanPostal = postalCode ? String(postalCode).trim() : null;
      if (cleanPostal && !/^\d{5}$/.test(cleanPostal)) {
        return NextResponse.json({ error: 'Kode pos wajib terdiri dari 5 digit angka.' }, { status: 400 });
      }
      dataToUpdate.postalCode = cleanPostal;
    }

    // 5. Kontrol verifikasi email & WhatsApp oleh admin
    if (emailVerified !== undefined) {
      if (emailVerified === true) {
        dataToUpdate.emailVerified = new Date();
      } else if (emailVerified === false || emailVerified === null) {
        dataToUpdate.emailVerified = null;
      }
    }

    if (phoneVerified !== undefined) {
      if (phoneVerified === true) {
        dataToUpdate.phoneVerified = new Date();
      } else if (phoneVerified === false || phoneVerified === null) {
        dataToUpdate.phoneVerified = null;
      }
    }

    // 6. Kontrol putus tautan Google OAuth
    if (unlinkGoogle === true) {
      dataToUpdate.googleId = null;
    }

    // 7. Kontrol set password baru oleh admin
    if (newPassword !== undefined && newPassword !== null && String(newPassword).trim() !== '') {
      const cleanPassword = String(newPassword).trim();
      if (cleanPassword.length < 6) {
        return NextResponse.json(
          { error: 'Password baru minimal harus 6 karakter.' },
          { status: 400 }
        );
      }
      dataToUpdate.password = hashPassword(cleanPassword);
    }

    // 8. Kontrol Role Jabatan (RBAC Guards)
    if (role !== undefined && role !== targetUser.role) {
      const isSelf = session.id === id;

      // Anti-Lockout: Cegah admin mengubah rolenya sendiri
      if (isSelf) {
        return NextResponse.json(
          { error: 'Anda tidak dapat mengubah role akun Anda sendiri.' },
          { status: 400 }
        );
      }

      // Validasi role ada di DB
      const targetRoleDoc = await prisma.role.findUnique({ where: { slug: role } });
      if (!targetRoleDoc) {
        return NextResponse.json(
          { error: `Role "${role}" tidak terdaftar dalam sistem.` },
          { status: 400 }
        );
      }

      // Anti-Lockout: Cegah pencabutan admin terakhir
      if (targetUser.role === 'admin' && role !== 'admin') {
        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Tidak dapat mengubah role admin terakhir dalam sistem.' },
            { status: 400 }
          );
        }
      }

      // Cegah Vertical Privilege Escalation
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
              error: `Eskalasi wewenang ditolak: Role tujuan memiliki izin melebihi wewenang Anda ([${unauthorized.join(', ')}]).`,
            },
            { status: 403 }
          );
        }
      }

      dataToUpdate.role = role;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    const { password: _, ...safeUser } = updated;
    return NextResponse.json({
      message: 'Data pengguna berhasil diperbarui.',
      user: {
        ...safeUser,
        hasPassword: Boolean(updated.password),
        isGoogleLinked: Boolean(updated.googleId),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
