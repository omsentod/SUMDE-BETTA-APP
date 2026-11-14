import React from 'react';

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Kemarin';
  if (day < 7) return `${day} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function getNotificationImage(item = {}) {
  if (item?.imageUrl && typeof item.imageUrl === 'string') {
    return item.imageUrl;
  }
  const t = (item?.type || '').toLowerCase();
  if (t.includes('chat') || t.includes('message')) {
    return '/img/logo.png';
  }
  if (t.includes('order') || t.includes('paid') || t.includes('ship') || t.includes('courier') || t.includes('deliver')) {
    return '/img/betta-1.png';
  }
  if (t.includes('promo') || t.includes('event')) {
    return '/img/betta-2.png';
  }
  return '/img/logo.png';
}

export function getNotificationMeta(type = '') {
  const t = (type || '').toLowerCase();

  // 0. Chat / Pesan
  if (t.includes('chat') || t.includes('message')) {
    return {
      label: 'Pesan',
      variant: 'chat',
      badgeColor: '#3B82F6',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    };
  }

  // 1. Pembayaran
  if (t.includes('paid') || t.includes('payment')) {
    return {
      label: 'Pembayaran',
      variant: 'payment',
      badgeColor: '#10B981',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    };
  }

  // 2. Pengiriman
  if (t.includes('ship') || t.includes('picked') || t.includes('courier')) {
    return {
      label: 'Pengiriman',
      variant: 'shipping',
      badgeColor: '#0EA5E9',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      ),
    };
  }

  // 3. Selesai
  if (t.includes('complete') || t.includes('deliver')) {
    return {
      label: 'Pesanan Selesai',
      variant: 'completed',
      badgeColor: '#22C55E',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
    };
  }

  // 4. Pembatalan / Retur
  if (t.includes('cancel') || t.includes('return') || t.includes('fail')) {
    return {
      label: 'Dibatalkan',
      variant: 'cancelled',
      badgeColor: '#EF4444',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
    };
  }

  // 5. Pesanan baru / dibuat
  if (t.includes('order')) {
    return {
      label: 'Pesanan',
      variant: 'order',
      badgeColor: '#F59E0B',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
    };
  }

  // 6. Promo
  if (t.includes('promo') || t.includes('event')) {
    return {
      label: 'Promo Toko',
      variant: 'promo',
      badgeColor: '#EC4899',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    };
  }

  // Default: Info / Akun
  return {
    label: 'Info',
    variant: 'info',
    badgeColor: 'var(--primary)',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };
}

/**
 * Determine logical aggregation category for incoming event types.
 */
export function getGroupCategory(type = '') {
  const t = (type || '').toLowerCase();
  if (t.includes('chat') || t.includes('message')) return 'chat_message';
  if (t.includes('paid') || t.includes('payment')) return 'order_paid';
  if (t.includes('ship') || t.includes('picked') || t.includes('courier')) return 'order_shipped';
  if (t.includes('complete') || t.includes('deliver')) return 'order_completed';
  if (t.includes('process') || t.includes('packing')) return 'order_processing';
  if (t.includes('order')) return 'order_new';
  return null;
}

/**
 * Extract clean snippet details from order notification bodies.
 */
export function extractOrderSnippet(item = {}) {
  const text = `${item.title || ''} ${item.body || ''}`;
  const match = text.match(/#([a-zA-Z0-9_-]{4,36})/i);
  const code = match ? `#${match[1]}` : null;

  const nameMatch = (item.body || '').match(/\(([^)]+)\)/) || (item.body || '').match(/dari\s+([a-zA-Z0-9\s._'-]{2,25})/i);
  let name = nameMatch ? nameMatch[1].replace(/menunggu.*/i, '').replace(/lunas.*/i, '').trim() : null;
  if (name && name.length > 25) name = name.slice(0, 25) + '...';

  return { code, name };
}

/**
 * Smart Aggregation / Grouping for notifications.
 * Combines clustered notifications of the same event category occurring within
 * a given time window (e.g. 3 hours) into a single high-signal card.
 *
 * If count === 1: returns normal individual item.
 * If count >= 2: returns a grouped notification item with an `items` array.
 *
 * @param {Array} items - raw notification list
 * @param {object} [options]
 * @param {'admin' | 'customer'} [options.role='admin']
 * @param {number} [options.maxClusterGapMs=10800000] - 3 hours
 * @returns {Array} grouped and sorted notifications
 */
export function groupNotifications(items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const { role = 'admin', maxClusterGapMs = 3 * 60 * 60 * 1000 } = options;

  const categoryBuckets = new Map();
  const nonGroupableItems = [];

  for (const item of items) {
    const category = getGroupCategory(item.type);
    if (!category) {
      nonGroupableItems.push(item);
      continue;
    }

    if (!categoryBuckets.has(category)) {
      categoryBuckets.set(category, []);
    }
    categoryBuckets.get(category).push(item);
  }

  const resultCards = [...nonGroupableItems];

  for (const [category, bucketItems] of categoryBuckets.entries()) {
    if (bucketItems.length === 1) {
      resultCards.push(bucketItems[0]);
      continue;
    }

    // Cluster items by time gap (bucketItems are sorted desc by createdAt)
    const clusters = [];
    let currentCluster = [];

    for (const item of bucketItems) {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
      } else {
        const prevItem = currentCluster[currentCluster.length - 1];
        const prevTime = new Date(prevItem.createdAt || 0).getTime();
        const currTime = new Date(item.createdAt || 0).getTime();
        const isSameReadState = Boolean(prevItem.readAt) === Boolean(item.readAt);

        // Hanya kelompokkan jika kategori sama, status baca sama, dan selisih waktu <= maxClusterGapMs
        if (isSameReadState && Math.abs(prevTime - currTime) <= maxClusterGapMs) {
          currentCluster.push(item);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    for (const cluster of clusters) {
      if (cluster.length === 1) {
        resultCards.push(cluster[0]);
        continue;
      }

      const latestItem = cluster[0];
      const count = cluster.length;
      const unreadCount = cluster.filter((i) => !i.readAt).length;
      const allRead = unreadCount === 0;

      let title = `${count} Notifikasi Baru`;
      let body = `${count} aktivitas tercatat dalam waktu berdekatan.`;
      let link = role === 'admin' ? '/admin/orders' : '/customer/orders';

      if (category === 'order_new') {
        title = `${count} Pesanan Baru Masuk`;
        body = `${count} pesanan baru menunggu pembayaran dan konfirmasi.`;
        link = role === 'admin' ? '/admin/orders?status=NEW' : '/customer/orders?status=PENDING';
      } else if (category === 'order_paid') {
        title = `${count} Pesanan Telah Dibayar`;
        body = `${count} pesanan telah lunas dan siap dikemas untuk pengiriman.`;
        link = role === 'admin' ? '/admin/orders?status=PAID' : '/customer/orders?status=PAID';
      } else if (category === 'order_processing') {
        title = `${count} Pesanan Sedang Diproses`;
        body = `${count} pesanan dalam tahap pengemasan & penyiapan resi.`;
        link = role === 'admin' ? '/admin/orders?status=PROCESSING' : '/customer/orders';
      } else if (category === 'order_shipped') {
        title = `${count} Pesanan Sedang Dikirim`;
        body = `${count} pesanan telah diserahkan ke kurir pengiriman.`;
        link = role === 'admin' ? '/admin/orders?status=SHIPPED' : '/customer/orders';
      } else if (category === 'order_completed') {
        title = `${count} Pesanan Selesai`;
        body = `${count} pesanan telah berhasil diterima pelanggan.`;
        link = role === 'admin' ? '/admin/orders?status=COMPLETED' : '/customer/orders';
      } else if (category === 'chat_message') {
        title = `${count} Pesan Chat Baru`;
        body = `Pesan terbaru: "${(latestItem.body || latestItem.title || '').slice(0, 50)}"`;
        link = role === 'admin' ? '/admin/chat' : '/customer/dashboard?openChat=1';
      }

      resultCards.push({
        id: `group_${category}_${latestItem.id}`,
        isGroup: true,
        type: latestItem.type,
        groupCategory: category,
        count,
        unreadCount,
        readAt: allRead ? latestItem.readAt : null,
        createdAt: latestItem.createdAt,
        imageUrl: latestItem.imageUrl || null,
        title,
        body,
        link,
        items: cluster,
      });
    }
  }

  // Sort chronologically descending
  resultCards.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return resultCards;
}
