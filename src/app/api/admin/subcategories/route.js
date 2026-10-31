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

export async function POST(request) {
  try {
    await requirePermission(request, ['products:create', 'products:manage']);

    const body = await request.json();
    const { departmentId, name, slug, description, image, orderIndex } = body;

    if (!departmentId) {
      return NextResponse.json({ error: 'Departemen induk (Tingkat 1) wajib dipilih.' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama jenis / sub-kategori (Tingkat 2) wajib diisi.' }, { status: 400 });
    }

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      return NextResponse.json({ error: 'Departemen induk tidak ditemukan.' }, { status: 404 });
    }

    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    // Cek duplikasi slug dalam departemen yang sama
    const existing = await prisma.subCategory.findUnique({
      where: {
        departmentId_slug: {
          departmentId,
          slug: finalSlug,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Sub-kategori "${name}" dengan slug "${finalSlug}" sudah ada di departemen ini.` },
        { status: 400 }
      );
    }

    let finalOrderIndex = orderIndex !== undefined ? parseInt(orderIndex) || 0 : 0;
    if (orderIndex === undefined) {
      const maxOrder = await prisma.subCategory.findFirst({
        where: { departmentId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      finalOrderIndex = maxOrder ? maxOrder.orderIndex + 1 : 0;
    }

    const created = await prisma.subCategory.create({
      data: {
        departmentId,
        name: name.trim(),
        slug: finalSlug,
        description: description ? description.trim() : null,
        image: image && typeof image === 'string' && image.trim() ? image.trim() : null,
        orderIndex: finalOrderIndex,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

