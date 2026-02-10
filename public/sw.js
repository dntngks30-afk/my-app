/**
 * Service Worker for Push Notifications
 * 
 * 푸시 알림 수신 및 표시 처리
 */

self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};

  const options = {
    title: data.title || '운동 루틴 알림',
    body: data.body || '오늘의 운동을 확인하세요.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {},
    tag: data.tag || 'workout-notification',
    requireInteraction: false,
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(options.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/my-routine';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        // 이미 열려있는 창이 있으면 포커스
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
