import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        subCategories: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: {
                products: {
                  where: { isArchived: false },
                },
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: { isArchived: false },
            },
          },
        },
      },
    });

    return NextResponse.json(departments, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

