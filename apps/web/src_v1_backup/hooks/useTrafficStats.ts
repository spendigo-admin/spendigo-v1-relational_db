import { useState, useEffect, useCallback } from 'react';
import { db, functions } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getLocalDateString } from '../lib/analytics';

export const useTrafficStats = () => {
    const [stats, setStats] = useState({
        today: 0,
        yesterday: 0,
        last7Days: 0,
        last30Days: 0,
        last365Days: 0,
        percentChange: 0,
        loading: true,
        source: 'Unknown',
        lastSynced: null as Date | null
    });

    const [isSyncing, setIsSyncing] = useState(false);

    const refreshStats = useCallback(async () => {
        setIsSyncing(true);
        try {
            const syncFn = httpsCallable(functions, 'syncTrafficStats');
            await syncFn();
            return { success: true };
        } catch (error) {
            console.error("Failed to sync GA4 stats:", error);
            return { success: false, error };
        } finally {
            setIsSyncing(false);
        }
    }, []);

    useEffect(() => {
        const statsRef = doc(db, 'stats', 'traffic');

        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const visits = data.daily_visits || {};

                const todayStr = getLocalDateString();
                
                // Yesterday logic: subtract 24h from now and get that local date
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

                const todayCount = visits[todayStr] || 0;
                const yesterdayCount = visits[yesterdayStr] || 0; 

                // Helper to sum past N days
                const getSum = (days: number) => {
                    let sum = 0;
                    for (let i = 0; i < days; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        sum += (visits[dateStr] || 0);
                    }
                    return sum;
                };

                let change = 0;
                if (yesterdayCount > 0) {
                    change = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
                } else if (todayCount > 0) {
                    change = 100; // 100% growth if started from 0
                }

                setStats({
                    today: todayCount,
                    yesterday: yesterdayCount,
                    last7Days: getSum(7),
                    last30Days: getSum(30),
                    last365Days: getSum(365),
                    percentChange: change,
                    loading: false,
                    source: data.source || 'Direct',
                    lastSynced: data.last_synced?.toDate() || null
                });
            } else {
                setStats(prev => ({ ...prev, loading: false }));
            }
        }, (error) => {
            console.error("Error fetching traffic stats", error);
        });

        return () => unsubscribe();
    }, []);

    return { ...stats, refreshStats, isSyncing };
};
