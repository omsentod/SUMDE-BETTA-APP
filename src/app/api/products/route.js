import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    let filtered = products;
    if (category && category !== 'Semua') {
      filtered = products.filter(p => p.form.toLowerCase() === category.toLowerCase());
    }
    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, price, category, gender, form, coloration, description, image, isPremium, statsForm, statsColor, statsSpirit } = await request.json();
    if (!name || price === undefined || !category || !gender || !form || !coloration || !description || !image) {
      return NextResponse.json({ error: 'Data produk tidak lengkap.' }, { status: 400 });
    }
    const newProduct = await prisma.product.create({
      data: {
        name, price: parseFloat(price), category, gender, form, coloration, description, image,
        isPremium: Boolean(isPremium),
        statsForm: statsForm || '9.0/10',
        statsColor: statsColor || '9.0/10',
        statsSpirit: statsSpirit || 'Aktif',
        isSold: false
      }
    });
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
