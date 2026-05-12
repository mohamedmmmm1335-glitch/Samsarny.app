importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAUt5G3o2CRa_hW3TF6aoRDqlj00h_duiY',
  authDomain: 'samsarny-5a5c2.firebaseapp.com',
  databaseURL: 'https://samsarny-5a5c2-default-rtdb.firebaseio.com',
  projectId: 'samsarny-5a5c2',
  storageBucket: 'samsarny-5a5c2.firebasestorage.app',
  messagingSenderId: '891182543023',
  appId: '1:891182543023:web:a86920f36595c11a3f645a',
  measurementId: 'G-TGT9PCJGM9'
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
