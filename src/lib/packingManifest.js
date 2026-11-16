// Helper Agregasi Baris Bungkus Ikan & Generator PDF Manifest Packing Gudang
// Digunakan oleh Halaman Manifest (/admin/packing/manifest) dan Notifikasi Bot Telegram

// Format varian bersih tanpa redundansi kata "Size"
export function formatVariantLabel(variantStr) {
  if (!variantStr) return null;
  const raw = String(variantStr).trim();
  const cleaned = raw.replace(/^size\s*[:\-]?\s*/i, '').trim();
  return cleaned || raw;
}

export function resolveTikTokHost(order) {
  if (order?.tiktokAccountName) {
    const raw = order.tiktokAccountName.trim();
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => (p.startsWith('@') ? p : `@${p}`)).join(' + ');
    }
    if (parts.length === 1) {
      const p = parts[0];
      if (p.startsWith('@')) return p;
      const match = p.match(/Akun\s+Live\s+(\d+)/i);
      if (match) return `@sumdebetta.live${match[1]}`;
      return `@${p.toLowerCase().replace(/\s+/g, '.')}`;
    }
  }
  if (order?.tiktokLiveBasket?.tiktokAccount?.handle) {
    const h = order.tiktokLiveBasket.tiktokAccount.handle.trim();
    return h.startsWith('@') ? h : `@${h}`;
  }
  return null;
}

/**
 * Algoritma agregasi baris bungkus plastik ikan (Tahap 1 Packing Gudang)
 * Mengelompokkan ikan sampel kolam/rak (Web) per jenis + size,
 * dan memisahkan ikan soliter claim (TikTok Live / Telegram).
 */
export function buildBaggingRows(orders) {
  const sampleMap = new Map();
  const rows = [];
  let totalFish = 0;

  orders.forEach((order) => {
    const isClaim =
      order.orderSource === 'TIKTOK_LIVE' ||
      order.orderSource === 'TELEGRAM' ||
      Boolean(order.tiktokUsername) ||
      Boolean(order.telegramUsername);

    if (isClaim) {
      const totalQty =
        order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
      totalFish += totalQty;

      const hostAccount =
        order.orderSource === 'TIKTOK_LIVE' ? resolveTikTokHost(order) : null;
      const buyerTag = order.tiktokUsername
        ? `@${order.tiktokUsername.replace(/^@+/, '')}`
        : order.telegramUsername
        ? `@${order.telegramUsername.replace(/^@+/, '')}`
        : order.name;

      const firstItem = order.items?.[0];
      const thumbImg =
        firstItem?.customImage ||
        firstItem?.variant?.imageUrl ||
        firstItem?.product?.image ||
        '/img/betta-1.png';

      const claimItems = (order.items || []).map((it) => ({
        id: it.id,
        name: it.customName || it.product?.name || 'Ikan Betta',
        quantity: it.quantity || 1,
        selectedSize: it.selectedSize,
        variantText: formatVariantLabel(it.selectedSize) || null,
        image:
          it.customImage ||
          it.variant?.imageUrl ||
          it.product?.image ||
          '/img/betta-1.png',
      }));

      rows.push({
        id: `claim_${order.id}`,
        type: 'claim',
        orderId: order.id,
        items: claimItems,
        name: claimItems[0]?.name || 'Ikan Betta',
        variantText: claimItems[0]?.variantText || null,
        subtitle: hostAccount
          ? `Pos: ${hostAccount}`
          : order.orderSource === 'TIKTOK_LIVE'
          ? 'TikTok Live'
          : 'Telegram Drop',
        hostAccount,
        buyerTag,
        originType: order.orderSource,
        totalQty,
        image: thumbImg,
        trackingNumber: order.trackingNumber || null,
        shippingCourier: order.shippingCourier || null,
      });
    } else {
      order.items?.forEach((item) => {
        const qty = item.quantity || 1;
        totalFish += qty;
        const prodId =
          item.product?.id || item.productId || item.customName || 'sample';
        const size = item.selectedSize || '';
        const key = `sample_${prodId}__${size}`;

        if (!sampleMap.has(key)) {
          sampleMap.set(key, {
            id: key,
            type: 'sample',
            name: item.product?.name || item.customName || 'Ikan Cupang Sampel',
            selectedSize: size,
            variantText: formatVariantLabel(size) || null,
            image:
              item.product?.image ||
              item.customImage ||
              item.variant?.imageUrl ||
              '/img/betta-1.png',
            totalQty: 0,
            orderCount: 0,
            orderIds: new Set(),
          });
        }

        const grp = sampleMap.get(key);
        grp.totalQty += qty;
        grp.orderCount += 1;
        grp.orderIds.add(order.id);
      });
    }
  });

  sampleMap.forEach((grp) => {
    const varLabel = formatVariantLabel(grp.selectedSize) || null;
    rows.push({
      id: grp.id,
      type: 'sample',
      name: grp.name,
      variantText: varLabel,
      subtitle: `Pos Kolam / Rak • ${grp.orderCount} pesanan`,
      originType: 'WEB',
      totalQty: grp.totalQty,
      image: grp.image,
      items: [
        {
          id: grp.id,
          name: grp.name,
          quantity: grp.totalQty,
          selectedSize: grp.selectedSize,
          variantText: varLabel,
          image: grp.image,
        },
      ],
    });
  });

  // Urutkan: sampel kolam dulu, lalu soliter live
  rows.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'sample' ? -1 : 1;
    return b.totalQty - a.totalQty;
  });

  return { baggingRows: rows, totalBaggingFish: totalFish };
}

