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
 * Generator File PDF Murni (Zero-Dependency) untuk Lembar Bungkus Ikan (Tahap 1 Packing)
 * Menghasilkan Buffer file PDF 1.4 standar yang persis dan selaras dengan cetakan sistem
 * (/admin/packing/manifest?stage=bagging), siap dikirim via Telegram sendDocument.
 */
export function generateBaggingManifestPdf({ dateStr, totalOrders, totalFish, rows }) {
  const W = 595.28; // Lebar standar A4 portrait (points)
  const H = 841.89; // Tinggi standar A4 portrait (points)
  const margin = 30;
  const contentW = W - margin * 2; // 535.28 pt

  // Lebar kolom sesuai tabel Tahap 1: No (32), Nama (215), Varian (65), Asal/Soliter (135), Total Ekor (55), Cek (33.28)
  const colWidths = [32, 215, 65, 135, 55, 33.28];
  const colX = [margin];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }

  function escapePdf(text) {
    return String(text || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/•/g, '\xB7') // Map bullet Unicode ke Latin1 middot
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' '); // Filter aman karakter di luar Latin-1 WinAnsi
  }

  // Partisi baris per halaman secara dinamis berdasarkan tinggi baris (akomodasi multi-item)
  const pages = [];
  let currentPage = [];
  let currentY = H - 85 - 20;

  for (const row of rows) {
    const itemCount = row.items && row.items.length > 1 ? row.items.length : 1;
    const rowH = itemCount === 1 ? 30 : Math.max(30, 18 + itemCount * 12);

    if (currentY - rowH < 40 && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentY = H - 52 - 20;
    }

    currentPage.push({ ...row, rowH, itemCount });
    currentY -= rowH;
  }
  if (currentPage.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  const totalPages = pages.length;
  const pageStreams = [];
  let globalIdx = 1;

  pages.forEach((pageRows, pageIdx) => {
    let s = '';
    const isFirst = pageIdx === 0;

    if (isFirst) {
      // 1. Header Kiri: Nama Toko & Subtitle Tahap 1
      s += 'BT\n/F2 15 Tf\n0.04 0.04 0.04 rg\n';
      s += `${margin} ${H - 34} Td\n`;
      s += `(${escapePdf('SUMDE BETTA')}) Tj\n`;
      s += 'ET\n';

      s += 'BT\n/F1 8 Tf\n0.44 0.44 0.48 rg\n';
      s += `${margin} ${H - 46} Td\n`;
      s += `(${escapePdf('Tahap 1  \xB7  Lembar Bungkus Plastik Ikan')}) Tj\n`;
      s += 'ET\n';

      // Header Kanan: DAFTAR BUNGKUS IKAN
      s += 'BT\n/F2 14 Tf\n0.04 0.04 0.04 rg\n';
      s += `${W - margin - 185} ${H - 34} Td\n`;
      s += `(${escapePdf('DAFTAR BUNGKUS IKAN')}) Tj\n`;
      s += 'ET\n';

      // 2. Baris Metadata (.metaRow: persis seperti cetakan sistem)
      // Garis atas hitam 0.75pt
      s += '0.09 0.09 0.11 RG\n0.75 w\n';
      s += `${margin} ${H - 55} m ${W - margin} ${H - 55} l S\n`;

      // Konten teks metadata
      s += 'BT\n/F1 7.5 Tf\n0.25 0.25 0.27 rg\n';
      s += `${margin} ${H - 66} Td\n`;
      s += `(${escapePdf(`Waktu Cetak: ${dateStr}   |   Total Jenis / Antrean: ${rows.length} Baris   |   Total Ikan Perlu Dibungkus: ${totalFish} Ekor`)}) Tj\n`;
      s += 'ET\n';

      // Garis bawah hitam tegas 1.25pt
      s += '0.09 0.09 0.11 RG\n1.25 w\n';
      s += `${margin} ${H - 72} m ${W - margin} ${H - 72} l S\n`;
    } else {
      // Header Halaman Lanjutan
      s += 'BT\n/F2 10 Tf\n0.04 0.04 0.04 rg\n';
      s += `${margin} ${H - 34} Td\n`;
      s += `(${escapePdf('SUMDE BETTA  \xB7  DAFTAR BUNGKUS IKAN (Lanjutan)')}) Tj\n`;
      s += 'ET\n';

      s += 'BT\n/F1 8 Tf\n0.44 0.44 0.48 rg\n';
      s += `${W - margin - 90} ${H - 34} Td\n`;
      s += `(${escapePdf(`Halaman ${pageIdx + 1} dari ${totalPages}`)}) Tj\n`;
      s += 'ET\n';

      s += '0.09 0.09 0.11 RG\n0.75 w\n';
      s += `${margin} ${H - 42} m ${W - margin} ${H - 42} l S\n`;
    }

    // 3. Header Tabel (.manifestTable thead)
    const tableTop = isFirst ? H - 85 : H - 52;
    const headerH = 20;

    // Background header tabel (#F4F4F5)
    s += '0.957 0.957 0.961 rg\n';
    s += `${margin} ${tableTop - headerH} ${contentW} ${headerH} re\nf\n`;

    // Garis luar header tabel hitam
    s += '0.09 0.09 0.11 RG\n1 w\n';
    s += `${margin} ${tableTop - headerH} ${contentW} ${headerH} re\nS\n`;

    // Garis vertikal pemisah kolom di header
    for (let c = 1; c < colX.length; c++) {
      s += `${colX[c]} ${tableTop - headerH} m ${colX[c]} ${tableTop} l S\n`;
    }

    // Judul Kolom (No., Nama Jenis Ikan, Varian, Asal / Lokasi Soliter, Total Ekor, Cek)
    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[0] + 9} ${tableTop - 14} Td\n(No.) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[1] + 6} ${tableTop - 14} Td\n(Nama Jenis Ikan) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[2] + 19} ${tableTop - 14} Td\n(Varian) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[3] + 6} ${tableTop - 14} Td\n(Asal / Lokasi Soliter) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[4] + 8} ${tableTop - 14} Td\n(Total Ekor) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F2 7.5 Tf\n0.09 0.09 0.11 rg\n';
    s += `${colX[5] + 8} ${tableTop - 14} Td\n(Cek) Tj\n`;
    s += 'ET\n';

    // 4. Baris-Baris Isi Tabel
    let curY = tableTop - headerH;

    pageRows.forEach((r) => {
      const rowH = r.rowH;
      curY -= rowH;

      // Garis border sel & divider kolom (#D4D4D8)
      s += '0.83 0.83 0.85 RG\n0.5 w\n';
      s += `${margin} ${curY} ${contentW} ${rowH} re\nS\n`;
      for (let c = 1; c < colX.length; c++) {
        s += `${colX[c]} ${curY} m ${colX[c]} ${curY + rowH} l S\n`;
      }

      // Kolom 0: No. (Tengah)
      s += 'BT\n/F2 8 Tf\n0.09 0.09 0.11 rg\n';
      const noOffset = globalIdx > 9 ? 10 : 13;
      s += `${colX[0] + noOffset} ${curY + (rowH / 2) - 3} Td\n(${globalIdx}) Tj\n`;
      s += 'ET\n';

      // Kolom 1: Nama Jenis Ikan + Subtitle
      if (r.itemCount > 1) {
        // Multi-item (TikTok claim dengan banyak ekor)
        r.items.forEach((it, i) => {
          const itemY = curY + rowH - 13 - (i * 12);
          s += 'BT\n/F2 7.5 Tf\n0.05 0.05 0.05 rg\n';
          s += `${colX[1] + 6} ${itemY} Td\n(${it.quantity}x) Tj\n`;
          s += 'ET\n';

          s += 'BT\n/F1 7.5 Tf\n0.05 0.05 0.05 rg\n';
          s += `${colX[1] + 20} ${itemY} Td\n(${escapePdf((it.name || 'Ikan Betta').slice(0, 36))}) Tj\n`;
          s += 'ET\n';
        });

        if (r.subtitle) {
          s += 'BT\n/F1 6.8 Tf\n0.44 0.44 0.48 rg\n';
          s += `${colX[1] + 6} ${curY + 5} Td\n(${escapePdf(r.subtitle.slice(0, 44))}) Tj\n`;
          s += 'ET\n';
        }
      } else {
        // Single item
        const singleQty = (r.items?.[0]?.quantity && r.type === 'claim') ? `${r.items[0].quantity}x ` : '';
        const singleTitle = `${singleQty}${r.items?.[0]?.name || r.name || 'Ikan Betta'}`;

        s += 'BT\n/F2 7.8 Tf\n0.05 0.05 0.05 rg\n';
        s += `${colX[1] + 6} ${curY + 16} Td\n(${escapePdf(singleTitle.slice(0, 40))}) Tj\n`;
        s += 'ET\n';

        if (r.subtitle) {
          s += 'BT\n/F1 6.8 Tf\n0.44 0.44 0.48 rg\n';
          s += `${colX[1] + 6} ${curY + 6} Td\n(${escapePdf(r.subtitle.slice(0, 44))}) Tj\n`;
          s += 'ET\n';
        }
      }

      // Kolom 2: Varian
      if (r.itemCount > 1) {
        r.items.forEach((it, i) => {
          const itemY = curY + rowH - 13 - (i * 12);
          const vt = it.variantText || '-';
          s += 'BT\n/F2 7.2 Tf\n0.09 0.09 0.11 rg\n';
          s += `${colX[2] + 12} ${itemY} Td\n(${escapePdf(vt)}) Tj\n`;
          s += 'ET\n';
        });
      } else {
        const vt = r.items?.[0]?.variantText || r.variantText || r.variant;
        if (vt && vt !== '-') {
          // Pill badge background & border
          const badgeW = 46;
          const badgeH = 14;
          const badgeX = colX[2] + (65 - badgeW) / 2;
          const badgeY = curY + (rowH - badgeH) / 2;

          s += '0.957 0.957 0.961 rg\n';
          s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re\nf\n`;
          s += '0.83 0.83 0.85 RG\n0.5 w\n';
          s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re\nS\n`;

          s += 'BT\n/F2 7.2 Tf\n0.09 0.09 0.11 rg\n';
          s += `${badgeX + 6} ${badgeY + 4} Td\n(${escapePdf(vt.slice(0, 10))}) Tj\n`;
          s += 'ET\n';
        } else {
          s += 'BT\n/F1 8 Tf\n0.6 0.6 0.6 rg\n';
          s += `${colX[2] + 28} ${curY + (rowH / 2) - 3} Td\n(-) Tj\n`;
          s += 'ET\n';
        }
      }

      // Kolom 3: Asal / Lokasi Soliter
      if (r.type === 'sample') {
        const badgeW = 74;
        const badgeH = 14;
        const badgeX = colX[3] + 6;
        const badgeY = curY + (rowH - badgeH) / 2;

        s += '0.957 0.957 0.961 rg\n';
        s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re\nf\n`;
        s += '0.83 0.83 0.85 RG\n0.5 w\n';
        s += `${badgeX} ${badgeY} ${badgeW} ${badgeH} re\nS\n`;

        s += 'BT\n/F2 7 Tf\n0.05 0.05 0.05 rg\n';
        s += `${badgeX + 5} ${badgeY + 4} Td\n(${escapePdf('Kolam Sampel')}) Tj\n`;
        s += 'ET\n';
      } else if (r.originType === 'TIKTOK_LIVE') {
        const line1 = r.hostAccount ? `Pos: ${r.hostAccount}` : 'TikTok Live';
        const line2 = r.buyerTag ? `Tangki: ${r.buyerTag}` : '';

        s += 'BT\n/F2 7 Tf\n0.09 0.09 0.11 rg\n';
        s += `${colX[3] + 6} ${curY + (rowH / 2) + 2} Td\n(${escapePdf(line1.slice(0, 26))}) Tj\n`;
        s += 'ET\n';

        if (line2) {
          s += 'BT\n/F1 7 Tf\n0.32 0.32 0.36 rg\n';
          s += `${colX[3] + 6} ${curY + (rowH / 2) - 8} Td\n(${escapePdf(line2.slice(0, 26))}) Tj\n`;
          s += 'ET\n';
        }
      } else {
        const line1 = 'Telegram Drop';
        const line2 = r.buyerTag ? `Tangki: ${r.buyerTag}` : '';

        s += 'BT\n/F2 7 Tf\n0.09 0.09 0.11 rg\n';
        s += `${colX[3] + 6} ${curY + (rowH / 2) + 2} Td\n(${escapePdf(line1)}) Tj\n`;
        s += 'ET\n';

        if (line2) {
          s += 'BT\n/F1 7 Tf\n0.32 0.32 0.36 rg\n';
          s += `${colX[3] + 6} ${curY + (rowH / 2) - 8} Td\n(${escapePdf(line2.slice(0, 26))}) Tj\n`;
          s += 'ET\n';
        }
      }

      // Kolom 4: Total Ekor (.tdQty: Bold, centered)
      s += 'BT\n/F2 8.5 Tf\n0.05 0.05 0.05 rg\n';
      s += `${colX[4] + 8} ${curY + (rowH / 2) - 3} Td\n(${r.totalQty || r.qty || 1} Ekor) Tj\n`;
      s += 'ET\n';

      // Kolom 5: Kotak Ceklis (.checkSquare: 14x14 square centered in 33.28pt)
      s += '0.09 0.09 0.11 RG\n1.2 w\n';
      s += `${colX[5] + 9.64} ${curY + (rowH - 14) / 2} 14 14 re\nS\n`;

      globalIdx++;
    });

    // Garis luar tabel tegas hitam
    s += '0.09 0.09 0.11 RG\n1 w\n';
    s += `${margin} ${curY} ${contentW} ${tableTop - curY} re\nS\n`;

    // 5. Footer Halaman
    s += 'BT\n/F1 7 Tf\n0.44 0.44 0.48 rg\n';
    s += `${margin} 20 Td\n(${escapePdf('SUMDE BETTA  \xB7  Tahap 1 Packing: Lembar Bungkus Plastik Ikan Resmi  \xB7  sumdebetta.com')}) Tj\n`;
    s += 'ET\n';

    s += 'BT\n/F1 7 Tf\n0.44 0.44 0.48 rg\n';
    s += `${W - margin - 80} 20 Td\n(${escapePdf(`Halaman ${pageIdx + 1} dari ${totalPages}`)}) Tj\n`;
    s += 'ET\n';

    pageStreams.push(Buffer.from(s, 'utf-8'));
  });

  // Konstruksi PDF 1.4 Standar
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

  const fontF1Id = 3 + totalPages * 2;
  const fontF2Id = fontF1Id + 1;

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

  // Fonts Standard Type1 (Helvetica & Helvetica-Bold)
  pushObj(`${fontF1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);
  pushObj(`${fontF2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);

  const totalObjs = fontF2Id;
  const xrefOffset = Buffer.byteLength(body.join(''), 'binary');
  body.push(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  offsets.forEach((off) => {
    body.push(String(off).padStart(10, '0') + ' 00000 n \n');
  });
  body.push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(body.join(''), 'binary');
}
