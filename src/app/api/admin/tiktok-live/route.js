import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import {
  ensureDefaultTikTokAccounts,
  generateClaimCode,
  generateClaimToken,
  LIVE_ITEM_PLACEHOLDER_IMAGE,
  normalizeTikTokUsername,
} from '@/lib/tiktokLive';

export const dynamic = 'force-dynamic';

function sanitizeImageUrl(raw) {
  const str = String(raw || '').trim();
  if (!str) return LIVE_ITEM_PLACEHOLDER_IMAGE;
  if (str.startsWith('/') || str.startsWith('https://') || str.startsWith('http://')) {
    return str.slice(0, 500);
  }
  return LIVE_ITEM_PLACEHOLDER_IMAGE;
}

export async function GET(request) {
  try {
    await requirePermission(request, ['events:view', 'events:manage', 'orders:view', 'products:view']);

    await ensureDefaultTikTokAccounts(prisma);

    const [accounts, baskets, catalogProducts] = await Promise.all([
      prisma.tikTokAccount.findMany({
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.tikTokLiveBasket.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: {
          tiktokAccount: { select: { id: true, name: true, handle: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              tiktokAccount: { select: { id: true, name: true, handle: true } },
              product: { select: { id: true, name: true, image: true } },
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              total: true,
              subtotal: true,
              shippingFee: true,
              trackingNumber: true,
              name: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        where: { isArchived: false, isSold: false, quantity: { gt: 0 } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          name: true,
          price: true,
          image: true,
          quantity: true,
          variants: {
            where: { stock: { gt: 0 } },
            orderBy: { displayOrder: 'asc' },
            select: { id: true, size: true, stock: true, price: true, imageUrl: true },
          },
        },
      }),
    ]);

    // Pastikan setiap keranjang lama/baru memiliki claimToken unik
    const missingTokenBaskets = baskets.filter((b) => !b.claimToken);
    if (missingTokenBaskets.length > 0) {
      await Promise.all(
        missingTokenBaskets.map(async (b) => {
          const token = generateClaimToken();
          b.claimToken = token;
          await prisma.tikTokLiveBasket.update({
            where: { id: b.id },
            data: { claimToken: token },
          });
        })
      );
    }

    return NextResponse.json({ accounts, baskets, catalogProducts });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  try {
    await requirePermission(request, ['events:manage', 'orders:update', 'products:manage']);

    const body = await request.json();
    const {
      tiktokUsername,
      tiktokAccountId,
      productId,
      variantId,
      selectedSize,
      name,
      price,
      quantity,
      image,
      note,
    } = body;

    const normUser = normalizeTikTokUsername(tiktokUsername);
    if (!normUser.ok) {
      return NextResponse.json({ error: normUser.error }, { status: 400 });
    }

    const parsedQty = parseInt(quantity ?? 1, 10);
    if (!Number.isInteger(parsedQty) || parsedQty <= 0 || parsedQty > 1000) {
      return NextResponse.json({ error: 'Kuantitas harus berupa angka bulat 1 - 1000.' }, { status: 400 });
    }

    let resolvedAccountId = null;
    if (tiktokAccountId) {
      const account = await prisma.tikTokAccount.findUnique({ where: { id: String(tiktokAccountId) } });
      if (!account) {
        return NextResponse.json({ error: 'Akun TikTok tidak ditemukan.' }, { status: 400 });
      }
      resolvedAccountId = account.id;
    }

    let resolvedProductId = null;
    let resolvedVariantId = null;
    let resolvedSize = selectedSize ? String(selectedSize).trim().slice(0, 60) : null;
    let resolvedName = String(name || '').trim().slice(0, 200);
    let resolvedPrice = Number(price);
    let resolvedImage = sanitizeImageUrl(image);

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: String(productId) },
        include: { variants: true },
      });
      if (!product || product.isArchived) {
        return NextResponse.json({ error: 'Produk katalog tidak ditemukan atau sudah diarsipkan.' }, { status: 400 });
      }
      resolvedProductId = product.id;

      if (product.variants && product.variants.length > 0) {
        const variant = variantId
          ? product.variants.find((v) => v.id === String(variantId))
          : product.variants.find((v) => v.size === resolvedSize);
        if (!variant) {
          return NextResponse.json({ error: 'Pilih varian ukuran produk terlebih dahulu.' }, { status: 400 });
        }
        if (variant.stock < parsedQty) {
          return NextResponse.json({ error: `Stok varian ${variant.size} tidak mencukupi (sisa ${variant.stock}).` }, { status: 400 });
        }
        resolvedVariantId = variant.id;
        resolvedSize = variant.size;
        if (!resolvedName) resolvedName = product.name;
        if (!Number.isFinite(resolvedPrice) || price === '' || price === null || price === undefined) {
          resolvedPrice = Number(variant.price ?? product.price);
        }
        if (!image) {
          resolvedImage = sanitizeImageUrl(variant.imageUrl || product.image);
        }
      } else {
        if (product.quantity < parsedQty) {
          return NextResponse.json({ error: `Stok produk tidak mencukupi (sisa ${product.quantity}).` }, { status: 400 });
        }
        if (!resolvedName) resolvedName = product.name;
        if (!Number.isFinite(resolvedPrice) || price === '' || price === null || price === undefined) {
          resolvedPrice = Number(product.price);
        }
        if (!image) {
          resolvedImage = sanitizeImageUrl(product.image);
        }
      }
    }

    if (!resolvedName) {
      return NextResponse.json({ error: 'Nama ikan / item wajib diisi.' }, { status: 400 });
    }
    if (!Number.isFinite(resolvedPrice) || resolvedPrice < 0 || resolvedPrice > 1_000_000_000) {
      return NextResponse.json({ error: 'Harga deal tidak valid.' }, { status: 400 });
    }
    const cleanPrice = Math.round(resolvedPrice);
    const cleanNote = note ? String(note).trim().slice(0, 300) : null;

    const updatedBasket = await prisma.$transaction(async (tx) => {
      let basket = await tx.tikTokLiveBasket.findFirst({
        where: { tiktokUsername: normUser.username, status: 'OPEN' },
      });

      if (!basket) {
        let claimCode = generateClaimCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const exists = await tx.tikTokLiveBasket.findUnique({ where: { claimCode } });
          if (!exists) break;
          claimCode = generateClaimCode();
        }
        basket = await tx.tikTokLiveBasket.create({
          data: {
            claimCode,
            claimToken: generateClaimToken(),
            tiktokUsername: normUser.username,
            tiktokAccountId: resolvedAccountId,
            status: 'OPEN',
          },
        });
      } else {
        await tx.tikTokLiveBasket.update({
          where: { id: basket.id },
          data: {
            updatedAt: new Date(),
            ...(!basket.claimToken ? { claimToken: generateClaimToken() } : {}),
            ...(resolvedAccountId && !basket.tiktokAccountId ? { tiktokAccountId: resolvedAccountId } : {}),
          },
        });
      }

      await tx.tikTokLiveItem.create({
        data: {
          basketId: basket.id,
          tiktokAccountId: resolvedAccountId,
          productId: resolvedProductId,
          variantId: resolvedVariantId,
          selectedSize: resolvedSize,
          name: resolvedName,
          price: cleanPrice,
          quantity: parsedQty,
          image: resolvedImage,
          note: cleanNote,
        },
      });

      return tx.tikTokLiveBasket.findUnique({
        where: { id: basket.id },
        include: {
          tiktokAccount: { select: { id: true, name: true, handle: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              tiktokAccount: { select: { id: true, name: true, handle: true } },
              product: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(updatedBasket, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
