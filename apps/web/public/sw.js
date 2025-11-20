// Service Worker para Notificaciones Push
const CACHE_NAME = 'pf-app-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Notificación';
  const options = {
    body: data.message || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: data.data || {},
    tag: data.type || 'default',
    requireInteraction: data.priority === 'high',
    vibrate: data.priority === 'high' ? [200, 100, 200] : [200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/dashboard';

  if (data.transactionId) {
    url = '/transactions';
  } else if (data.goalId) {
    url = '/dashboard';
  }

  event.waitUntil(
    clients.openWindow(url)
  );
});

