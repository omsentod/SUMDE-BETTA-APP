import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// Revenue-generating statuses. PENDING (belum bayar), CANCELLED, RETURNED
// dianggap tidak menghasilkan revenue.
const REVENUE_STATUSES = ['PROCESSING', 'SHIPPED', 'COMPLETED'];

// Parse ISO date from query. Fallback 30 hari terakhir kalau tidak ada.
function parseRange(searchParams) {
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const from = fromRaw ? new Date(fromRaw) : defaultFrom;
  const to = toRaw ? new Date(toRaw) : now;

  // Normalize ke awal hari (from) dan akhir hari (to) di timezone server.
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Format tanggal YYYY-MM-DD untuk grouping harian.
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const { from, to } = parseRange(searchParams);

    // Fetch semua order di periode. Kalau volume besar (>10k/bulan) nanti
    // migrate ke SQL aggregation langsung. Untuk sekarang in-memory cukup.
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    // KPI — hanya hitung dari order yang menghasilkan revenue.
    const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const totalRevenue = revenueOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const orderCount = revenueOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
    const uniqueCustomers = new Set(revenueOrders.map((o) => o.email || o.userId).filter(Boolean)).size;

    // Revenue per hari — semua tanggal dalam range diisi (0 kalau tidak ada order).
    const revenueByDay = {};
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      revenueByDay[dayKey(d)] = { revenue: 0, orders: 0 };
    }
    for (const o of revenueOrders) {
      const key = dayKey(new Date(o.createdAt));
      if (revenueByDay[key]) {
        revenueByDay[key].revenue += o.total || 0;
        revenueByDay[key].orders += 1;
      }
    }
    const revenueByDayArr = Object.entries(revenueByDay).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      orders: v.orders,
    }));

    // Top produk: agregasi qty + revenue per productId.
    const productAgg = {};
    for (const o of revenueOrders) {
      for (const item of o.items) {
        const pid = item.productId;
        const pname = item.product?.name || 'Produk dihapus';
        if (!productAgg[pid]) {
          productAgg[pid] = { productId: pid, name: pname, quantity: 0, revenue: 0 };
        }
        productAgg[pid].quantity += item.quantity;
        productAgg[pid].revenue += (item.price || 0) * item.quantity;
      }
    }
    const topProducts = Object.values(productAgg)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Breakdown status — semua order termasuk PENDING/CANCELLED/RETURNED.
    const statusBreakdown = {
      PENDING: 0, PROCESSING: 0, SHIPPED: 0, COMPLETED: 0, CANCELLED: 0, RETURNED: 0,
    };
    for (const o of orders) {
      if (statusBreakdown[o.status] !== undefined) statusBreakdown[o.status] += 1;
    }

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      kpi: { totalRevenue, orderCount, avgOrderValue, uniqueCustomers },
      revenueByDay: revenueByDayArr,
      topProducts,
      statusBreakdown,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
