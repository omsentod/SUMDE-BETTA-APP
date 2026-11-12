import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { consume, clientIp } from '@/lib/rateLimit';

function phoneMatches(p1, p2) {
  if (!p1 || !p2) return false;
  let d1 = String(p1).replace(/\D/g, '');
  let d2 = String(p2).replace(/\D/g, '');
  if (d1 === d2) return true;
  if (d1.startsWith('62')) d1 = '0' + d1.slice(2);
  if (d2.startsWith('62')) d2 = '0' + d2.slice(2);
  return d1 === d2;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('email') || searchParams.get('phone');

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            variant: {
              select: {
                id: true,
                size: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }

    // Auth check:
    // 1. Session check (Pemilik akun yang login atau Admin / Staff)
    const session = await getSession(request);
    let isAuthorized = false;

    if (session) {
      const canManageOrders = session.role === 'admin' || (await hasPermission(session.role, 'orders:view'));
      if (order.userId === session.id || canManageOrders) {
        isAuthorized = true;
      }
    }

    // 2. Guest verification: Verifikasi via email atau nomor HP pemesan dengan rate limiting
    if (!isAuthorized && identifier) {
      const ip = clientIp(request);
      const rl = consume(`invoice-lookup:${ip}`, { limit: 20, windowMs: 60 * 1000 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat lagi.' },
          { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
        );
      }

      const cleanIdent = String(identifier).trim().toLowerCase();
      const emailMatches = order.email && order.email.toLowerCase() === cleanIdent;
      const phoneMatched = phoneMatches(order.phone, cleanIdent);

      if (emailMatches || phoneMatched) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Akses ditolak. Silakan login atau verifikasi dengan email pemesan.' },
        { status: 403 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
