// This service worker captures background push messages when the app is closed or in the background.
// Firebase will automatically try to import this file when registering service workers.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Parse the query parameters or inject the firebase config before loading
// However, the standard approach is to let the user deploy environment variables via script loading.
// For modern bundlers, we use query params or self.firebaseConfig injected.
// Since this is public/ dir, we have to hardcode or use a standalone script strategy.
// The easiest is initializing with standard environment config. 
// BUT we can't use import.meta.env here. 

// A common approach for service workers without bundlers is using URL params in the register call
// `navigator.serviceWorker.register('/firebase-messaging-sw.js?apiKey=...')`
// Let's implement dynamic config reading from URL search params:

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    // We can receive config dynamically via postMessage from the main thread
    if (event.data && event.data.type === 'FIREBASE_CONFIG') {
        const config = event.data.config;
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
            const messaging = firebase.messaging();
            
            // Handle background messages
            messaging.onBackgroundMessage((payload) => {
                console.log('[firebase-messaging-sw.js] Received background message ', payload);
                const notificationTitle = payload.notification?.title || 'New Update';
                const notificationOptions = {
                    body: payload.notification?.body || '',
                    icon: '/icon-192x192.png'
                };
            
                self.registration.showNotification(notificationTitle, notificationOptions);
            });
        }
    }
});
