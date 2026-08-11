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

function baseTemplate({ headline, bodyHtml, footerHtml = '' }) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND.primary};padding:20px 24px;">
              <div style="font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:1px;">SUMDE BETTA</div>
              <div style="font-size:12px;color:${BRAND.primaryDark};font-weight:600;">KOLEKSI AKUATIK EKSKLUSIF</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;">${headline}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.bg};padding:16px 24px;font-size:12px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};">
              ${footerHtml || 'Email ini dikirim otomatis. Jangan balas ke alamat ini.'}
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

/** Email: order sudah dibayar → PROCESSING. */
export function orderPaidEmailTemplate({ name, orderId, total, orderUrl }) {
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Halo ${name || 'Pelanggan'},<br/>
      Pembayaran untuk pesanan <b>#${orderId.slice(0, 8)}</b> sudah kami terima.
      Ikan akan segera kami siapkan untuk pengiriman dalam 1-2 hari kerja.
    </p>
    <div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:8px;padding:12px 16px;margin:16px 0;">
      <div style="font-size:12px;color:${BRAND.muted};">TOTAL DIBAYAR</div>
      <div style="font-size:20px;font-weight:900;color:${BRAND.text};margin-top:4px;">${formatIDR(total)}</div>
    </div>
    <div style="text-align:center;margin:20px 0;">
      <a href="${orderUrl}" style="display:inline-block;background:${BRAND.primary};color:#1a1a1a;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:800;font-size:14px;">
        Lihat Detail Pesanan
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:${BRAND.muted};line-height:1.6;">
      Kami akan kirim email lagi begitu paket dikirim + AWB tersedia.
    </p>
  `;
  return baseTemplate({ headline: 'Pembayaran Diterima ✓', bodyHtml });
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
