import nodemailer from 'nodemailer';

// SMTP wrapper untuk SUMDE-BETTA-APP.
// Semua email keluar (OTP verifikasi, reset password, notifikasi order) melalui sini.
//
// Env vars (di-set via Hostinger Deployments Environment Variables):
//   SMTP_HOST  - misal smtp.hostinger.com
//   SMTP_PORT  - 465 (SSL) atau 587 (STARTTLS)
//   SMTP_USER  - noreply@sumdebetta.com
//   SMTP_PASS  - password mailbox
//   SMTP_FROM  - display "SUMDE BETTA <noreply@sumdebetta.com>"
//
// Rate limiting bukan di sini — layer atas (endpoint) yang atur pakai
// src/lib/rateLimit.js supaya tidak abuse email quota provider.

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const err = new Error(
      'SMTP belum di-konfigurasi. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.'
    );
    err.status = 500;
    throw err;
  }

  const port = Number(SMTP_PORT);
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return cachedTransporter;
}

/**
 * Kirim email HTML. Throw dengan `.status = 500` kalau SMTP misconfig atau
 * provider tolak — caller wrap dalam try/catch route handler standar.
 */
export async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || `SUMDE BETTA <${process.env.SMTP_USER}>`;
  const transporter = getTransporter();
  return transporter.sendMail({ from, to, subject, html, text });
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
// Dibuat sederhana + inline CSS — email client (Gmail, Outlook) strip <style>
// tag dan tidak dukung CSS variables. Design system SUMDE BETTA tidak berlaku
// di dalam mailbox.
// ---------------------------------------------------------------------------

const BRAND = {
  primary: '#EAB308', // yellow
  primaryDark: '#A16207',
  text: '#111827',
  muted: '#6B7280',
  bg: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
};

