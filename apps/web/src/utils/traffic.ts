
import { db } from '../lib/firebase';
import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

export const incrementDailyVisitors = async () => {
    try {
        // Prevent multiple counts per session
        const sessionKey = `spendigo_visit_${new Date().toISOString().split('T')[0]}`;
        if (sessionStorage.getItem(sessionKey)) {
            return;
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const statsRef = doc(db, 'stats', 'traffic');

        // Check if doc exists, if not create it
        const docSnap = await getDoc(statsRef);

        if (!docSnap.exists()) {
            await setDoc(statsRef, {
                [`daily_visits.${today}`]: 1,
                [`daily_visits.total`]: 1
            });
        } else {
            // Update the map field for specific date
            // Note: In Firestore, updating nested map keys requires a specific syntax or flattening
            // For simplicity, we assume "daily_visits" is a Map.
            await updateDoc(statsRef, {
                [`daily_visits.${today}`]: increment(1),
                [`daily_visits.total`]: increment(1)
            });
        }

        // Mark session as counted
        sessionStorage.setItem(sessionKey, 'true');
        console.log('📈 Visitor count incremented via API');

    } catch (error) {
        console.error("Failed to increment traffic stats", error);
        // Silent fail is acceptable for analytics
    }
};
