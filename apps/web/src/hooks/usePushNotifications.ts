import { useState, useEffect } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { messaging, db } from '../lib/firebase';

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
            console.log('Service worker registered.');
            
            // Wait for SW to be active to pass the configuration
            if (registration.active) {
                registration.active.postMessage({
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
            } else {
                // If it's installing, wait for state change
                registration.installing?.addEventListener('statechange', (e: any) => {
                    if (e.target.state === 'activated') {
                        registration.active?.postMessage({
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
                    }
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
                if (!vapidKey) {
                    console.error("VAPID Key is missing in environment variables.");
                    return false;
                }

                const registration = await registerServiceWorker();
                if (!registration) return false;

                const currentToken = await getToken(messaging, { 
                    vapidKey,
                    serviceWorkerRegistration: registration 
                });

                if (currentToken) {
                    setToken(currentToken);
                    
                    if (userId) {
                        const userRef = doc(db, 'users', userId);
                        await updateDoc(userRef, {
                            fcmTokens: arrayUnion(currentToken)
                        });
                    }
                    return true;
                }
            }
        } catch (error) {
            console.error('An error occurred while retrieving token. ', error);
        }
        return false;
    };

    return { token, permissionStatus, requestPermission };
}
