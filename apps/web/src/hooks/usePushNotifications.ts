import { useState, useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { messaging, db } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const MAX_FCM_TOKENS = 5;

async function persistToken(userId: string, newToken: string) {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    const data = snap.data();
    const existing: string[] = data?.fcmTokens ?? [];

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
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'prompt' | 'denied' | 'granted'>('default');

    const isNative = Capacitor.isNativePlatform();

    useEffect(() => {
        if (isNative) {
            PushNotifications.checkPermissions().then((res) => {
                setPermissionStatus(res.receive as any);
            });
        } else if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }, [isNative]);

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
        if (isNative) {
            // NATIVE FLOW
            try {
                let perm = await PushNotifications.checkPermissions();
                if (perm.receive === 'prompt') {
                    perm = await PushNotifications.requestPermissions();
                }

                if (perm.receive === 'granted') {
                    await PushNotifications.register();
                    
                    // Listeners for native registration
                    PushNotifications.addListener('registration', async ({ value }) => {
                        setToken(value);
                        if (userId) await persistToken(userId, value);
                    });

                    PushNotifications.addListener('registrationError', (error) => {
                        console.error('Native registration error:', error);
                    });

                    return true;
                }
            } catch (e) {
                console.error('Native permission request failed:', e);
            }
            return false;
        } else {
            // WEB FLOW
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
        }
        return false;
    };

    const disableNotifications = async () => {
        if (!userId) return;
        try {
            if (isNative) {
                // For native, we just stop listening or unregister if needed
                // But usually we just remove the token from the DB
                if (token) {
                    await updateDoc(doc(db, 'users', userId), {
                        fcmTokens: arrayRemove(token)
                    });
                    setToken(null);
                }
            } else {
                const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
                const registration = await navigator.serviceWorker.ready;
                const currentToken = await getToken(messaging!, { vapidKey, serviceWorkerRegistration: registration });

                if (currentToken) {
                    await updateDoc(doc(db, 'users', userId), {
                        fcmTokens: arrayRemove(currentToken)
                    });
                    setToken(null);
                }
            }
            return true;
        } catch (error) {
            console.error('Error disabling notifications:', error);
            return false;
        }
    };

    // Auto-register native on load if permission granted
    useEffect(() => {
        if (isNative && userId) {
            PushNotifications.checkPermissions().then(async (res) => {
                if (res.receive === 'granted') {
                    await PushNotifications.register();
                    PushNotifications.addListener('registration', async ({ value }) => {
                        setToken(value);
                        await persistToken(userId, value);
                    });
                }
            });
        }
    }, [isNative, userId]);

    // Refresh token (Web only, Native is handled by listeners)
    useEffect(() => {
        if (isNative || !messaging || !userId) return;
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
    }, [userId, isNative]);

    return { token, permissionStatus, requestPermission, disableNotifications };
}
