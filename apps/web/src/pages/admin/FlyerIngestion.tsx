import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, collection, getDocs, addDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';

const FlyerIngestion = () => {
    const [postalCode, setPostalCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'scraping' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [stepText, setStepText] = useState('');
    const [reportData, setReportData] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [flyerIngestionEnabled, setFlyerIngestionEnabled] = useState(true);
    const [shouldReset, setShouldReset] = useState(false);
    
    // Scheduling State
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
    const [isScheduling, setIsScheduling] = useState(false);

    useEffect(() => {
        const fetchExistingData = async () => {
            try {
                const snap = await getDocs(collection(db, 'public_flyers'));
                if (!snap.empty) {
                    let totalDealsSaved = 0;
                    let processedFlyers = 0;
                    const summaryData: any[] = [];
                    let latestTs = 0;

                    snap.forEach(doc => {
                        const d = doc.data();
                        processedFlyers++;
                        totalDealsSaved += d.dealsCount || 0;
                        summaryData.push({ retailer: d.retailer, dealsCount: d.dealsCount || 0 });
                        if (d.ingestedAt && d.ingestedAt.toMillis() > latestTs) {
                            latestTs = d.ingestedAt.toMillis();
                        }
                    });

                    setReportData({
                        success: true,
                        processedFlyers,
                        totalDealsSaved,
                        summaryData,
                        timestamp: latestTs > 0 ? new Date(latestTs).toLocaleString() : new Date().toLocaleString()
                    });
                    setStatus('complete');
                }
            } catch (e) {
                console.error("Error loading existing flyers", e);
            }
        };
        fetchExistingData();

        const unsubSettings = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
            if (snap.exists()) {
                setFlyerIngestionEnabled(snap.data().flyerIngestionEnabled !== false);
            }
        });

        const unsubJobs = onSnapshot(
            query(collection(db, 'scheduled_ingestion'), orderBy('scheduledAt', 'desc'), limit(5)),
            (snap) => {
                setUpcomingJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        );

        return () => {
            unsubSettings();
            unsubJobs();
        };
    }, []);

    const handleScrape = async () => {
        if (!postalCode) return;
        
        // Basic validation
        const cleanCode = postalCode.replace(/\s+/g, '').toUpperCase();
        if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleanCode)) {
            setStatus('error');
            setErrorMessage('Invalid postal code format. Use A1A1A1.');
            return;
        }

        setStatus('scraping');
        setErrorMessage('');
        setProgress(15);
        setStepText('Connecting to Flipp API...');
        
        try {
            const scrapeFlyer = httpsCallable(functions, 'scrapeFlyer');
            
            setProgress(40);
            setStepText('Fetching flyers & compiling deals...');
            
            const result = await scrapeFlyer({ postalCode: cleanCode, resetData: shouldReset });
            const data: any = result.data;
            
            if (!data.success || data.processedFlyers === 0) {
                setStatus('error');
                setErrorMessage('No grocery flyers found for this postal code.');
                return;
            }

            setProgress(100);
            setStepText('Batch Ingestion Complete!');
            
            setReportData({
                ...data,
                timestamp: new Date().toLocaleString()
            });
            setStatus('complete');

        } catch (error: any) {
            console.error('Ingestion error:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Failed to fetch flyers. See console.');
        }
    };

    const handleScheduleJob = async () => {
        if (!postalCode || !scheduledDate || !scheduledTime) return;

        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (scheduledDateTime.getTime() <= Date.now()) {
            setErrorMessage('Scheduled time must be in the future.');
            return;
        }

        setIsScheduling(true);
        try {
            await addDoc(collection(db, 'scheduled_ingestion'), {
                postalCode: postalCode.replace(/\s+/g, '').toUpperCase(),
                scheduledAt: scheduledDateTime.getTime(),
                shouldReset,
                status: 'pending',
                createdAt: Date.now()
            });
            setScheduledDate('');
            setScheduledTime('');
            setErrorMessage('');
        } catch (e: any) {
            setErrorMessage('Failed to schedule job: ' + e.message);
        } finally {
            setIsScheduling(false);
        }
    };

    const cancelJob = async (jobId: string) => {
        try {
            await deleteDoc(doc(db, 'scheduled_ingestion', jobId));
        } catch (e: any) {
            console.error("Cancel failed", e);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-[var(--text-main)] mb-2">Public Flyer Ingestion</h1>
                <p className="text-[var(--text-muted)] text-sm max-w-2xl">
                    Prototype interface for batch scraping grocery deals from Flipp's API. This will persist all matched grocery flyers and their detailed items into the <code>public_flyers</code> Firestore database.
                </p>
            </header>

            {/* Input Section */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--glass-border)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[var(--brand-primary)]/10 to-transparent rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                
                <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">Batch Ingestion Target</h2>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <input 
                        type="text" 
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                        placeholder="Postal Code (e.g., M5V 2H1)"
                        className="flex-1 bg-[var(--surface-1)] border-none rounded-xl px-4 py-3 text-[var(--text-main)] font-bold tracking-wider focus:ring-2 focus:ring-[var(--brand-primary)] outline-none transition-all"
                        disabled={status === 'scraping' || isScheduling}
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleScrape}
                            disabled={!postalCode || status === 'scraping' || !flyerIngestionEnabled || isScheduling}
                            className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-white font-bold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-[var(--brand-primary)]/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            {status === 'scraping' ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing Batch...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span>Run Immediately</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Reset Toggle */}
                <div className="flex items-center gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 w-fit">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={shouldReset}
                            onChange={(e) => setShouldReset(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Reset existing flyer data before ingestion</span>
                    <span className="text-xs text-red-500 font-black animate-pulse ml-1">DESTRUCTIVE</span>
                </div>

                <div className="border-t border-gray-100 pt-6 mt-2">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Schedule Future Job 🕒</h3>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Run Date</label>
                            <input 
                                type="date" 
                                value={scheduledDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="w-full bg-[var(--surface-1)] border-none rounded-xl px-4 py-3 text-[var(--text-main)] font-bold focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                            />
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 ml-1">Run Time</label>
                            <input 
                                type="time" 
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="w-full bg-[var(--surface-1)] border-none rounded-xl px-4 py-3 text-[var(--text-main)] font-bold focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleScheduleJob}
                            disabled={!postalCode || !scheduledDate || !scheduledTime || !flyerIngestionEnabled || isScheduling}
                            className="bg-white border-2 border-gray-200 text-gray-900 font-bold py-3 px-8 rounded-xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isScheduling ? 'Scheduling...' : 'Schedule Job'}
                        </button>
                    </div>
                </div>

                {!flyerIngestionEnabled && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold flex items-center gap-3 animate-fade-in">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <p>Ingestion Job Service is currently DISABLED in Platform Settings.</p>
                            <p className="text-xs font-medium opacity-80 mt-0.5">Enable it in the Settings panel to run new jobs.</p>
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2 animate-fade-in">
                        <span>⚠️</span> {errorMessage}
                    </div>
                )}

                {/* Progress Bar */}
                {status === 'scraping' && (
                    <div className="mt-8 animate-fade-in">
                        <div className="flex justify-between text-sm mb-2 font-medium">
                            <span className="text-[var(--brand-primary)]">{stepText}</span>
                            <span className="text-[var(--text-muted)]">{progress}%</span>
                        </div>
                        <div className="w-full bg-[var(--surface-1)] rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] h-2.5 rounded-full transition-all duration-300 ease-out relative" 
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse rounded-full" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {status === 'complete' && reportData && (
                <div className="animate-fade-in-up space-y-6">
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--glass-border)]">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-2xl">
                                ✅
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-main)] text-xl">Batch Ingestion Report</h3>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {reportData.timestamp ? `Last ingested on ${reportData.timestamp}` : 'Data successfully persisted to Firestore'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div className="bg-[var(--surface-0)] p-6 rounded-2xl flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
                                    <span className="text-3xl font-black text-[var(--brand-primary)]">{reportData.processedFlyers}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--text-main)] text-lg">Flyers Processed</p>
                                    <p className="text-sm text-[var(--text-muted)]">Matching grocery stores found</p>
                                </div>
                            </div>
                            
                            <div className="bg-[var(--surface-0)] p-6 rounded-2xl flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <span className="text-3xl font-black text-emerald-600">{reportData.totalDealsSaved}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--text-main)] text-lg">Deals Saved</p>
                                    <p className="text-sm text-[var(--text-muted)]">Individual items persisted to DB</p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-[var(--glass-border)] pt-8">
                            <h4 className="font-bold text-[var(--text-main)] mb-4">Breakdown by Retailer</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {reportData.summaryData.map((summary: any, idx: number) => (
                                    <div key={idx} className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-0)]/50 flex flex-col items-center text-center">
                                        <p className="font-bold text-[var(--text-main)] mb-1">{summary.retailer}</p>
                                        <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)]">
                                            <span>🏷️</span>
                                            <span>{summary.dealsCount} items</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="mt-8 flex justify-end">
                            <button 
                                className="px-8 py-3 rounded-xl font-bold bg-[var(--surface-1)] text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-all active:scale-95"
                                onClick={() => { setStatus('idle'); setPostalCode(''); }}
                            >
                                Start New Job
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upcoming Jobs Section */}
            {upcomingJobs.length > 0 && (
                <div className="animate-fade-in space-y-4">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest ml-1">Recent & Upcoming Jobs 📡</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {upcomingJobs.map(job => (
                            <div key={job.id} className="bg-white rounded-2xl p-4 border border-[var(--glass-border)] flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                                        job.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                        job.status === 'failed' ? 'bg-red-50 text-red-600' :
                                        job.status === 'processing' ? 'bg-blue-50 text-blue-600 animate-pulse' :
                                        'bg-gray-50 text-gray-400'
                                    }`}>
                                        {job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : job.status === 'processing' ? '⚙️' : '⏳'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-gray-900 text-sm tracking-tight">{job.postalCode}</p>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${
                                                job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {job.status}
                                            </span>
                                            {job.shouldReset && <span className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-sm uppercase">Full Reset</span>}
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-bold tracking-widest">
                                            {new Date(job.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                </div>
                                
                                {job.status === 'pending' ? (
                                    <button 
                                        onClick={() => cancelJob(job.id)}
                                        className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest px-3 py-1.5 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        Cancel
                                    </button>
                                ) : job.status === 'completed' && job.result && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-emerald-600">{job.result.totalDealsSaved} deals</p>
                                        <p className="text-[8px] text-gray-400 font-bold">{job.result.processedFlyers} flyers</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlyerIngestion;
