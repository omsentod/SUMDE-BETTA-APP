import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import * as XLSX from 'xlsx';

const REVENUE_STATUSES = new Set(['PROCESSING', 'SHIPPED', 'COMPLETED']);

function parseRange(searchParams) {
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = fromRaw ? new Date(fromRaw) : defaultFrom;
  const to = toRaw ? new Date(toRaw) : now;
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const { from, to } = parseRange(searchParams);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    });

    // Sheet 1: Ringkasan (KPI summary)
    const revenueOrders = orders.filter((o) => REVENUE_STATUSES.has(o.status));
    const totalRevenue = revenueOrders.reduce((s, o) => s + (o.total || 0), 0);
    const orderCount = revenueOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;
    const uniqueCustomers = new Set(revenueOrders.map((o) => o.email || o.userId).filter(Boolean)).size;

    const ringkasanRows = [
      ['Laporan Penjualan SUMDE BETTA'],
      [],
      ['Periode', `${from.toLocaleDateString('id-ID')} - ${to.toLocaleDateString('id-ID')}`],
      ['Generated', new Date().toLocaleString('id-ID')],
      [],
      ['Total Pendapatan', totalRevenue],
      ['Jumlah Pesanan', orderCount],
      ['Rata-rata per Pesanan', avgOrderValue],
      ['Pelanggan Unik', uniqueCustomers],
      [],
      ['Catatan: pendapatan hanya menghitung status PROCESSING, SHIPPED, COMPLETED. PENDING/CANCELLED/RETURNED dieksklusi.'],
    ];

    // Sheet 2: Detail transaksi
    const detailHeader = [
      'ID Pesanan', 'Tanggal', 'Nama Customer', 'Email', 'Telepon',
      'Status', 'Subtotal', 'Ongkir', 'Total',
      'Kurir', 'Servis', 'AWB', 'Alamat',
    ];
    const detailRows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toLocaleString('id-ID'),
      o.name,
      o.email,
      o.phone,
      o.status,
      o.subtotal || 0,
      o.shippingFee || 0,
      o.total || 0,
      o.shippingCourier || '',
      o.shippingService || '',
      o.trackingNumber || '',
      `${o.streetAddress}, ${o.village}, ${o.district}, ${o.city}, ${o.province} ${o.postalCode}`,
    ]);

    const wb = XLSX.utils.book_new();

    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanRows);
    wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    wsDetail['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 28 }, { wch: 15 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Transaksi');

    // Generate binary buffer (Node.js).
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `laporan-${fmtDate(from)}-${fmtDate(to)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.byteLength),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
