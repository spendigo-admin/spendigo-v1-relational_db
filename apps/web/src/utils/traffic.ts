
import { db } from '../lib/firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

export const incrementDailyVisitors = async () => {
    const sessionKey = `spendigo_visit_${new Date().toISOString().split('T')[0]}`;
    if (sessionStorage.getItem(sessionKey)) return;

    // Set the guard before the write so a permission-denied error doesn't cause
    // infinite retries on every route change in ConsumerLayout.
    sessionStorage.setItem(sessionKey, 'true');

    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const statsRef = doc(db, 'stats', 'traffic');

        await setDoc(statsRef, {
            [`daily_visits.${today}`]: increment(1),
            [`daily_visits.total`]: increment(1)
        }, { merge: true });

    } catch (error) {
        console.error("Failed to increment traffic stats", error);
    }
};
