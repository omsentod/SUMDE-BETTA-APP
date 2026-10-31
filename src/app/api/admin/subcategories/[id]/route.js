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
    const { name, slug, description, image, orderIndex, departmentId } = body;

    const existing = await prisma.subCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sub-kategori tidak ditemukan.' }, { status: 404 });
    }

    const targetDeptId = departmentId || existing.departmentId;
    const dataToUpdate = {};
    if (departmentId !== undefined) dataToUpdate.departmentId = departmentId;
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (image !== undefined) dataToUpdate.image = image && typeof image === 'string' && image.trim() ? image.trim() : null;
    if (orderIndex !== undefined) dataToUpdate.orderIndex = parseInt(orderIndex) || 0;

    if (slug !== undefined && slug.trim()) {
      const finalSlug = slugify(slug);
      if (finalSlug !== existing.slug || targetDeptId !== existing.departmentId) {
        const conflict = await prisma.subCategory.findUnique({
          where: {
            departmentId_slug: {
              departmentId: targetDeptId,
              slug: finalSlug,
            },
          },
        });
        if (conflict && conflict.id !== id) {
          return NextResponse.json({ error: `Slug "${finalSlug}" sudah digunakan di departemen ini.` }, { status: 400 });
        }
        dataToUpdate.slug = finalSlug;
      }
    }

    const updated = await prisma.subCategory.update({
      where: { id },
      data: dataToUpdate,
      include: {
        _count: { select: { products: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requirePermission(request, ['products:delete', 'products:manage']);
    const { id } = await params;

    const existing = await prisma.subCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Sub-kategori tidak ditemukan.' }, { status: 404 });
    }

    if (existing._count.products > 0) {
      return NextResponse.json(
        {
          error: `Sub-kategori "${existing.name}" tidak dapat dihapus karena masih digunakan oleh ${existing._count.products} produk. Pindahkan produk ke kategori lain terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    await prisma.subCategory.delete({ where: { id } });

    return NextResponse.json({ message: `Sub-kategori "${existing.name}" berhasil dihapus.` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

