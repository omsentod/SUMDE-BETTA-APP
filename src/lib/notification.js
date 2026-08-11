import prisma from '@/lib/prisma';

// Dispatcher notifikasi — fanout ke multiple channel.
// Setiap channel best-effort: gagal 1 tidak menghentikan yang lain.
// Design: trigger point (misal webhook DOKU) tinggal panggil createNotification,
// tidak perlu tahu detail Ably/push/email.
//
// Channel priority:
//   1. DB (source of truth — bell inbox baca dari sini)
//   2. Ably (realtime push ke browser aktif)
//   3. Browser push (untuk user yang sudah subscribe)
//   4. Email (untuk event penting yang layak dinotif via inbox)

/**
 * @param {object} args
 * @param {string} args.userId - target user
 * @param {string} args.type - kunci event: 'order.new' | 'order.paid' | 'order.shipped' | ...
 * @param {string} args.title - judul singkat
 * @param {string} args.body - isi 1-2 kalimat
 * @param {string} [args.link] - deep link relatif (misal /admin/orders?status=PENDING)
 * @param {object} [args.channels] - override channel dispatch. Default: {db:true, ably:true, push:true, email:false}
 * @returns {Promise<{notification, deliveries: {db, ably, push, email}}>}
 */
export async function createNotification({ userId, type, title, body, link, channels = {} }) {
  const opts = { db: true, ably: true, push: true, email: false, ...channels };
  const deliveries = { db: null, ably: null, push: null, email: null };

  // 1. DB — inbox source of truth. Kalau ini gagal, batalkan (tanpa DB tidak
  //    ada notif yang bisa dibaca ulang).
  let notification = null;
  if (opts.db) {
    try {
      notification = await prisma.notification.create({
        data: { userId, type, title, body, link: link || null },
      });
      deliveries.db = { ok: true, id: notification.id };
    } catch (err) {
      console.error('Notification DB write failed:', err.message);
      deliveries.db = { ok: false, error: err.message };
      // DB gagal = tidak lanjut ke channel lain (payload tidak persistent).
      return { notification: null, deliveries };
    }
  }

  // 2. Ably realtime push
  if (opts.ably) {
    try {
      const { publishToUser } = await import('@/lib/ably');
      await publishToUser(userId, 'notification', {
        id: notification?.id,
        type, title, body, link,
        createdAt: notification?.createdAt,
      });
      deliveries.ably = { ok: true };
    } catch (err) {
      console.error('Notification Ably publish failed:', err.message);
      deliveries.ably = { ok: false, error: err.message };
    }
  }

  // 3. Browser push (web-push via saved subscriptions)
  if (opts.push) {
    try {
      const { sendPushToUser } = await import('@/lib/webpush');
      await sendPushToUser(userId, { title, body, link });
      deliveries.push = { ok: true };
    } catch (err) {
      console.error('Notification push send failed:', err.message);
      deliveries.push = { ok: false, error: err.message };
    }
  }

  // 4. Email (opt-in via `channels.email: true`) — dispatcher tidak decide
  //    template-nya. Caller yang panggil sendMail sendiri dengan template
  //    yang sesuai event. Ini hanya flag "email juga dikirim".
  //    Aku sengaja tidak coupling email di sini supaya template stay di
  //    trigger point yang tahu konteks bisnisnya (order paid vs shipped
  //    template berbeda).
  if (opts.email) {
    deliveries.email = { ok: 'caller-managed' };
  }

  return { notification, deliveries };
}

/**
 * Broadcast ke SEMUA admin. Biasa dipakai untuk event operasional
 * (misal order baru masuk — semua admin perlu tahu).
 */
export async function notifyAllAdmins({ type, title, body, link, channels }) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true },
  });
  const results = await Promise.allSettled(
    admins.map((admin) =>
      createNotification({ userId: admin.id, type, title, body, link, channels })
    )
  );
  return { count: admins.length, results };
}
