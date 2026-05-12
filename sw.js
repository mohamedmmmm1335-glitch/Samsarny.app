importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: 'samsarny-5a5c2',
  messagingSenderId: '891182543023',
  apiKey: 'AIzaSyExample', // مش مهم للـ SW
  appId: '1:891182543023:web:samsarny'
});

const messaging = firebase.messaging();

// إشعارات لما الموقع مش مفتوح (background)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'سمسرني', {
    body: body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    tag: 'samsarny-notification',
    renotify: true,
    data: { url: '/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