/**
 * Generator File PDF Murni (Zero-Dependency) untuk Lembar Bungkus Ikan
 * Menghasilkan Buffer file PDF 1.4 standar yang siap dikirim via Telegram sendDocument.
 */
export function generateBaggingManifestPdf({ dateStr, totalOrders, totalFish, rows }) {
  const W = 595.28; // Lebar A4 (points)
  const H = 841.89; // Tinggi A4 (points)
  const margin = 36;
  const contentW = W - margin * 2;

  function escapePdf(text) {
    return String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' '); // filter karakter di luar latin1 WinAnsi
  }

  // Pecah baris ke beberapa halaman jika melebihi kapasitas
  const pages = [];
  const remaining = [...rows];
  const firstPageLimit = 18;
  const subPageLimit = 24;

  if (remaining.length === 0) {
    pages.push([]);
  } else {
    pages.push(remaining.splice(0, firstPageLimit));
    while (remaining.length > 0) {
      pages.push(remaining.splice(0, subPageLimit));
    }
  }

  const totalPages = pages.length;
  const pageStreams = [];

  let globalIdx = 1;
  pages.forEach((pageRows, pageIdx) => {
    let s = '';
    const isFirst = pageIdx === 0;

    if (isFirst) {
      // Header Banner
      s += '0.95 0.95 0.96 rg\n';
      s += `${margin} ${H - 85} ${contentW} 52 re\nf\n`;
      s += '0.85 0.85 0.88 RG\n1 w\n';
      s += `${margin} ${H - 85} ${contentW} 52 re\nS\n`;

      // Judul Dokumen
      s += 'BT\n/F2 15 Tf\n0.1 0.1 0.12 rg\n';
      s += `${margin + 14} ${H - 54} Td\n`;
      s += `(${escapePdf('SUMDE BETTA  -  LEMBAR BUNGKUS IKAN (PACKING GUDANG)')}) Tj\n`;
      s += 'ET\n';

      // Subtitle
      s += 'BT\n/F1 8.5 Tf\n0.4 0.4 0.45 rg\n';
      s += `${margin + 14} ${H - 70} Td\n`;
      s += `(${escapePdf(dateStr + '   |   Tahap 1 Packing: Bungkus Plastik Ikan')}) Tj\n`;
      s += 'ET\n';

      // Ringkasan Bar
      s += '0.98 0.98 0.99 rg\n';
      s += `${margin} ${H - 114} ${contentW} 22 re\nf\n`;
      s += '0.88 0.88 0.90 RG\n0.75 w\n';
      s += `${margin} ${H - 114} ${contentW} 22 re\nS\n`;

      s += 'BT\n/F2 8.5 Tf\n0.18 0.18 0.22 rg\n';
      s += `${margin + 12} ${H - 100} Td\n`;
      s += `(${escapePdf(`TOTAL PESANAN: ${totalOrders} PESANAN   |   TOTAL IKAN PERLU DIBUNGKUS: ${totalFish} EKOR   |   DAFTAR IKAN: ${rows.length} BARIS`)}) Tj\n`;
      s += 'ET\n';
    } else {
      // Header Ringkas untuk Halaman Lanjutan
      s += '0.96 0.96 0.97 rg\n';
      s += `${margin} ${H - 52} ${contentW} 24 re\nf\n`;
      s += '0.88 0.88 0.90 RG\n0.5 w\n';
      s += `${margin} ${H - 52} ${contentW} 24 re\nS\n`;

      s += 'BT\n/F2 9 Tf\n0.2 0.2 0.25 rg\n';
      s += `${margin + 10} ${H - 37} Td\n`;
      s += `(${escapePdf('SUMDE BETTA  -  LEMBAR BUNGKUS IKAN (Lanjutan)')}) Tj\n`;
      s += 'ET\n';

      s += 'BT\n/F1 8 Tf\n0.45 0.45 0.5 rg\n';
      s += `${W - margin - 120} ${H - 37} Td\n`;
      s += `(${escapePdf(`Halaman ${pageIdx + 1} dari ${totalPages}`)}) Tj\n`;
      s += 'ET\n';
    }

    // Header Tabel
    const tableTop = isFirst ? H - 138 : H - 76;
    s += '0.15 0.15 0.18 rg\n';
    s += `${margin} ${tableTop - 18} ${contentW} 20 re\nf\n`;

    s += 'BT\n/F2 8 Tf\n1 1 1 rg\n';
    s += `${margin + 8} ${tableTop - 13} Td\n(NO) Tj\n`;
    s += '26 0 Td\n(NAMA JENIS IKAN / ITEM) Tj\n';
    s += '220 0 Td\n(VARIAN / SIZE) Tj\n';
    s += '95 0 Td\n(ASAL / LOKASI SOLITER) Tj\n';
    s += '105 0 Td\n(QTY) Tj\n';
    s += '40 0 Td\n(CEK) Tj\n';
    s += 'ET\n';

    // Isi Baris Tabel
    let curY = tableTop - 20;
    const rowH = 26;

    pageRows.forEach((r, idx) => {
      curY -= rowH;

      // Background selang-seling
      if (idx % 2 === 1) {
        s += '0.97 0.97 0.98 rg\n';
        s += `${margin} ${curY} ${contentW} ${rowH} re\nf\n`;
      }
      // Garis pemisah bawah
      s += '0.90 0.90 0.92 RG\n0.5 w\n';
      s += `${margin} ${curY} m ${W - margin} ${curY} l S\n`;

      // Nama Item & Varian
      s += 'BT\n/F1 8.5 Tf\n0.15 0.15 0.2 rg\n';
      s += `${margin + 8} ${curY + 8} Td\n(${globalIdx}) Tj\n`;
      s += `26 0 Td\n(${escapePdf(r.name.slice(0, 42))}) Tj\n`;
      s += `220 0 Td\n(${escapePdf(r.variantText || r.variant || '-')}) Tj\n`;
      s += `95 0 Td\n(${escapePdf(r.subtitle || r.origin || 'Web')}) Tj\n`;
      s += 'ET\n';

      // Qty Bold
      s += 'BT\n/F2 9.5 Tf\n0.05 0.05 0.08 rg\n';
      s += `${W - margin - 65} ${curY + 8} Td\n(${r.totalQty || r.qty || 1}x) Tj\n`;
      s += 'ET\n';

      // Kotak Centang Verifikasi Fisik
      s += '0.65 0.65 0.70 RG\n0.8 w\n';
      s += `${W - margin - 22} ${curY + 7} 12 12 re\nS\n`;

      globalIdx++;
    });

    // Footer Dokumen
    s += 'BT\n/F1 7.5 Tf\n0.55 0.55 0.60 rg\n';
    s += `${margin} 20 Td\n(${escapePdf('SUMDE BETTA  -  Dokumen Packing Gudang Resmi  -  sumdebetta.com')}) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F1 7.5 Tf\n0.55 0.55 0.60 rg\n';
    s += `${W - margin - 80} 20 Td\n(${escapePdf(`Halaman ${pageIdx + 1} dari ${totalPages}`)}) Tj\n`;
    s += 'ET\n';

    pageStreams.push(Buffer.from(s, 'utf-8'));
  });

  // Susun PDF 1.4 Object Structure
  const body = [];
  body.push('%PDF-1.4\n');
  const offsets = [];

  function pushObj(str) {
    offsets.push(Buffer.byteLength(body.join(''), 'binary'));
    body.push(str);
  }

  // 1: Catalog
  pushObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages Root
  const pageObjIds = [];
  for (let i = 0; i < totalPages; i++) {
    pageObjIds.push(3 + i * 2);
  }
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  pushObj(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj\n`);

  // Shared Font IDs
  const fontF1Id = 3 + totalPages * 2;
  const fontF2Id = fontF1Id + 1;

  // Pages & Content streams
  for (let i = 0; i < totalPages; i++) {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    const streamBuf = pageStreams[i];

    pushObj(`\
${pageId} 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> /ProcSet [/PDF /Text] >> >>
endobj
`);

    pushObj(`\
${contentId} 0 obj
<< /Length ${streamBuf.length} >>
stream
${streamBuf.toString('binary')}
endstream
endobj
`);
  }

  // Font 1 (Helvetica)
  pushObj(`\
${fontF1Id} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
`);

  // Font 2 (Helvetica-Bold)
  pushObj(`\
${fontF2Id} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>
endobj
`);

  const totalObjs = fontF2Id;
  const xrefOffset = Buffer.byteLength(body.join(''), 'binary');
  body.push(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  offsets.forEach((off) => {
    body.push(String(off).padStart(10, '0') + ' 00000 n \n');
  });
  body.push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(body.join(''), 'binary');
}
