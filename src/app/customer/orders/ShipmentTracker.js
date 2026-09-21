'use client';

import styles from './tracker.module.css';

// Shopee / Tokopedia style shipment timeline in Indonesian.
// Biteship sends courier updates via `history: [{ status, note, updated_at }]`.
// Real couriers (J&T, JNE, SiCepat, Pos) include sorting centers, hubs, drop points,
// or recipient names inside `note`. If present, we display that real courier info!
// Generic Biteship English templates are automatically translated to friendly Indonesian.

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

const BITESHIP_TRANSLATIONS = {
  'courier order is confirmed': 'Pesanan pengiriman telah dikonfirmasi oleh kurir.',
  'courier is allocated and ready to pick up': 'Kurir siap menjemput paket dari penjual.',
  'courier is on the way to pick up location': 'Kurir sedang menuju lokasi penjemputan paket.',
  'item has been picked by courier': 'Paket telah diambil oleh kurir.',
  'item is on the way to destination': 'Paket sedang dalam perjalanan menuju alamat tujuan.',
  'courier is dropping off item to destination': 'Kurir sedang mengantar paket ke alamat tujuan.',
  'order has been delivered': 'Paket telah sampai di alamat tujuan dan diterima.',
  'delivery is on hold': 'Pengiriman tertunda sementara karena kendala operasional.',
  'shipment is cancelled': 'Pengiriman telah dibatalkan.',
  'shipment is rejected': 'Pengiriman ditolak oleh pihak kurir.',
  'shipment is returned': 'Paket telah dikembalikan ke pengirim.',
};

const GOOD_TERMINAL = new Set(['delivered']);
const BAD_TERMINAL = new Set(['cancelled', 'rejected', 'returned', 'disposed']);

function isSameTrackingStep(a, b) {
  if (!a || !b) return false;
  const statusSame = a.status === b.status;
  const noteSame =
    String(a.note ?? '').trim().toLowerCase() ===
    String(b.note ?? '').trim().toLowerCase();
  return statusSame && noteSame;
}

// Client-side defensive collapse: collapses both consecutive duplicates
// and alternating ping-pong cycles without losing distinct location checkpoints
function collapseHistoryClient(history) {
  if (!Array.isArray(history)) return [];
  const out = [];

  for (const h of history) {
    if (!h) continue;

    // 1. Direct consecutive identical step
    const prev = out[out.length - 1];
    if (isSameTrackingStep(prev, h)) {
      if (h.updated_at) prev.updated_at = h.updated_at;
      continue;
    }

    // 2. 2-step alternating ping-pong (A -> B -> A -> B)
    const prevPrev = out[out.length - 2];
    if (prev && prevPrev && isSameTrackingStep(prevPrev, h)) {
      if (h.updated_at) prevPrev.updated_at = h.updated_at;
      out.splice(out.length - 2, 1);
      out.push(prevPrev);
      continue;
    }

    out.push({ ...h });
  }

  return out;
}

function parseStep(h) {
  const meta = STATUS_INFO[h.status] || { label: 'Update Pengiriman', desc: '' };
  const rawNote = String(h.note || '').trim();
  const lower = rawNote.toLowerCase();

  let desc = meta.desc;
  let locationTag = null;

  if (rawNote) {
    let matchedTrans = false;
    for (const [key, trans] of Object.entries(BITESHIP_TRANSLATIONS)) {
      if (lower.startsWith(key)) {
        desc = trans;
        matchedTrans = true;
        break;
      }
    }

    if (!matchedTrans) {
      // Real courier note: check for brackets e.g. [Surabaya Gateway] or [JAKARTA]
      const bracketMatch = rawNote.match(/^\[([^\]]+)\]\s*(.*)$/);
      const trailingBracket = rawNote.match(/^(.*?)\[([^\]]+)\]\s*$/);

      if (bracketMatch) {
        locationTag = bracketMatch[1].trim();
        desc = bracketMatch[2].trim() || rawNote;
      } else if (trailingBracket && trailingBracket[1].trim()) {
        locationTag = trailingBracket[2].trim();
        desc = trailingBracket[1].trim();
      } else {
        desc = rawNote;
      }
    }
  }

  return { label: meta.label, desc, locationTag };
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
  // Collapse spam/ping-pong duplicates, then reverse so newest is on top (Shopee-style)
  const cleaned = collapseHistoryClient(history);
  const items = [...cleaned].reverse();

  const topStatus = items[0]?.status;
  const isGood = GOOD_TERMINAL.has(topStatus);
  const isBad = BAD_TERMINAL.has(topStatus);

  const dotActiveClass = isGood
    ? styles.dotActiveGood
    : isBad
      ? styles.dotActiveBad
      : styles.dotActiveNeutral;

  const labelActiveClass = isGood
    ? styles.labelActiveGood
    : isBad
      ? styles.labelActiveBad
      : styles.labelActiveNeutral;

  const badgeActiveClass = isGood
    ? styles.statusBadgeGood
    : isBad
      ? styles.statusBadgeBad
      : styles.statusBadgeNeutral;

  return (
    <div className={styles.card}>
      {/* Header: courier + waybill */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1" />
            <path d="M16 8h4l3 3v5h-7z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <span className={styles.headerTitle}>Lacak Pengiriman</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.courierBadge}>
            {(courier || '').toUpperCase()}
          </div>
          <div className={styles.waybillText}>{waybill}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          Belum ada riwayat pelacakan. Status akan muncul setelah kurir memproses paket.
        </div>
      ) : (
        <div className={styles.timeline}>
          {items.map((h, idx) => {
            const { label, desc, locationTag } = parseStep(h);
            const when = formatWhen(h.updated_at);
            const isActive = idx === 0;
            const isLast = idx === items.length - 1;

            return (
              <div key={idx} className={styles.timelineItem}>
                {/* Rail: dot + connecting line */}
                <div className={styles.rail}>
                  <div
                    className={`${styles.dot} ${isActive ? `${styles.dotActive} ${dotActiveClass}` : ''}`}
                  />
                  {!isLast && <div className={styles.line} />}
                </div>

                {/* Content */}
                <div className={`${styles.content} ${isLast ? styles.contentLast : ''}`}>
                  <div className={styles.labelRow}>
                    <span className={`${styles.label} ${isActive ? labelActiveClass : ''}`}>
                      {label}
                    </span>
                    {isActive && (
                      <span className={`${styles.statusBadge} ${badgeActiveClass}`}>
                        {isGood ? 'Selesai' : isBad ? 'Kendala' : 'Terkini'}
                      </span>
                    )}
                  </div>

                  <div className={`${styles.desc} ${isActive ? styles.descActive : ''}`}>
                    {locationTag && (
                      <span className={styles.locationTag}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {locationTag}
                      </span>
                    )}
                    {desc}
                  </div>

                  {(when.date || when.time) && (
                    <div className={styles.time}>
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
