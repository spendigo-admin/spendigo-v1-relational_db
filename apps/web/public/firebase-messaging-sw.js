// Service worker for Firebase Cloud Messaging background push notifications.
// Firebase compat libs are required here — ESM/import.meta.env not available in SW context.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Firebase is initialized when the main thread sends the config via postMessage.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        const config = event.data.config;
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            showPushNotification(payload);
        });
    }
});

function showPushNotification(payload) {
    const title = payload.notification?.title || 'New Update';
    const options = {
        body: payload.notification?.body || '',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        // Preserve all data fields so the notificationclick handler can route correctly
        data: payload.data || {},
        // Tag by orderId or type to deduplicate repeated status updates for the same order
        tag: payload.data?.orderId || payload.data?.type || 'spendigo',
        requireInteraction: false,
    };
    self.registration.showNotification(title, options);
}

// Navigate the user to the relevant page when they tap a push notification.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const link = event.notification.data?.link || '/';
    // Normalise to absolute URL so clients.openWindow works cross-origin
    const targetUrl = new URL(link, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus an existing tab if it already has the app open
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            return self.clients.openWindow(targetUrl);
        })
    );
});
