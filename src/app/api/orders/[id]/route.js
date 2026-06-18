import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { status } = await request.json();
    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } }
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
