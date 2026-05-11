
import { db } from './firebase';
import { doc, setDoc, increment } from 'firebase/firestore';

/**
 * Generates a local date string (YYYY-MM-DD) that is timezone-aware.
 * This prevents the 'date shifting' common with .toISOString().
 */
export const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Tracks a unique application visit per user per day.
 * Uses localStorage to deduplicate counts within a 24h window.
 */
export const trackVisit = async () => {
    try {
        const dateStr = getLocalDateString();
        const lastTracked = localStorage.getItem('last_tracked_visit');

        // Only track once per day per device
        if (lastTracked === dateStr) return;

        const statsRef = doc(db, 'stats', 'traffic');

        // Atomically increment the daily_visits map for the current date
        await setDoc(statsRef, {
            daily_visits: {
                [dateStr]: increment(1)
            }
        }, { merge: true });

        // Save to localStorage to avoid double-counting on refresh
        localStorage.setItem('last_tracked_visit', dateStr);
        
        console.log(`[Analytics] Tracked visit for ${dateStr}`);
    } catch (error) {
        console.error("[Analytics] Failed to track visit:", error);
    }
};
