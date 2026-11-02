import prisma from '@/lib/prisma';

/**
 * Normalisasi data untuk snapshot, membuang relasi nested yang bukan kolom tabel langsung.
 */
function cleanRecordData(data, ignoredKeys = []) {
  if (!data || typeof data !== 'object') return data;
  const cleaned = { ...data };
  for (const key of ignoredKeys) {
    delete cleaned[key];
  }
  return cleaned;
}

/**
 * Pindahkan data ke RecycleBinItem (Soft-Delete generic)
 */
export async function moveToRecycleBin({
  entityType,
  entityId,
  name,
  summary,
  data,
  deletedBy = null,
}) {
  try {
    return await prisma.recycleBinItem.create({
      data: {
        entityType,
        entityId,
        name: name || 'Tanpa Nama',
        summary: summary || null,
        data: data || {},
        deletedBy,
      },
    });
  } catch (err) {
    console.error(`[RecycleBin] Gagal mencatat recycle bin untuk ${entityType}:`, err.message);
    return null;
  }
}

/**
 * Pulihkan satu item dari Recycle Bin
 */
export async function restoreRecycleItem(id) {
  // Cek apakah item adalah Produk dari tabel Product langsung (isArchived: true)
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (product && product.isArchived) {
    await prisma.product.update({
      where: { id },
      data: { isArchived: false },
    });
    return { ok: true, name: product.name, entityType: 'PRODUCT' };
  }

  // Jika bukan produk arsip, cari di RecycleBinItem
  const item = await prisma.recycleBinItem.findUnique({
    where: { id },
  });

  if (!item) {
    throw new Error('Data di tempat sampah tidak ditemukan atau sudah dipulihkan.');
  }

  const { entityType, entityId, data } = item;

  switch (entityType) {
    case 'EVENT': {
      const payload = cleanRecordData(data, []);
      // Pastikan parse tanggal ISO jika ada
      if (payload.startDate) payload.startDate = new Date(payload.startDate);
      if (payload.endDate) payload.endDate = new Date(payload.endDate);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);

      await prisma.promoEvent.create({ data: payload });
      break;
    }

    case 'DEPARTMENT': {
      const payload = cleanRecordData(data, ['subCategories', 'products', '_count']);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);

      // Cek duplikasi slug
      const existingSlug = await prisma.department.findUnique({ where: { slug: payload.slug } });
      if (existingSlug) {
        payload.slug = `${payload.slug}-restored-${Date.now().toString().slice(-4)}`;
      }

      await prisma.department.create({ data: payload });
      break;
    }

    case 'SUBCATEGORY': {
      const payload = cleanRecordData(data, ['department', 'products', '_count']);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);

      // Pastikan departemen induk masih ada
      const parentDept = await prisma.department.findUnique({ where: { id: payload.departmentId } });
      if (!parentDept) {
        const fallbackDept = await prisma.department.findFirst({ orderBy: { orderIndex: 'asc' } });
        if (!fallbackDept) {
          throw new Error('Tidak dapat memulihkan kategori karena tidak ada Departemen induk aktif di sistem.');
        }
        payload.departmentId = fallbackDept.id;
      }

      // Cek slug dalam departemen
      const existingSubSlug = await prisma.subCategory.findUnique({
        where: {
          departmentId_slug: {
            departmentId: payload.departmentId,
            slug: payload.slug,
          },
        },
      });
      if (existingSubSlug) {
        payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
      }

      await prisma.subCategory.create({ data: payload });
      break;
    }

    case 'USER': {
      const payload = cleanRecordData(data, ['orders', 'addresses', 'notifications', 'pushSubscriptions', 'passwordResets']);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);
      if (payload.emailVerified) payload.emailVerified = new Date(payload.emailVerified);

      // Cek apakah email sudah terdaftar akun baru
      const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
      if (existingUser) {
        throw new Error(`Email "${payload.email}" sudah terdaftar pada pengguna lain. Ubah atau gunakan email berbeda.`);
      }

      await prisma.user.create({ data: payload });
      break;
    }

    case 'ROLE': {
      const payload = cleanRecordData(data, []);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);

      const existingRole = await prisma.role.findUnique({ where: { slug: payload.slug } });
      if (existingRole) {
        throw new Error(`Peran dengan slug "${payload.slug}" sudah ada di sistem.`);
      }

      await prisma.role.create({ data: payload });
      break;
    }

    case 'TELEGRAM_EVENT': {
      const payload = cleanRecordData(data, ['products', '_count']);
      if (payload.date) payload.date = new Date(payload.date);
      if (payload.expiresAt) payload.expiresAt = new Date(payload.expiresAt);
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);

      await prisma.telegramBroadcastEvent.create({ data: payload });
      break;
    }

    default:
      throw new Error(`Tipe entitas "${entityType}" belum didukung untuk pemulihan otomatis.`);
  }

  // Hapus dari penampung RecycleBinItem setelah berhasil dipulihkan
  await prisma.recycleBinItem.delete({ where: { id } });

  return { ok: true, name: item.name, entityType };
}

/**
 * Hapus permanen satu item dari Recycle Bin
 */
export async function permanentlyDeleteRecycleItem(id) {
  // Cek apakah item adalah Produk
  const product = await prisma.product.findUnique({ where: { id } });
  if (product) {
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      throw new Error('Produk tidak dapat dimusnahkan permanen karena memiliki riwayat transaksi/invoice. Produk tetap disimpan di tempat sampah.');
    }
    await prisma.product.delete({ where: { id } });
    return { ok: true, name: product.name, entityType: 'PRODUCT' };
  }

  // Jika di RecycleBinItem
  const item = await prisma.recycleBinItem.findUnique({ where: { id } });
  if (!item) {
    throw new Error('Data tidak ditemukan di tempat sampah.');
  }

  await prisma.recycleBinItem.delete({ where: { id } });
  return { ok: true, name: item.name, entityType: item.entityType };
}
