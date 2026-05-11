
import { db } from '../lib/firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

export const incrementDailyVisitors = async () => {
    try {
        // Prevent multiple counts per session
        const sessionKey = `spendigo_visit_${new Date().toISOString().split('T')[0]}`;
        if (sessionStorage.getItem(sessionKey)) {
            return;
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const statsRef = doc(db, 'stats', 'traffic');

        // Atomic: setDoc with merge + increment handles both create and update in one operation,
        // eliminating the read-then-write race condition.
        await setDoc(statsRef, {
            [`daily_visits.${today}`]: increment(1),
            [`daily_visits.total`]: increment(1)
        }, { merge: true });

        // Mark session as counted
        sessionStorage.setItem(sessionKey, 'true');

    } catch (error) {
        console.error("Failed to increment traffic stats", error);
        // Silent fail is acceptable for analytics
    }
};
