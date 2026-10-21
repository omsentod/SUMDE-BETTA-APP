import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { normalizeImages } from '@/lib/productImages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        variants: { orderBy: { displayOrder: 'asc' } },
      },
    });
    let filtered = products;
    if (category && category !== 'Semua') {
      filtered = products.filter(p => p.form.toLowerCase() === category.toLowerCase());
    }
    return NextResponse.json(filtered, {
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

export async function POST(request) {
  try {
    await requirePermission(request, 'products:manage');
    const {
      name, price, category, form, coloration, description,
      image, images, isPremium, statsForm, age, statsSpirit,
      quantity, variants, soldCount,
      videoUrl, isDailyDrop, dropNumber,
    } = await request.json();

    const gallery = normalizeImages(images, image);
    if (!name || price === undefined || !category || !form || !coloration || !description || gallery.length === 0) {
      return NextResponse.json({ error: 'Data produk tidak lengkap (minimal 1 foto).' }, { status: 400 });
    }

    const normalizedVariants = Array.isArray(variants) ? variants : [];
    const sizeSet = new Set();
    for (const v of normalizedVariants) {
      const s = (v.size || '').trim();
      if (!s) {
        return NextResponse.json({ error: 'Nama varian tidak boleh kosong.' }, { status: 400 });
      }
      if (sizeSet.has(s.toLowerCase())) {
        return NextResponse.json({ error: `Nama varian "${s}" tidak boleh duplikat.` }, { status: 400 });
      }
      sizeSet.add(s.toLowerCase());
    }

    const totalStock = normalizedVariants.length > 0
      ? normalizedVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
      : (parseInt(quantity) || 1);

    const newProduct = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        category,
        form,
        coloration,
        description,
        image: gallery[0],
        images: gallery,
        videoUrl: videoUrl || null,
        isDailyDrop: Boolean(isDailyDrop),
        dropNumber: dropNumber || null,
        isPremium: Boolean(isPremium),
        statsForm: statsForm || 'COMP',
        age: age || '4 Month',
        statsSpirit: statsSpirit || 'Aktif',
        quantity: totalStock,
        isSold: totalStock === 0,
        soldCount: soldCount !== undefined ? Math.max(0, parseInt(soldCount) || 0) : 0,
        variants: normalizedVariants.length > 0
          ? {
              create: normalizedVariants.map((v, idx) => ({
                size: v.size,
                stock: parseInt(v.stock) || 0,
                price: v.price !== undefined && v.price !== '' ? parseFloat(v.price) : null,
                imageUrl: v.imageUrl || null,
                displayOrder: idx,
              })),
            }
          : undefined,
      },
      include: {
        variants: { orderBy: { displayOrder: 'asc' } },
      },
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
