'use client';

// Shopee-style vertical shipment timeline, in Indonesian. Biteship's history
// notes are in English, so we key off the machine-readable `status` code and
// render our own Indonesian label + description — falling back to the raw note
// only for unknown codes.

const STATUS_INFO = {
  confirmed:         { label: 'Pesanan Dikonfirmasi',  desc: 'Kurir telah dikonfirmasi untuk menjemput paket.' },
  allocated:         { label: 'Kurir Dialokasikan',    desc: 'Kurir siap menjemput paket.' },
  picking_up:        { label: 'Penjemputan Paket',     desc: 'Kurir sedang menuju lokasi penjemputan.' },
  picked:            { label: 'Paket Telah Diambil',   desc: 'Paket telah diambil oleh kurir.' },
  in_transit:        { label: 'Dalam Perjalanan',      desc: 'Paket sedang dalam perjalanan menuju alamat tujuan.' },
  dropping_off:      { label: 'Menuju Alamat Tujuan',  desc: 'Kurir sedang mengantar paket ke alamat tujuan.' },
  delivered:         { label: 'Pesanan Diterima',      desc: 'Paket telah sampai di alamat tujuan.' },
  cancelled:         { label: 'Pengiriman Dibatalkan', desc: 'Pengiriman dibatalkan.' },
  rejected:          { label: 'Pengiriman Ditolak',    desc: 'Pengiriman ditolak oleh kurir.' },
  on_hold:           { label: 'Pengiriman Tertunda',   desc: 'Pengiriman tertunda sementara karena kendala.' },
  return_in_transit: { label: 'Dalam Proses Retur',    desc: 'Paket sedang dikembalikan ke pengirim.' },
  returned:          { label: 'Paket Dikembalikan',    desc: 'Paket telah dikembalikan ke pengirim.' },
  disposed:          { label: 'Paket Dimusnahkan',     desc: 'Paket telah dimusnahkan.' },
};

// Codes that read as a "success/terminal-good" step get a green accent when
// they're the current (top) step; everything else in-progress uses the brand
// primary; failures use a red-ish muted tone.
const GOOD_TERMINAL = new Set(['delivered']);
const BAD_TERMINAL = new Set(['cancelled', 'rejected', 'returned', 'disposed']);

function infoFor(h) {
  return STATUS_INFO[h.status] || { label: 'Update Pengiriman', desc: h.note || '' };
}

function formatWhen(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function ShipmentTracker({ history = [], waybill, courier }) {
  // Biteship returns oldest → newest; Shopee shows newest on top.
  const items = [...history].reverse();

  const topStatus = items[0]?.status;
  const activeColor = GOOD_TERMINAL.has(topStatus)
    ? '#16a34a'
    : BAD_TERMINAL.has(topStatus)
      ? '#dc2626'
      : 'var(--primary)';

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1.15rem 1.25rem',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Header: courier + waybill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>Lacak Pengiriman</span>
        </div>
        <div style={{ textAlign: 'right', lineHeight: 1.35 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {(courier || '').toUpperCase()}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{waybill}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Belum ada riwayat pelacakan. Status akan muncul setelah kurir memproses paket.
        </div>
      ) : (
        <div>
          {items.map((h, idx) => {
            const info = infoFor(h);
            const when = formatWhen(h.updated_at);
            const isActive = idx === 0;
            const isLast = idx === items.length - 1;
            const dotColor = isActive ? activeColor : 'var(--border-color)';

            return (
              <div key={idx} style={{ display: 'flex', gap: '0.85rem' }}>
                {/* Rail: dot + connecting line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '18px', flexShrink: 0 }}>
                  <div
                    style={{
                      width: isActive ? '14px' : '10px',
                      height: isActive ? '14px' : '10px',
                      borderRadius: '50%',
                      background: isActive ? dotColor : 'var(--bg-card)',
                      border: `2px solid ${isActive ? dotColor : 'var(--border-color)'}`,
                      boxShadow: isActive ? `0 0 0 4px color-mix(in oklab, ${activeColor} 18%, transparent)` : 'none',
                      marginTop: isActive ? '2px' : '4px',
                      transition: 'all 0.2s ease',
                    }}
                  />
                  {!isLast && (
                    <div style={{ flex: 1, width: '2px', background: 'var(--border-color)', marginTop: '2px', minHeight: '28px' }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ paddingBottom: isLast ? 0 : '1.15rem', flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: isActive ? 700 : 600, color: isActive ? activeColor : 'var(--text-main)' }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                    {info.desc}
                  </div>
                  {(when.date || when.time) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', opacity: 0.85 }}>
                      {when.date}{when.date && when.time ? ' • ' : ''}{when.time}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
