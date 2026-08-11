// Service Worker untuk browser push notification SUMDE BETTA.
// Terima payload push, tampilkan notification, klik → buka URL.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SUMDE BETTA', body: event.data.text() };
  }
  const title = payload.title || 'SUMDE BETTA';
  const options = {
    body: payload.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { link: payload.link || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Kalau ada tab yang sudah buka origin sama, focus + navigate.
      for (const w of wins) {
        if ('focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(link);
          return;
        }
      }
      // Kalau tidak ada tab terbuka, buka baru.
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
