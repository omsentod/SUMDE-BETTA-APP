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

export async function GET(request) {
  try {
    await requirePermission(request, ['products:view', 'products:manage']);

    const departments = await prisma.department.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        subCategories: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: { products: true },
            },
          },
        },
        _count: {
          select: { products: true, subCategories: true },
        },
      },
    });

    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requirePermission(request, ['products:create', 'products:manage']);

    const body = await request.json();
    const { name, slug, description, icon, isLiveFish, orderIndex } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama departemen (Tingkat 1) wajib diisi.' }, { status: 400 });
    }

    const finalSlug = slug && slug.trim() ? slugify(slug) : slugify(name);

    // Cek duplikasi slug
    const existing = await prisma.department.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      return NextResponse.json({ error: `Slug "${finalSlug}" sudah digunakan oleh departemen lain.` }, { status: 400 });
    }

    // Default orderIndex: paling akhir
    let finalOrderIndex = orderIndex !== undefined ? parseInt(orderIndex) || 0 : 0;
    if (orderIndex === undefined) {
      const maxOrder = await prisma.department.findFirst({
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      finalOrderIndex = maxOrder ? maxOrder.orderIndex + 1 : 0;
    }

    const created = await prisma.department.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description ? description.trim() : null,
        icon: icon && typeof icon === 'string' && icon.trim() ? icon.trim() : (isLiveFish ? '/img/tab-dept-fish.svg' : '/img/tab-dept-equipment.svg'),
        isLiveFish: isLiveFish !== undefined ? Boolean(isLiveFish) : true,
        orderIndex: finalOrderIndex,
      },
      include: {
        subCategories: true,
        _count: {
          select: { products: true, subCategories: true },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

