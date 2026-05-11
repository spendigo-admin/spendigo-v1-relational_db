import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { functions, db } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useNotifications } from '../../context/NotificationContext';

const SystemHealth: React.FC = () => {
    const { addNotification } = useNotifications();

    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [isLoadingHealth, setIsLoadingHealth] = useState(true);
    const [healthError, setHealthError] = useState<string | null>(null);

    const [recentBackups, setRecentBackups] = useState<any[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [scheduledEnabled, setScheduledEnabled] = useState<boolean | null>(null);
    const [isTogglingSchedule, setIsTogglingSchedule] = useState(false);
    const [showRestoreGuide, setShowRestoreGuide] = useState(false);

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

    useEffect(() => {
        const q = query(
            collection(db, 'system_backups'),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        const unsub = onSnapshot(q, (snap) => {
            setRecentBackups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
            const val = snap.data()?.scheduledExportsEnabled;
            setScheduledEnabled(val === undefined ? true : val);
        });
        return () => unsub();
    }, []);

    const handleToggleSchedule = async () => {
        if (scheduledEnabled === null) return;
        setIsTogglingSchedule(true);
        try {
            await setDoc(doc(db, 'settings', 'platform'), { scheduledExportsEnabled: !scheduledEnabled }, { merge: true });
            addNotification({
                type: 'system',
                title: !scheduledEnabled ? 'Scheduled Backups Enabled' : 'Scheduled Backups Paused',
                message: !scheduledEnabled
                    ? 'Daily exports will run at 02:00 UTC.'
                    : 'Daily exports are paused. Manual exports still work.',
            });
        } catch (err: any) {
            addNotification({ type: 'alert', title: 'Toggle Failed', message: err.message });
        } finally {
            setIsTogglingSchedule(false);
        }
    };

    const handleManualExport = async () => {
        setIsTriggering(true);
        try {
            const fn = httpsCallable(functions, 'triggerManualExport');
            await fn({});
            addNotification({ type: 'system', title: 'Export Initiated', message: 'Manual Firestore export started. Check backup status below.' });
        } catch (err: any) {
            addNotification({ type: 'alert', title: 'Export Failed', message: err.message || 'Could not trigger export.' });
        } finally {
            setIsTriggering(false);
        }
    };

    return (
        <div className="p-4 md:p-6 animate-fade-in pb-20">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">System Health</h1>
                <p className="text-sm text-[var(--text-muted)]">Monitor infrastructure consumption and system observability metrics.</p>
            </div>

            <div className="max-w-4xl">

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

                {/* Backup Status */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm mt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Backup Status</h2>
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Scheduled & Manual Exports</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap md:justify-end">
                            {scheduledEnabled !== null && (
                                <>
                                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${scheduledEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                        {scheduledEnabled ? (
                                            <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Daily Active</>
                                        ) : (
                                            <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6" /></svg> Paused</>
                                        )}
                                    </span>
                                    <button
                                        onClick={handleToggleSchedule}
                                        disabled={isTogglingSchedule}
                                        className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-50 border ${scheduledEnabled ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                                    >
                                        {isTogglingSchedule ? (
                                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : scheduledEnabled ? (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        )}
                                        {isTogglingSchedule ? 'Processing...' : scheduledEnabled ? 'Pause Schedule' : 'Resume Schedule'}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleManualExport}
                                disabled={isTriggering}
                                className="text-xs flex items-center gap-1.5 bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {isTriggering ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Triggering...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                                        Trigger Manual Export
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    {recentBackups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 bg-[var(--surface-1)] rounded-xl border border-dashed border-[var(--glass-border)]">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                            </div>
                            <p className="text-sm font-medium text-[var(--text-main)]">No backup records found</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Daily scheduled exports run automatically at 02:00 UTC.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden">
                            <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b border-[var(--glass-border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                <div className="col-span-3">Status</div>
                                <div className="col-span-4">Type</div>
                                <div className="col-span-2">Items</div>
                                <div className="col-span-3 text-right">Date & Time</div>
                            </div>
                            <div className="divide-y divide-[var(--glass-border)]">
                                {recentBackups.map((backup) => {
                                    const isCompleted = backup.status === 'completed';
                                    const isFailed = backup.status === 'failed';
                                    const statusColor = isCompleted ? 'bg-green-100 text-green-700' :
                                        isFailed ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
                                    
                                    return (
                                        <div key={backup.id} className="p-3 hover:bg-[var(--surface-1)] transition-colors flex flex-col md:grid md:grid-cols-12 md:items-center gap-2 md:gap-4">
                                            <div className="col-span-3 flex items-center">
                                                <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                                    {isCompleted && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                                    {isFailed && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                                                    {!isCompleted && !isFailed && <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                                    {backup.status?.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="col-span-4 flex flex-col justify-center min-w-0">
                                                <div className="flex items-center min-w-0">
                                                    <span className="text-xs font-semibold text-[var(--text-main)] capitalize truncate">{backup.type?.replace(/_/g, ' ')}</span>
                                                    {backup.errorMessage && (
                                                        <span className="ml-2 text-[10px] text-red-500 truncate" title={backup.errorMessage}>({backup.errorMessage})</span>
                                                    )}
                                                </div>
                                                {backup.collections && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(backup.collections.critical || []).map((col: string) => (
                                                            <span key={`crit-${col}`} className="text-[8px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wider">{col}</span>
                                                        ))}
                                                        {(backup.collections.highValue || []).map((col: string) => (
                                                            <span key={`high-${col}`} className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">{col}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-2 text-[10px] text-[var(--text-muted)] font-medium">
                                                {backup.userCount ? `${backup.userCount.toLocaleString()} items` : '-'}
                                            </div>
                                            <div className="col-span-3 md:text-right text-[10px] text-[var(--text-muted)]">
                                                {backup.date}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        IAM required: Cloud Datastore Import Export Admin (project-level) + Storage Object Creator on the firestore-backups bucket.
                    </div>

                    {/* Backup & Restore Guide */}
                    <div className="mt-4 border border-[var(--glass-border)] rounded-xl overflow-hidden">
                        <button
                            onClick={() => setShowRestoreGuide(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-1)] hover:bg-gray-50 transition-colors text-left"
                        >
                            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)]">
                                <svg className="w-4 h-4 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                Backup & Restore Guide
                            </span>
                            <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showRestoreGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>

                        {showRestoreGuide && (
                            <div className="p-4 space-y-5 bg-white text-xs text-[var(--text-main)]">

                                {/* What's backed up */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">What Gets Backed Up</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--glass-border)]">
                                            <p className="font-bold text-red-700 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                                                Critical — Daily 02:00 UTC
                                            </p>
                                            <p className="text-[var(--text-muted)] leading-relaxed">orders · audit_logs · audit_logs_meta · payments · users · stores</p>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Path: <code className="bg-gray-100 px-1 rounded">gs://…/daily/YYYY-MM-DD/critical/</code></p>
                                        </div>
                                        <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--glass-border)]">
                                            <p className="font-bold text-blue-700 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                                High-Value — Daily 02:00 UTC
                                            </p>
                                            <p className="text-[var(--text-muted)] leading-relaxed">merchant_products · master_products</p>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Path: <code className="bg-gray-100 px-1 rounded">gs://…/daily/YYYY-MM-DD/high-value/</code></p>
                                        </div>
                                        <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--glass-border)]">
                                            <p className="font-bold text-purple-700 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                                                Auth Users — Daily 03:00 UTC
                                            </p>
                                            <p className="text-[var(--text-muted)] leading-relaxed">All Firebase Auth accounts exported as NDJSON (uid, email, displayName, providerData, customClaims)</p>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Path: <code className="bg-gray-100 px-1 rounded">gs://…/auth-exports/auth_users_YYYY-MM-DD.ndjson</code></p>
                                        </div>
                                        <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--glass-border)]">
                                            <p className="font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                                                Manual Export
                                            </p>
                                            <p className="text-[var(--text-muted)] leading-relaxed">Critical collections only. Always runs regardless of schedule pause state.</p>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Path: <code className="bg-gray-100 px-1 rounded">gs://…/manual/YYYY-MM-DD-{'{'}timestamp{'}'}/critical/</code></p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] mt-2">Retention: 90 days. Bucket: <code className="bg-gray-100 px-1 rounded">spendigo-8540c-firestore-backups</code> (northamerica-northeast1)</p>
                                </div>

                                {/* How to restore */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">How to Restore</p>
                                    <div className="space-y-3">
                                        <div className="bg-gray-900 rounded-lg p-3 text-green-400 font-mono text-[11px] leading-relaxed overflow-x-auto">
                                            <p className="text-gray-500 mb-1"># Restore all critical collections from a specific date</p>
                                            <p>gcloud firestore import \</p>
                                            <p className="pl-4">gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/critical \</p>
                                            <p className="pl-4">--project=spendigo-8540c</p>
                                            <p className="text-gray-500 mt-2 mb-1"># Restore a single collection (e.g. orders only)</p>
                                            <p>gcloud firestore import \</p>
                                            <p className="pl-4">gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/critical \</p>
                                            <p className="pl-4">--collection-ids=orders \</p>
                                            <p className="pl-4">--project=spendigo-8540c</p>
                                        </div>
                                        <div className="bg-[var(--surface-1)] rounded-lg p-3 border border-[var(--glass-border)]">
                                            <p className="font-bold mb-2">Browse available backups</p>
                                            <p className="text-[var(--text-muted)] mb-2">Open Cloud Storage in the GCP console to find the exact export path:</p>
                                            <a
                                                href="https://console.cloud.google.com/storage/browser/spendigo-8540c-firestore-backups"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-[var(--brand-primary)] font-bold hover:underline"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                Open Backup Bucket ↗
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Caveats */}
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Important Caveats</p>
                                    <div className="space-y-2">
                                        {[
                                            { icon: '⚠️', title: 'Import merges, it does not wipe', body: 'Importing writes documents by ID — existing documents are overwritten, new ones are added. To do a full wipe-and-restore, delete the affected collections first via the Firebase console or Admin SDK.' },
                                            { icon: '🔗', title: 'Never restore audit_logs directly', body: 'audit_logs uses a SHA-256 chain. Importing old entries into the live collection breaks the chain. Restore to a shadow collection (e.g. audit_logs_restored_YYYY_MM_DD) for forensic review instead.' },
                                            { icon: '🔑', title: 'Auth passwords cannot be restored', body: 'Firebase Auth password hashes are inaccessible via the Admin SDK. After an auth restore, users with email/password must reset their password. Google/Apple SSO reconnects automatically on next sign-in.' },
                                            { icon: '🕐', title: 'Point-in-Time Recovery (PITR)', body: 'Firestore PITR is enabled and provides 7-day nanosecond-granularity recovery without needing a backup file. Use: gcloud firestore databases restore --source-time="YYYY-MM-DDTHH:MM:SSZ"' },
                                        ].map(({ icon, title, body }) => (
                                            <div key={title} className="flex gap-3 p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--glass-border)]">
                                                <span className="text-base shrink-0">{icon}</span>
                                                <div>
                                                    <p className="font-bold mb-0.5">{title}</p>
                                                    <p className="text-[var(--text-muted)] leading-relaxed">{body}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemHealth;
