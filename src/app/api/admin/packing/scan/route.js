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

    // Dukungan aksi bulk pack box (banyak paket sekaligus selesai dikemas)
    if (action === 'pack' && Array.isArray(body.orderIds) && body.orderIds.length > 0) {
      const validOrderIds = body.orderIds
        .map((id) => String(id || '').trim())
        .filter((id) => id.length >= 3 && id.length <= 100);

      if (validOrderIds.length > 0) {
        await prisma.order.updateMany({
          where: {
            id: { in: validOrderIds },
            packingStatus: 'BAGGED',
          },
          data: {
            packingStatus: 'READY_FOR_PICKUP',
            status: 'PROCESSING',
            packedAt: new Date(),
            packedBy: staffName,
          },
        });

        notifyAllAdmins({
          type: 'order.ready_for_pickup',
          title: 'Paket Siap Dijemput Kurir',
          body: `${validOrderIds.length} paket telah selesai di-pack box dan siap dijemput kurir ekspedisi.`,
          link: '/admin/orders?status=READY_FOR_PICKUP',
        }).catch((err) => console.warn('Gagal broadcast notifikasi ready for pickup bulk:', err.message));

        return NextResponse.json({
          success: true,
          action: 'pack',
          bulk: true,
          count: validOrderIds.length,
          message: `✓ ${validOrderIds.length} paket selesai dikemas box & siap dijemput kurir!`,
        });
      }
    }

    // Dukungan aksi bulk undo / memindahkan ke pos sebelumnya
    if (action === 'undo' && Array.isArray(body.orderIds) && body.orderIds.length > 0) {
      const validOrderIds = body.orderIds
        .map((id) => String(id || '').trim())
        .filter((id) => id.length >= 3 && id.length <= 100);

      if (validOrderIds.length > 0) {
        const fromStage = body.fromStage || body.stage; // 'boxing' | 'ready' | 'shipped'

        if (fromStage === 'boxing') {
          // Pos 2 -> Pos 1: Kembalikan BAGGED ke PENDING
          await prisma.order.updateMany({
            where: {
              id: { in: validOrderIds },
              packingStatus: 'BAGGED',
            },
            data: {
              packingStatus: 'PENDING',
              baggedAt: null,
              baggedBy: null,
            },
          });

          return NextResponse.json({
            success: true,
            action: 'undo',
            bulk: true,
            count: validOrderIds.length,
            message: `${validOrderIds.length} pesanan berhasil dikembalikan ke Pos 1 (Bungkus Ikan).`,
          });
        }

        if (fromStage === 'ready') {
          // Pos 3 -> Pos 2: Kembalikan READY_FOR_PICKUP ke BAGGED
          await prisma.order.updateMany({
            where: {
              id: { in: validOrderIds },
              packingStatus: 'READY_FOR_PICKUP',
            },
            data: {
              packingStatus: 'BAGGED',
              packedAt: null,
              packedBy: null,
            },
          });

          return NextResponse.json({
            success: true,
            action: 'undo',
            bulk: true,
            count: validOrderIds.length,
            message: `${validOrderIds.length} paket berhasil dikembalikan ke Pos 2 (Antrean Pack Box).`,
          });
        }

        if (fromStage === 'shipped') {
          // Pos 4 -> Pos 3: Kembalikan SHIPPED ke READY_FOR_PICKUP (status dikembalikan ke PROCESSING)
          await prisma.order.updateMany({
            where: {
              id: { in: validOrderIds },
              status: 'SHIPPED',
            },
            data: {
              status: 'PROCESSING',
              packingStatus: 'READY_FOR_PICKUP',
            },
          });

          return NextResponse.json({
            success: true,
            action: 'undo',
            bulk: true,
            count: validOrderIds.length,
            message: `${validOrderIds.length} paket berhasil dikembalikan ke Pos 3 (Siap Pickup Kurir).`,
          });
        }

        // Fallback jika fromStage tidak dikirim:
        // Cek status terkini masing-masing pesanan agar tidak terjadi loncat 2 tahap
        const ordersToRevert = await prisma.order.findMany({
          where: { id: { in: validOrderIds } },
          select: { id: true, packingStatus: true, status: true },
        });

        const readyIds = ordersToRevert.filter((o) => o.packingStatus === 'READY_FOR_PICKUP').map((o) => o.id);
        const baggedIds = ordersToRevert.filter((o) => o.packingStatus === 'BAGGED').map((o) => o.id);
        const shippedIds = ordersToRevert.filter((o) => o.status === 'SHIPPED').map((o) => o.id);

        if (readyIds.length > 0) {
          await prisma.order.updateMany({
            where: { id: { in: readyIds } },
            data: { packingStatus: 'BAGGED', packedAt: null, packedBy: null },
          });
        }
        if (baggedIds.length > 0) {
          await prisma.order.updateMany({
            where: { id: { in: baggedIds } },
            data: { packingStatus: 'PENDING', baggedAt: null, baggedBy: null },
          });
        }
        if (shippedIds.length > 0) {
          await prisma.order.updateMany({
            where: { id: { in: shippedIds } },
            data: { status: 'PROCESSING', packingStatus: 'READY_FOR_PICKUP' },
          });
        }

        return NextResponse.json({
          success: true,
          action: 'undo',
          bulk: true,
          count: validOrderIds.length,
          message: `${validOrderIds.length} pesanan berhasil dipindahkan ke pos sebelumnya.`,
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

      if (order.status === 'SHIPPED') {
        targetStatus = 'READY_FOR_PICKUP';
        updateData = {
          status: 'PROCESSING',
          packingStatus: 'READY_FOR_PICKUP',
        };
      } else if (order.packingStatus === 'READY_FOR_PICKUP' && order.baggedAt) {
        // Jika sebelumnya READY_FOR_PICKUP tapi pernah di-bag, kembalikan ke BAGGED
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
