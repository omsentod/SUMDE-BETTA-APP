import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export async function PUT(request, { params }) {
  try {
    await requirePermission(request, ['products:update', 'products:manage']);
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, icon, isLiveFish, orderIndex } = body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Departemen tidak ditemukan.' }, { status: 404 });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (icon !== undefined) dataToUpdate.icon = icon && typeof icon === 'string' && icon.trim() ? icon.trim() : null;
    if (isLiveFish !== undefined) dataToUpdate.isLiveFish = Boolean(isLiveFish);
    if (orderIndex !== undefined) dataToUpdate.orderIndex = parseInt(orderIndex) || 0;

    if (slug !== undefined && slug.trim()) {
      const finalSlug = slugify(slug);
      if (finalSlug !== existing.slug) {
        const conflict = await prisma.department.findUnique({ where: { slug: finalSlug } });
        if (conflict && conflict.id !== id) {
          return NextResponse.json({ error: `Slug "${finalSlug}" sudah digunakan.` }, { status: 400 });
        }
        dataToUpdate.slug = finalSlug;
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: dataToUpdate,
      include: {
        subCategories: { orderBy: { orderIndex: 'asc' } },
        _count: {
          select: {
            products: {
              where: { isArchived: false },
            },
            subCategories: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requirePermission(request, ['products:delete', 'products:manage']);
    const { id } = await params;

    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { subCategories: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Departemen tidak ditemukan.' }, { status: 404 });
    }

    if (existing._count.subCategories > 0) {
      return NextResponse.json(
        {
          error: `Departemen "${existing.name}" tidak dapat dihapus karena masih memiliki ${existing._count.subCategories} sub-kategori. Hapus sub-kategori di dalamnya terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    const activeProductsCount = await prisma.product.count({
      where: {
        departmentId: id,
        isArchived: false,
      },
    });

    if (activeProductsCount > 0) {
      return NextResponse.json(
        {
          error: `Departemen "${existing.name}" tidak dapat dihapus karena masih memiliki ${activeProductsCount} produk aktif. Silakan ubah atau hapus produk aktif di dalamnya terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // Lepas referensi dari produk yang ada di recycle bin agar tidak dangling
    await prisma.product.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });

    // Pindahkan snapshot ke Recycle Bin
    const { moveToRecycleBin } = await import('@/lib/recycleBin');
    await moveToRecycleBin({
      entityType: 'DEPARTMENT',
      entityId: id,
      name: existing.name,
      summary: `Departemen • Slug: ${existing.slug} • ${existing.isLiveFish ? 'Ikan Hias' : 'Peralatan/Pakan'}`,
      data: existing,
      deletedBy: session?.name || session?.email || 'Admin',
    });

    await prisma.department.delete({ where: { id } });

    return NextResponse.json({ message: `Departemen "${existing.name}" dipindahkan ke Recycle Bin.` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

