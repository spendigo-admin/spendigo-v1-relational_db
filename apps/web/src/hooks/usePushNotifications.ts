import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { messaging, db } from '../lib/firebase';

const MAX_FCM_TOKENS = 5;

async function persistToken(userId: string, newToken: string) {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    const existing: string[] = snap.data()?.fcmTokens ?? [];

    // If we already have the token, nothing to do
    if (existing.includes(newToken)) return;

    if (existing.length >= MAX_FCM_TOKENS) {
        // Remove the oldest token (first in array) to keep the list bounded
        await updateDoc(userRef, {
            fcmTokens: arrayRemove(existing[0])
        });
    }

    await updateDoc(userRef, {
        fcmTokens: arrayUnion(newToken)
    });
}

export function usePushNotifications(userId?: string) {
    const [token, setToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

    useEffect(() => {
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }, []);

    const registerServiceWorker = async () => {
        if (!('serviceWorker' in navigator)) return null;

        try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            // console.log('Service worker registered.');

            const sendConfig = (sw: ServiceWorker) => {
                sw.postMessage({
                    type: 'FIREBASE_CONFIG',
                    config: {
                        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                        appId: import.meta.env.VITE_FIREBASE_APP_ID
                    }
                });
            };

            if (registration.active) {
                sendConfig(registration.active);
            } else {
                const sw = registration.installing ?? registration.waiting;
                sw?.addEventListener('statechange', (e: Event) => {
                    const target = e.target as ServiceWorker;
                    if (target.state === 'activated') sendConfig(target);
                });
            }
            return registration;
        } catch (err) {
            console.error('SW registration failed', err);
            return null;
        }
    };

    const requestPermission = async () => {
        if (!messaging) return false;
        
        try {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);

            if (permission === 'granted') {
                const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
                if (!vapidKey) return false;

                const registration = await registerServiceWorker();
                if (!registration) return false;

                const currentToken = await getToken(messaging, { 
                    vapidKey,
                    serviceWorkerRegistration: registration 
                });

                if (currentToken) {
                    setToken(currentToken);
                    if (userId) await persistToken(userId, currentToken);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error requesting notifications:', error);
        }
        return false;
    };

    const disableNotifications = async () => {
        if (!userId) return;
        try {
            // 1. Get current token if possible to remove it specifically
            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            const registration = await navigator.serviceWorker.ready;
            const currentToken = await getToken(messaging!, { vapidKey, serviceWorkerRegistration: registration });

            if (currentToken) {
                const userRef = doc(db, 'users', userId);
                await updateDoc(userRef, {
                    fcmTokens: arrayRemove(currentToken)
                });
                setToken(null);
            }
            return true;
        } catch (error) {
            console.error('Error disabling notifications:', error);
            return false;
        }
    };

    // Refresh token
    useEffect(() => {
        if (!messaging || !userId) return;
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;

        navigator.serviceWorker.ready.then((registration) => {
            getToken(messaging!, { vapidKey, serviceWorkerRegistration: registration })
                .then((refreshedToken) => {
                    if (refreshedToken) {
                        setToken(refreshedToken);
                        persistToken(userId, refreshedToken).catch(console.error);
                    }
                })
                .catch(() => {});
        });
    }, [userId]);

    return { token, permissionStatus, requestPermission, disableNotifications };
}

