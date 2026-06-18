import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { items: { include: { product: true } }, user: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, total, status, name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode, items } = await request.json();
    if (!name || !email || !phone || !streetAddress || !rtRw || !province || !city || !district || !village || !postalCode || !items || items.length === 0) {
      return NextResponse.json({ error: 'Detail pesanan tidak lengkap.' }, { status: 400 });
    }
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: { userId: userId || null, total: parseFloat(total), status: status || 'PENDING', name, email, phone, streetAddress, rtRw, province, city, district, village, postalCode }
      });
      for (const item of items) {
        await tx.orderItem.create({
          data: { orderId: newOrder.id, productId: item.productId || item.id, quantity: parseInt(item.quantity) || 1, price: parseFloat(item.price) }
        });
        
        const product = await tx.product.findUnique({ where: { id: item.productId || item.id } });
        if (product) {
          let updatedSizes = [];
          if (product.sizes && Array.isArray(product.sizes)) {
            updatedSizes = product.sizes.map((s) => {
              if (s.size === item.selectedSize) {
                const newQty = Math.max(0, s.quantity - (parseInt(item.quantity) || 1));
                return { ...s, quantity: newQty };
              }
              return s;
            });
          }
          
          let newTotalQty = 0;
          if (updatedSizes.length > 0) {
            newTotalQty = updatedSizes.reduce((sum, s) => sum + s.quantity, 0);
          } else {
            newTotalQty = Math.max(0, product.quantity - (parseInt(item.quantity) || 1));
          }
          
          await tx.product.update({
            where: { id: product.id },
            data: {
              sizes: updatedSizes.length > 0 ? updatedSizes : undefined,
              quantity: newTotalQty,
              isSold: newTotalQty === 0
            }
          });
        }
      }
      return newOrder;
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