function baseTemplate({ headline, bodyHtml, footerHtml = '', maxWidth = 520 }) {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${maxWidth}px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primary};padding:18px 24px;">
              <div style="font-size:18px;font-weight:900;color:#1a1a1a;letter-spacing:1px;">SUMDE BETTA</div>
              <div style="font-size:11px;color:${BRAND.primaryDark};font-weight:700;letter-spacing:0.5px;">KOLEKSI AKUATIK EKSKLUSIF</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 22px;">
              ${headline ? `<h1 style="margin:0 0 16px;font-size:19px;font-weight:800;color:${BRAND.text};">${headline}</h1>` : ''}
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.bg};padding:16px 22px;font-size:11px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};line-height:1.5;">
              ${footerHtml || 'Faktur ini dikirim otomatis oleh sistem SUMDE BETTA sebagai bukti transaksi yang sah.'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpEmailTemplate({ name, otp, expiresMinutes }) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Halo ${name || 'Pelanggan'},<br/>
      Terima kasih sudah mendaftar di SUMDE BETTA. Gunakan kode di bawah untuk verifikasi email kamu:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:${BRAND.bg};border:2px dashed ${BRAND.primary};border-radius:8px;padding:16px 32px;font-size:32px;font-weight:900;letter-spacing:8px;color:${BRAND.text};">
        ${otp}
      </div>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};line-height:1.6;">
      Kode berlaku ${expiresMinutes} menit. Kalau kamu tidak mendaftar, abaikan email ini.
    </p>
  `;
  return baseTemplate({ headline: 'Verifikasi Email Kamu', bodyHtml });
}

const formatIDR = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

/** Email Faktur Resmi: order sudah dibayar → LUNAS / PROCESSING. */
export function orderPaidEmailTemplate({
  name,
  orderId,
  createdAt,
  paymentMethod,
  items = [],
  subtotal,
  shippingFee = 0,
  paymentFee = 0,
  total,
  shippingCourier,
  shippingService,
  recipient = {},
  orderUrl,
}) {
  const invoiceNumber = `INV-${String(orderId).slice(0, 8).toUpperCase()}`;
  const transactionDate = new Date(createdAt || Date.now()).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  const recipientName = recipient.name || name || 'Pelanggan';
  const recipientPhone = recipient.phone ? ` · ${recipient.phone}` : '';
  const fullAddress = [
    recipient.streetAddress,
    recipient.rtRw ? `RT/RW ${recipient.rtRw}` : null,
    recipient.village ? `Kel. ${recipient.village}` : null,
    recipient.district ? `Kec. ${recipient.district}` : null,
    recipient.city,
    recipient.province,
    recipient.postalCode,
  ].filter(Boolean).join(', ') || '-';

  const courierLabel = shippingCourier
    ? `${shippingCourier.toUpperCase()} ${shippingService ? `(${shippingService})` : ''}`
    : 'Ekspedisi Reguler';

  const methodLabel = paymentMethod ? `DOKU (${paymentMethod})` : 'DOKU Checkout';

  // Render item rows
  const itemRowsHtml = (items && items.length > 0)
    ? items.map((item) => {
        const prodName = item.customName || item.product?.name || 'Koleksi Ikan Betta';
        const sizeInfo = item.selectedSize
          ? `<div style="font-size:11px;color:${BRAND.muted};margin-top:2px;">Ukuran/Varian: <b>${item.selectedSize}</b></div>`
          : '';
        const qty = item.quantity || 1;
        const price = item.price || 0;
        const lineTotal = price * qty;

        return `
          <tr style="border-bottom:1px solid ${BRAND.border};">
            <td style="padding:10px 8px;font-size:13px;color:${BRAND.text};line-height:1.4;">
              <span style="font-weight:600;">${prodName}</span>
              ${sizeInfo}
            </td>
            <td style="padding:10px 8px;font-size:13px;color:${BRAND.text};text-align:center;">
              ${qty}
            </td>
            <td style="padding:10px 8px;font-size:13px;color:${BRAND.text};text-align:right;">
              ${formatIDR(price)}
            </td>
            <td style="padding:10px 8px;font-size:13px;color:${BRAND.text};text-align:right;font-weight:700;">
              ${formatIDR(lineTotal)}
            </td>
          </tr>
        `;
      }).join('')
    : `
      <tr style="border-bottom:1px solid ${BRAND.border};">
        <td colspan="3" style="padding:12px 8px;font-size:13px;color:${BRAND.text};">
          Pesanan #${orderId.slice(0, 8).toUpperCase()}
        </td>
        <td style="padding:12px 8px;font-size:13px;color:${BRAND.text};text-align:right;font-weight:700;">
          ${formatIDR(total)}
        </td>
      </tr>
    `;

  const calculatedSubtotal = subtotal !== undefined
    ? subtotal
    : Math.max(0, (total || 0) - (shippingFee || 0) - (paymentFee || 0));

  const bodyHtml = `
    <!-- Header Faktur & Status Badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:11px;font-weight:700;color:${BRAND.muted};letter-spacing:1px;text-transform:uppercase;">FAKTUR PEMBAYARAN</div>
          <div style="font-size:18px;font-weight:800;color:${BRAND.text};margin-top:2px;">${invoiceNumber}</div>
          <div style="font-size:12px;color:${BRAND.muted};margin-top:2px;">${transactionDate}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <span style="display:inline-block;background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;font-size:12px;font-weight:800;padding:4px 12px;border-radius:6px;letter-spacing:0.5px;">
            LUNAS
          </span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${BRAND.text};">
      Halo <b>${recipientName}</b>, pembayaran pesanan Anda telah berhasil kami terima. Tim kami sedang menyiapkan koleksi pilihan Anda untuk proses kurasi, pengemasan oksigen aman, dan pengiriman.
    </p>

    <!-- Info Alamat & Pengiriman -->
    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;line-height:1.6;">
      <div style="font-weight:700;color:${BRAND.text};margin-bottom:4px;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">Tujuan Pengiriman:</div>
      <div style="color:${BRAND.text};font-weight:600;">${recipientName}<span style="color:${BRAND.muted};font-weight:normal;">${recipientPhone}</span></div>
      <div style="color:${BRAND.muted};margin-top:2px;">${fullAddress}</div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${BRAND.border};color:${BRAND.muted};">
        Kurir: <b style="color:${BRAND.text};">${courierLabel}</b> &nbsp;|&nbsp; Metode: <b style="color:${BRAND.text};">${methodLabel}</b>
      </div>
    </div>

    <!-- Tabel Rincian Produk -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr style="background:${BRAND.bg};border-top:1px solid ${BRAND.border};border-bottom:1px solid ${BRAND.border};">
          <th style="padding:8px 8px;font-size:11px;font-weight:700;color:${BRAND.muted};text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
          <th style="padding:8px 8px;font-size:11px;font-weight:700;color:${BRAND.muted};text-align:center;text-transform:uppercase;letter-spacing:0.5px;width:40px;">Qty</th>
          <th style="padding:8px 8px;font-size:11px;font-weight:700;color:${BRAND.muted};text-align:right;text-transform:uppercase;letter-spacing:0.5px;width:95px;">Harga</th>
          <th style="padding:8px 8px;font-size:11px;font-weight:700;color:${BRAND.muted};text-align:right;text-transform:uppercase;letter-spacing:0.5px;width:105px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRowsHtml}
      </tbody>
    </table>

    <!-- Rincian Biaya / Breakdown Keuangan -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="width:40%;"></td>
        <td style="width:60%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;line-height:1.7;">
            <tr>
              <td style="color:${BRAND.muted};">Subtotal Produk</td>
              <td style="text-align:right;color:${BRAND.text};">${formatIDR(calculatedSubtotal)}</td>
            </tr>
            <tr>
              <td style="color:${BRAND.muted};">Ongkos Kirim</td>
              <td style="text-align:right;color:${BRAND.text};">${formatIDR(shippingFee)}</td>
            </tr>
            ${paymentFee > 0 ? `
            <tr>
              <td style="color:${BRAND.muted};">Biaya Layanan</td>
              <td style="text-align:right;color:${BRAND.text};">${formatIDR(paymentFee)}</td>
            </tr>
            ` : ''}
            <tr style="border-top:2px solid ${BRAND.border};">
              <td style="padding-top:8px;font-weight:800;font-size:14px;color:${BRAND.text};">Total Lunas</td>
              <td style="padding-top:8px;text-align:right;font-weight:900;font-size:17px;color:${BRAND.primaryDark};">${formatIDR(total)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Garansi & Catatan Keamanan Ikan -->
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;margin-bottom:24px;font-size:12px;line-height:1.5;color:#92400E;">
      <b>Jaminan 100% Ikan Hidup (DOA):</b> Semua pesanan ikan hidup dikemas dengan kantong oksigen ganda dan peredam guncangan. Jika terdapat kendala saat kedatangan, rekam video unboxing tanpa jeda dan laporkan dalam waktu 1x24 jam sejak paket diterima.
    </div>

    <!-- Tombol Aksi -->
    <div style="text-align:center;margin:16px 0 8px 0;">
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND.primary};color:#1a1a1a;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:0.3px;">
        Lacak Status Pesanan
      </a>
    </div>
  `;

  return baseTemplate({ headline: '', bodyHtml });
}

/** Email: order dikirim → SHIPPED, AWB sudah keluar. */
export function orderShippedEmailTemplate({ name, orderId, courier, waybill, orderUrl }) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Halo ${name || 'Pelanggan'},<br/>
      Pesanan <b>#${orderId.slice(0, 8)}</b> sudah dikirim via <b>${(courier || '').toUpperCase()}</b>.
    </p>
    <div style="background:${BRAND.bg};border:2px dashed ${BRAND.primary};border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;">
      <div style="font-size:12px;color:${BRAND.muted};">NOMOR RESI (AWB)</div>
      <div style="font-size:22px;font-weight:900;letter-spacing:2px;color:${BRAND.text};margin-top:4px;">${waybill}</div>
    </div>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;">
      Ikan hidup kami kemas dengan oksigen dan wadah aman. Estimasi 1-3 hari sampai
      (tergantung jarak). Segera buka paket saat sampai untuk kondisi ikan terbaik.
    </p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND.primary};color:#1a1a1a;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:14px;">
        Lacak Pesanan
      </a>
    </div>
  `;
  return baseTemplate({ headline: 'Pesanan Dikirim 📦', bodyHtml });
}

export function passwordResetEmailTemplate({ name, resetUrl, expiresMinutes }) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Halo ${name || 'Pelanggan'},<br/>
      Kami menerima permintaan reset password untuk akun kamu. Klik tombol di bawah untuk buat password baru:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:${BRAND.primary};color:#1a1a1a;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;">
        Reset Password
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};line-height:1.6;">
      Link berlaku ${expiresMinutes} menit. Kalau kamu tidak minta reset, abaikan email ini — password kamu tetap aman.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};line-height:1.6;word-break:break-all;">
      Kalau tombol tidak berfungsi, salin link berikut ke browser:<br/>
      <span style="color:${BRAND.primaryDark};">${resetUrl}</span>
    </p>
  `;
  return baseTemplate({ headline: 'Reset Password', bodyHtml });
}
