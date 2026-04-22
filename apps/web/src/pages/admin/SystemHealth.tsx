import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useNotifications } from '../../context/NotificationContext';

const SystemHealth: React.FC = () => {
    const { addNotification } = useNotifications();

    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [isLoadingHealth, setIsLoadingHealth] = useState(true);
    const [healthError, setHealthError] = useState<string | null>(null);

    const fetchRealHealth = async () => {
        setIsLoadingHealth(true);
        setHealthError(null);
        try {
            const getHealth = httpsCallable(functions, 'getSystemHealth');
            const result = await getHealth();
            const data = result.data as any;
            if (data.success) {
                setSystemHealth(data.categories);
            }
        } catch (err: any) {
            console.error("Failed to fetch real system health:", err);
            setHealthError(err.message || 'Failed to connect to system metrics.');
        } finally {
            setIsLoadingHealth(false);
        }
    };

    useEffect(() => {
        fetchRealHealth();
        const interval = setInterval(fetchRealHealth, 300000); // Every 5 mins
        return () => clearInterval(interval);
    }, []);

    const [settings, setSettings] = useState<any>(null);
    useEffect(() => {
        const docRef = doc(db, 'settings', 'platform');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings(docSnap.data());
            }
        });
        return () => unsubscribe();
    }, []);

    const toggleRegistration = async (type: 'shopper' | 'partner') => {
        if (!settings) return;
        const field = type === 'shopper' ? 'allowShopperRegistrations' : 'allowPartnerRegistrations';
        const newValue = !settings[field];

        try {
            await updateDoc(doc(db, 'settings', 'platform'), {
                [field]: newValue
            });
            addNotification({
                type: 'system',
                title: 'Updated',
                message: `${type.charAt(0).toUpperCase() + type.slice(1)} registrations ${newValue ? 'ENABLED' : 'DISABLED'}`
            });
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to update settings.' });
        }
    };

    return (
        <div className="p-4 md:p-6 animate-fade-in pb-20">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">System Health & Controls</h1>
                <p className="text-sm text-[var(--text-muted)]">Monitor infrastructure consumption and manage global platform states.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* System Controls */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">System Controls</h2>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-main)]">Shopper Signup</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">Allow new registrations</p>
                                </div>
                                <button
                                    onClick={() => toggleRegistration('shopper')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${settings?.allowShopperRegistrations ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'}`}
                                >
                                    {settings?.allowShopperRegistrations ? 'ENABLED' : 'DISABLED'}
                                </button>
                            </div>
                            <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-[var(--text-main)]">Partner Signup</p>
                                    <p className="text-[10px] text-[var(--text-muted)]">Allow new merchant signups</p>
                                </div>
                                <button
                                    onClick={() => toggleRegistration('partner')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${settings?.allowPartnerRegistrations ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200' : 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'}`}
                                >
                                    {settings?.allowPartnerRegistrations ? 'ENABLED' : 'DISABLED'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                                    Firebase Consumption
                                    <button
                                        onClick={fetchRealHealth}
                                        disabled={isLoadingHealth}
                                        title="Refresh Stats"
                                        className={`text-sm p-1 rounded-full hover:bg-[var(--surface-1)] transition-all ${isLoadingHealth ? 'animate-spin opacity-50' : 'hover:rotate-180'}`}
                                    >
                                        ↻
                                    </button>
                                </h2>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Real-time Usage Stats</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href="https://console.firebase.google.com/"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold bg-[#FFCA28]/10 text-[#F57C00] border border-[#FFCA28]/20 px-3 py-1.5 rounded-full hover:bg-[#FFCA28]/20 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <span className="w-2 h-2 bg-[#F57C00] rounded-full animate-pulse"></span>
                                    Firebase Console ↗
                                </a>
                            </div>
                        </div>

                        {healthError ? (
                            <div className="p-6 bg-red-50 rounded-xl border border-red-100 text-center">
                                <p className="text-red-700 text-sm font-medium mb-3">{healthError}</p>
                                <button
                                    onClick={fetchRealHealth}
                                    className="text-xs bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-all"
                                >
                                    Retry Connection
                                </button>
                                <p className="text-[10px] text-red-400 mt-2">Ensure your account has Admin role and IAM Monitoring Viewer permissions are set.</p>
                            </div>
                        ) : isLoadingHealth && !systemHealth ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-gray-50 rounded-xl border border-gray-100"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {systemHealth && Object.entries(systemHealth).map(([category, stats]: [string, any]) => (
                                    <div key={category} className="bg-[var(--surface-1)] p-4 rounded-xl border border-[var(--glass-border)]">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4 text-[var(--text-muted)] flex justify-between">
                                            {category}
                                            {Object.values(stats).some((s: any) => s.used > s.limit) && (
                                                <span className="text-red-600 animate-bounce">ALERT: LIMIT EXCEEDED</span>
                                            )}
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4">
                                            {Object.entries(stats).map(([key, data]: [string, any]) => {
                                                const percent = (data.used / data.limit) * 100;
                                                const isExceeded = data.used > data.limit;
                                                return (
                                                    <div key={key}>
                                                        <div className="flex justify-between items-end mb-1.5">
                                                            <span className="text-xs font-semibold text-[var(--text-main)] capitalize">
                                                                {key.replace(/([A-Z])/g, ' $1')}
                                                            </span>
                                                            <span className={`text-[10px] font-bold ${isExceeded ? 'text-red-600' : 'text-[var(--brand-primary)]'}`}>
                                                                {typeof data.used === 'number' && data.used < 1 && data.used > 0 ? data.used.toFixed(2) : Math.round(data.used).toLocaleString()}
                                                                <span className="text-gray-400 font-normal"> / {data.limit.toLocaleString()} {data.unit}</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-100 relative">
                                                            <div
                                                                className={`h-full transition-all duration-1000 ease-out ${isExceeded ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-[var(--brand-primary)]'}`}
                                                                style={{ width: `${Math.min(100, percent)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
