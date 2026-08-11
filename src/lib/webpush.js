import webpush from 'web-push';
import prisma from '@/lib/prisma';

// Web Push (VAPID) — kirim notif ke browser user yang sudah subscribe.
//
// Env vars:
//   VAPID_PUBLIC_KEY       - juga expose ke client sebagai NEXT_PUBLIC_VAPID_PUBLIC_KEY
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY - untuk client subscribe
//   VAPID_PRIVATE_KEY      - server sign push
//   VAPID_SUBJECT          - mailto:noreply@sumdebetta.com (kontak untuk push service)
//
// Generate keys: `npx web-push generate-vapid-keys`

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@sumdebetta.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** Kirim payload push ke SEMUA subscription user. Best-effort. */
export async function sendPushToUser(userId, { title, body, link }) {
  if (!configure()) return { skipped: true, reason: 'VAPID not configured' };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { skipped: true, reason: 'no subscription' };

  const payload = JSON.stringify({ title, body, link });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        .catch(async (err) => {
          // 404/410 = subscription mati, cleanup dari DB.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
          throw err;
        })
    )
  );
  return { sent: results.filter((r) => r.status === 'fulfilled').length, total: subs.length };
}

export function isConfigured() {
  return configure();
}
