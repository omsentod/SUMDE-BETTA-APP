'use client';

import styles from './OrderSourceBadge.module.css';

function resolveSource(order) {
  if (order?.orderSource === 'TIKTOK_LIVE') return 'TIKTOK_LIVE';
  if (order?.orderSource === 'TELEGRAM' || order?.telegramUsername) return 'TELEGRAM';
  return 'WEB';
}

export default function OrderSourceBadge({ order, showAccountSubtext = false }) {
  const source = resolveSource(order);

  if (source === 'TIKTOK_LIVE') {
    // Username TikTok yang digunakan tim untuk live streaming (bisa multi-akun)
    let liveHandle = null;
    if (order?.tiktokAccountName) {
      const raw = order.tiktokAccountName.trim();
      const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        liveHandle = parts.map((p) => (p.startsWith('@') ? p : `@${p}`)).join(' + ');
      } else if (parts.length === 1) {
        const p = parts[0];
        if (p.startsWith('@')) {
          liveHandle = p;
        } else {
          const matchDefault = p.match(/Akun\s+Live\s+(\d+)/i);
          if (matchDefault) {
            liveHandle = `@sumdebetta.live${matchDefault[1]}`;
          } else {
            liveHandle = `@${p.toLowerCase().replace(/\s+/g, '.')}`;
          }
        }
      }
    }

    if (!liveHandle && order?.tiktokLiveBasket?.tiktokAccount?.handle) {
      const h = order.tiktokLiveBasket.tiktokAccount.handle.trim();
      liveHandle = h.startsWith('@') ? h : `@${h}`;
    }

    const tooltipDetail = [
      liveHandle ? `Akun Live: ${liveHandle}` : null,
      order?.tiktokUsername ? `Pembeli: @${order.tiktokUsername.replace(/^@+/, '')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className={styles.sourceCell}>
        <span
          className={styles.iconOnly}
          title={tooltipDetail ? `TikTok Live (${tooltipDetail})` : 'TikTok Live'}
          aria-label={tooltipDetail ? `TikTok Live (${tooltipDetail})` : 'TikTok Live'}
        >
          <svg
            className={styles.icon}
            width="22"
            height="22"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect
              x="1"
              y="1"
              width="22"
              height="22"
              rx="6"
              fill="#010101"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="0.75"
            />
            <g transform="translate(3.04, 4.26) scale(0.7)">
              <path
                fill="#FFFFFF"
                d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
              />
            </g>
          </svg>
        </span>
        {showAccountSubtext && liveHandle && (
          <span className={styles.subtext}>{liveHandle}</span>
        )}
      </div>
    );
  }

  if (source === 'TELEGRAM') {
    return (
      <span
        className={styles.iconOnly}
        title={order?.telegramUsername ? `Telegram (@${order.telegramUsername})` : 'Telegram Drop'}
        aria-label={order?.telegramUsername ? `Telegram (@${order.telegramUsername})` : 'Telegram Drop'}
      >
        <svg
          className={styles.icon}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="#26A5E4" />
          <g transform="translate(4.5, 4.6) scale(0.62)">
            <path
              fill="#FFFFFF"
              d="M21.9 4.6L18.6 20.2c-.25 1.1-.9 1.37-1.82.85l-5.03-3.71-2.43 2.34c-.27.27-.5.5-1.02.5l.36-5.13 9.33-8.43c.4-.36-.09-.56-.63-.2L5.83 13.7.85 12.14c-1.08-.34-1.1-1.08.23-1.6L20.5 3.05c.9-.33 1.69.22 1.4 1.55z"
            />
          </g>
        </svg>
      </span>
    );
  }

  return (
    <span className={styles.iconOnly} title="Website Reguler" aria-label="Website Reguler">
      <svg
        className={`${styles.icon} ${styles.webIcon}`}
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </span>
  );
}
