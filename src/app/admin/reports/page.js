'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import styles from './reports.module.css';

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

const formatInt = (v) => new Intl.NumberFormat('id-ID').format(v || 0);

// Format YYYY-MM-DD (input date-picker HTML)
const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const presets = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'custom', label: 'Custom' },
];

function computeRange(preset, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now);
  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (preset === '7d') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (preset === '30d') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (preset === 'custom') {
    const from = customFrom ? new Date(customFrom) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = customTo ? new Date(customTo) : now;
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  return { from: start, to: now };
}

// Format tanggal singkat untuk sumbu X chart.
const formatDayShort = (iso) => {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}`;
};

const STATUS_LABELS = {
  PENDING: 'Menunggu Bayar',
  PROCESSING: 'Diproses',
  SHIPPED: 'Dikirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Retur',
};

export default function AdminReportsPage() {
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const url = `/api/admin/reports?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal memuat laporan');
        const data = await res.json();
        if (!cancelled) setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [range]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const url = `/api/admin/reports/export?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
      // Fetch dulu untuk trigger auth check; kalau OK, browser download via anchor.
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal export');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      // Cari filename dari header, fallback ke default.
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : 'laporan.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  const maxStatus = useMemo(() => {
    if (!report) return 1;
    return Math.max(1, ...Object.values(report.statusBreakdown || {}));
  }, [report]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Laporan Penjualan</h1>
          <p className={styles.subtitle}>Ringkasan revenue, order, dan produk terlaris per periode.</p>
        </div>
      </div>

      <div className={styles.controls}>
        {presets.map((p) => (
          <button
            key={p.key}
            className={`${styles.presetBtn} ${preset === p.key ? styles.presetActive : ''}`.trim()}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className={styles.customRange}>
            <input
              type="date"
              value={customFrom || toDateInput(range.from)}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)' }}>–</span>
            <input
              type="date"
              value={customTo || toDateInput(range.to)}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
        <button
          className={styles.exportBtn}
          onClick={handleExport}
          disabled={exporting || !report}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Menyiapkan...' : 'Download Excel'}
        </button>
      </div>

      {loading && <div className={styles.loading}>Memuat laporan...</div>}

      {!loading && report && (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Total Pendapatan</div>
              <div className={styles.kpiValue}>{formatIDR(report.kpi.totalRevenue)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Jumlah Pesanan</div>
              <div className={styles.kpiValue}>{formatInt(report.kpi.orderCount)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Rata-rata / Pesanan</div>
              <div className={styles.kpiValue}>{formatIDR(report.kpi.avgOrderValue)}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Pelanggan Unik</div>
              <div className={styles.kpiValue}>{formatInt(report.kpi.uniqueCustomers)}</div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Revenue per Hari</div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer>
                <BarChart data={report.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tickFormatter={formatDayShort} stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : v)} />
                  <Tooltip
                    formatter={(v) => formatIDR(v)}
                    labelFormatter={(l) => new Date(l).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Top 10 Produk</div>
              {report.topProducts.length === 0 ? (
                <div className={styles.empty}>Belum ada penjualan di periode ini.</div>
              ) : (
                <table className={styles.topTable}>
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th className="num" style={{ textAlign: 'right' }}>Qty</th>
                      <th className="num" style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td>{p.name}</td>
                        <td className={styles.num || 'num'} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.quantity}</td>
                        <td className={styles.num || 'num'} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatIDR(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Breakdown Status</div>
              {Object.entries(report.statusBreakdown).map(([status, count]) => (
                <div key={status} className={styles.statusRow}>
                  <div className={styles.statusLabel}>{STATUS_LABELS[status] || status}</div>
                  <div className={styles.statusBar}>
                    <div className={styles.statusBarFill} style={{ width: `${(count / maxStatus) * 100}%` }} />
                  </div>
                  <div className={styles.statusCount}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
