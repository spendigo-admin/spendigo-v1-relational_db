
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const useTrafficStats = () => {
    const [stats, setStats] = useState({
        today: 0,
        yesterday: 0,
        last7Days: 0,
        last30Days: 0,
        last365Days: 0,
        percentChange: 0,
        loading: true
    });

    useEffect(() => {
        const statsRef = doc(db, 'stats', 'traffic');

        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const visits = data.daily_visits || {};

                const todayStr = new Date().toISOString().split('T')[0];
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                const todayCount = visits[todayStr] || 0;
                const yesterdayCount = visits[yesterdayStr] || 0; // Fallback to 0

                // Helper to sum past N days
                const getSum = (days: number) => {
                    let sum = 0;
                    for (let i = 0; i < days; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateStr = d.toISOString().split('T')[0];
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
                    loading: false
                });
            } else {
                setStats(prev => ({ ...prev, loading: false }));
            }
        }, (error) => {
            console.error("Error fetching traffic stats", error);
        });

        return () => unsubscribe();
    }, []);

    return stats;
};
