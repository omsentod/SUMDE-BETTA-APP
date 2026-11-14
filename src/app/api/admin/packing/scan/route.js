import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/permissions';
import { notifyAllAdmins } from '@/lib/notification';

export async function POST(request) {
  try {
    const user = await requirePermission(request, [
      'shipping:packing',
      'shipping:manage',
      'orders:view',
    ]);

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'pack').toLowerCase(); // 'bag' | 'pack' | 'undo'
    const staffName = user?.name || user?.email || 'Tim Packing';

    // Dukungan aksi bulk bungkus ikan sampel (gabungan beberapa pesanan sejenis)
    if (action === 'bag' && Array.isArray(body.orderIds) && body.orderIds.length > 0) {
      const validOrderIds = body.orderIds
        .map((id) => String(id || '').trim())
        .filter((id) => id.length >= 3 && id.length <= 100);

      if (validOrderIds.length > 0) {
        await prisma.order.updateMany({
          where: {
            id: { in: validOrderIds },
            packingStatus: 'PENDING',
          },
          data: {
            packingStatus: 'BAGGED',
            status: 'PROCESSING',
            baggedAt: new Date(),
            baggedBy: staffName,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'bag',
          bulk: true,
          count: validOrderIds.length,
          message: body.fishLabel
            ? `✓ ${body.fishLabel} selesai dibungkus! Siap lanjut ke meja pack box.`
            : `✓ ${validOrderIds.length} pesanan selesai dibungkus plastik oksigen.`,
        });
      }
    }

    const rawCode = String(body.code || '').trim();

    if (!rawCode || rawCode.length < 3) {
      return NextResponse.json(
        { error: 'Kode pesanan atau barcode tidak valid.' },
        { status: 400 }
      );
    }

    if (rawCode.length > 100) {
      return NextResponse.json(
        { error: 'Kode barcode terlalu panjang.' },
        { status: 400 }
      );
    }

    // Cari pesanan berdasarkan ID, awalan ID (slice(0, 18)), atau nomor resi kurir
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: rawCode },
          { id: { startsWith: rawCode } },
          { trackingNumber: rawCode },
          { biteshipShipmentId: rawCode },
        ],
      },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            customName: true,
            customImage: true,
            selectedSize: true,
            variant: {
              select: {
                imageUrl: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                brand: true,
                department: {
                  select: {
                    isLiveFish: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          error: `Pesanan dengan kode "${rawCode}" tidak ditemukan. Pastikan barcode terbaca jelas.`,
        },
        { status: 404 }
      );
    }

    // 1. Aksi Pembatalan (Undo)
    if (action === 'undo') {
      let targetStatus = 'PENDING';
      let updateData = {
        packingStatus: 'PENDING',
        baggedAt: null,
        baggedBy: null,
        packedAt: null,
        packedBy: null,
      };

      // Jika sebelumnya READY_FOR_PICKUP tapi pernah di-bag, kembalikan ke BAGGED
      if (order.packingStatus === 'READY_FOR_PICKUP' && order.baggedAt) {
        targetStatus = 'BAGGED';
        updateData = {
          packingStatus: 'BAGGED',
          packedAt: null,
          packedBy: null,
        };
      }

      const reverted = await prisma.order.update({
        where: { id: order.id },
        data: updateData,
        include: {
          items: {
            select: {
              id: true,
              quantity: true,
              customName: true,
              customImage: true,
              selectedSize: true,
              variant: {
                select: {
                  imageUrl: true,
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  brand: true,
                  department: {
                    select: {
                      isLiveFish: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        action: 'undo',
        order: reverted,
        message: `Status pesanan ${order.name} dikembalikan ke ${
          targetStatus === 'BAGGED' ? 'antrean siap masuk kardus/box' : 'antrean bungkus plastik'
        }.`,
      });
    }

    // 2. Pemeriksaan Guard Integritas
    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        {
          error: `PERHATIAN: Pesanan ${order.id} telah DIBATALKAN. Jangan serahkan paket ini ke kurir!`,
        },
        { status: 400 }
      );
    }

    if (order.status === 'SHIPPED' || order.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        alreadyShipped: true,
        order,
        message: `Paket ini sudah diserahkan ke ekspedisi (${order.status}).`,
      });
    }

    // 3. Aksi: TAHAP 1 — Tim Bungkus Plastik Ikan
    if (action === 'bag') {
      const nextStatus = order.status === 'PAID' ? 'PROCESSING' : order.status;
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          packingStatus: 'BAGGED',
          status: nextStatus,
          baggedAt: new Date(),
          baggedBy: staffName,
        },
        include: {
          items: {
            select: {
              id: true,
              quantity: true,
              customName: true,
              customImage: true,
              selectedSize: true,
              variant: {
                select: {
                  imageUrl: true,
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  brand: true,
                  department: {
                    select: {
                      isLiveFish: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        action: 'bag',
        order: updated,
        message: `✓ Ikan pesanan ${order.name} selesai dibungkus plastik oksigen! Oper ke tim packing box.`,
      });
    }

    // 4. Aksi: TAHAP 2 — Tim Pack Box / Scan Resi Fisik
    if (order.packingStatus === 'READY_FOR_PICKUP') {
      const timeFormatted = order.packedAt
        ? new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          }).format(new Date(order.packedAt))
        : '';

      return NextResponse.json({
        success: true,
        alreadyPacked: true,
        order,
        message: `Paket ini sudah pernah di-scan sebelumnya${
          timeFormatted ? ` pada ${timeFormatted}` : ''
        }${order.packedBy ? ` oleh ${order.packedBy}` : ''}.`,
      });
    }

    const nextStatus = order.status === 'PAID' ? 'PROCESSING' : order.status;
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        packingStatus: 'READY_FOR_PICKUP',
        status: nextStatus,
        packedAt: new Date(),
        packedBy: staffName,
      },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            customName: true,
            customImage: true,
            selectedSize: true,
            variant: {
              select: {
                imageUrl: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                brand: true,
                department: {
                  select: {
                    isLiveFish: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    notifyAllAdmins({
      type: 'order.ready_for_pickup',
      title: 'Paket Siap Dijemput Kurir',
      body: `Pesanan #${order.id.slice(0, 8)} (${order.name}) siap dijemput kurir ${order.shippingCourier ? `(${order.shippingCourier.toUpperCase()})` : ''}.`,
      link: '/admin/orders?status=READY_FOR_PICKUP',
    }).catch((err) => console.warn('Gagal broadcast notifikasi ready for pickup:', err.message));

    return NextResponse.json({
      success: true,
      action: 'pack',
      order: updated,
      message: `✓ Selesai! Paket ${order.name} (${order.shippingCourier || 'Kurir'}) siap dijemput ekspedisi.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Gagal memproses status packing.' },
      { status: error.status || 500 }
    );
  }
}
