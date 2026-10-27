import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { normalizeImages, findCoverImage } from '@/lib/productImages';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await requirePermission(request, 'products:manage');
    const { id } = await params;
    const {
      name, price, category, form, coloration, description,
      image, images, isPremium, statsForm, age, statsSpirit,
      isSold, quantity, variants, soldCount, isArchived,
      videoUrl, isDailyDrop, dropNumber,
    } = await request.json();

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (category !== undefined) dataToUpdate.category = category;
    if (form !== undefined) dataToUpdate.form = form;
    if (coloration !== undefined) dataToUpdate.coloration = coloration;
    if (description !== undefined) dataToUpdate.description = description;
    if (videoUrl !== undefined) dataToUpdate.videoUrl = videoUrl;
    if (isDailyDrop !== undefined) dataToUpdate.isDailyDrop = Boolean(isDailyDrop);
    if (dropNumber !== undefined) dataToUpdate.dropNumber = dropNumber;

    if (images !== undefined) {
      const gallery = normalizeImages(images, image, videoUrl);
      const coverImage = findCoverImage(gallery, image);
      if (gallery.length === 0) {
        return NextResponse.json({ error: 'Produk harus punya minimal 1 foto.' }, { status: 400 });
      }
      dataToUpdate.images = gallery;
      dataToUpdate.image = coverImage;
    } else if (image !== undefined) {
      const gallery = normalizeImages([image], image, videoUrl);
      dataToUpdate.image = findCoverImage(gallery, image);
      dataToUpdate.images = gallery;
    }

    if (isPremium !== undefined) dataToUpdate.isPremium = Boolean(isPremium);
    if (statsForm !== undefined) dataToUpdate.statsForm = statsForm;
    if (age !== undefined) dataToUpdate.age = age;
    if (statsSpirit !== undefined) dataToUpdate.statsSpirit = statsSpirit;
    if (isSold !== undefined) dataToUpdate.isSold = Boolean(isSold);
    if (soldCount !== undefined) dataToUpdate.soldCount = Math.max(0, parseInt(soldCount) || 0);
    if (isArchived !== undefined) dataToUpdate.isArchived = Boolean(isArchived);

    if (Array.isArray(variants)) {
      if (variants.length > 0) {
        const sizeSet = new Set();
        for (const v of variants) {
          const s = (v.size || '').trim();
          if (!s) {
            return NextResponse.json({ error: 'Nama varian tidak boleh kosong.' }, { status: 400 });
          }
          if (sizeSet.has(s.toLowerCase())) {
            return NextResponse.json({ error: `Nama varian "${s}" tidak boleh duplikat.` }, { status: 400 });
          }
          sizeSet.add(s.toLowerCase());
        }

        const totalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        dataToUpdate.quantity = totalStock;
        dataToUpdate.isSold = totalStock === 0;

        const existingVariants = await prisma.productVariant.findMany({ where: { productId: id } });
        const existingIds = new Set(existingVariants.map(v => v.id));
        const incomingIds = new Set(variants.filter(v => v.id).map(v => v.id));
        const toDelete = [...existingIds].filter(vid => !incomingIds.has(vid));

        await prisma.$transaction([
          ...(toDelete.length > 0
            ? [prisma.productVariant.deleteMany({ where: { id: { in: toDelete } } })]
            : []),
          ...variants.map((v, idx) =>
            v.id
              ? prisma.productVariant.update({
                  where: { id: v.id },
                  data: {
                    size: v.size,
                    stock: parseInt(v.stock) || 0,
                    price: v.price !== undefined && v.price !== '' ? parseFloat(v.price) : null,
                    imageUrl: v.imageUrl || null,
                    displayOrder: idx,
                  },
                })
              : prisma.productVariant.create({
                  data: {
                    productId: id,
                    size: v.size,
                    stock: parseInt(v.stock) || 0,
                    price: v.price !== undefined && v.price !== '' ? parseFloat(v.price) : null,
                    imageUrl: v.imageUrl || null,
                    displayOrder: idx,
                  },
                })
          ),
          prisma.product.update({ where: { id }, data: dataToUpdate }),
        ]);
      } else {
        // Varian kosong (misal produk diubah menjadi produk tunggal tanpa varian)
        const qty = quantity !== undefined ? Math.max(0, parseInt(quantity) || 0) : 0;
        dataToUpdate.quantity = qty;
        dataToUpdate.isSold = qty === 0;

        await prisma.$transaction([
          prisma.productVariant.deleteMany({ where: { productId: id } }),
          prisma.product.update({ where: { id }, data: dataToUpdate }),
        ]);
      }
    } else {
      if (quantity !== undefined) {
        const qty = Math.max(0, parseInt(quantity) || 0);
        dataToUpdate.quantity = qty;
        dataToUpdate.isSold = qty === 0;
      }
      await prisma.product.update({ where: { id }, data: dataToUpdate });
    }

    const updatedProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { displayOrder: 'asc' } } },
    });
    return NextResponse.json(updatedProduct);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await requirePermission(request, ['products:manage', 'products:delete']);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (!permanent) {
      // Soft-delete default: Pindahkan ke Recycle Bin (isArchived: true)
      await prisma.product.update({ where: { id }, data: { isArchived: true } });
      return NextResponse.json({ message: 'Produk dipindahkan ke Recycle Bin.', archived: true });
    }

    // Permanent delete: Lindungi integritas invoice jika ada riwayat pesanan
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      return NextResponse.json(
        { error: 'Produk tidak dapat dihapus permanen karena terdapat riwayat pesanan (invoice). Produk tetap tersimpan di Recycle Bin.' },
        { status: 400 }
      );
    }
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ message: 'Produk berhasil dihapus secara permanen.', archived: false });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
