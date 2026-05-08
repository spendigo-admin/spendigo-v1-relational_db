import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import QRCode from 'react-qr-code';
import { functions, db } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { isFlyerActive } from '../../utils/date-helpers';

const SEGMENTS = [
    { value: 'nearby', label: 'Nearby Customers', description: 'Users within their preferred distance of your store' },
    { value: 'active', label: 'Recent Customers (30d)', description: 'Customers who ordered from you in the last 30 days' },
    { value: 'inactive', label: 'Inactive Customers (30d+)', description: 'Customers who haven\'t ordered in over 30 days' },
    { value: 'high_value', label: 'High-Value Customers', description: 'Top 25% of customers by total spend' },
] as const;

type Segment = typeof SEGMENTS[number]['value'];

export const CAMPAIGN_MESSAGES = [
    "Our latest flyer is live! Check out this week's deals.",
    "New weekly deals just dropped. View our flyer and save big!",
    "Don't miss this week's specials — see our latest flyer now!",
    "Fresh savings in our new flyer. Limited time only!",
    "Your favourite store has new deals. Check our flyer today!",
];

interface CampaignLog {
    id: string;
    segment: Segment;
    message: string;
    sentCount: number;
    failedCount: number;
    timestamp: { seconds: number } | null;
}

const SEGMENT_COLORS: Record<Segment, string> = {
    nearby: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-amber-100 text-amber-700',
    high_value: 'bg-purple-100 text-purple-700',
};

const MerchantMarketing: React.FC = () => {
    const { stores, getStore } = useMarketplace();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);
    const isLocked = stores[storeId]?.status === 'pending_deletion';

    const [campaignMessage, setCampaignMessage] = useState('');
    const [campaignSegment, setCampaignSegment] = useState<Segment>('nearby');
    const [isSending, setIsSending] = useState(false);
    const [recentCampaigns, setRecentCampaigns] = useState<CampaignLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [hasActiveFlyer, setHasActiveFlyer] = useState<boolean | null>(null);

    useEffect(() => {
        if (!storeId) return;
        const fetchLogs = async () => {
            try {
                const q = query(
                    collection(db, 'campaign_logs'),
                    where('storeId', '==', storeId),
                    orderBy('timestamp', 'desc'),
                    limit(5)
                );
                const snap = await getDocs(q);
                setRecentCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignLog)));
            } catch (err) {
                console.error('[Marketing] Failed to load campaign logs:', err);
            } finally {
                setLoadingLogs(false);
            }
        };
        const checkFlyer = async () => {
            try {
                const flyerSnap = await getDocs(collection(db, 'stores', storeId, 'flyers'));
                setHasActiveFlyer(flyerSnap.docs.some(d => isFlyerActive(d.data())));
            } catch {
                setHasActiveFlyer(false);
            }
        };
        fetchLogs();
        checkFlyer();
    }, [storeId]);

    const handleSendCampaign = async () => {
        if (!campaignMessage.trim()) return;
        setIsSending(true);
        try {
            const sendCampaign = httpsCallable<
                { storeId: string; segment: string; message: string; title: string },
                { sentCount: number; failedCount: number }
            >(functions, 'sendCampaign');

            const result = await sendCampaign({
                storeId,
                segment: campaignSegment,
                message: campaignMessage.trim(),
                title: store?.name || 'Special Offer',
            });

            addNotification({
                type: 'system',
                title: 'Campaign Sent',
                message: `Push notification sent to ${result.data.sentCount} customer${result.data.sentCount !== 1 ? 's' : ''}.`
            });

            // Prepend to local log immediately
            const newLog: CampaignLog = {
                id: `local_${Date.now()}`,
                segment: campaignSegment,
                message: campaignMessage.trim(),
                sentCount: result.data.sentCount,
                failedCount: result.data.failedCount,
                timestamp: { seconds: Math.floor(Date.now() / 1000) },
            };
            setRecentCampaigns(prev => [newLog, ...prev].slice(0, 5));
            setCampaignMessage('');
        } catch (error: any) {
            addNotification({
                type: 'alert',
                title: 'Campaign Failed',
                message: error?.message || 'Could not send campaign. Please try again.'
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Printable QR Code Section (Hidden on screen, visible on print) */}
            <div className="hidden print:flex flex-col items-center justify-center w-[100vw] h-[100vh] bg-white text-black text-center print:p-0 print:m-0 overflow-hidden box-border">
                <h1 className="text-5xl md:text-6xl font-black mb-2 leading-tight max-w-[90%]">{store?.name || 'Spendigo Store'}</h1>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-500 mb-10">{store?.businessType || 'Spendigo Partner'}</h2>
                
                <div className="p-6 md:p-8 bg-white border-4 border-gray-100 rounded-[2rem] inline-block mb-10 shadow-sm">
                    <QRCode
                        value={`${window.location.origin}/store/${store?.id}`}
                        size={350}
                        level="H"
                    />
                </div>
                
                <p className="text-xl md:text-2xl font-black text-black mb-10 px-4 max-w-xl">Scan this code to view our deals and order online!</p>
                
                <div className="mt-auto pb-10">
                    <p className="text-lg md:text-xl font-bold text-gray-400">Powered by Spendigo</p>
                </div>
            </div>

            <div className="p-4 md:p-6 animate-fade-in pb-20 space-y-6 print:hidden">
                <div className="mb-6">
                    <h1 className="text-3xl font-black text-[var(--text-main)] mb-2 flex items-center gap-2">
                        <span>📢</span> Digital Marketing
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm">Tools to promote your store, grow visibility, and reach more customers.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Direct Store Link Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>🔗</span> Direct Link
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Copy your direct store link to share anywhere you'd like.
                            </p>
                        </div>

                        <div className="mt-auto">
                            <div className="flex flex-col gap-2 bg-[var(--surface-1)] p-2 rounded-xl border border-[var(--glass-border)]">
                                <input
                                    readOnly
                                    value={`${window.location.origin}/store/${store?.id}`}
                                    className="w-full bg-white border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-main)] placeholder-gray-400 focus:ring-2 focus:ring-[var(--brand-primary)] px-3 py-2 outline-none"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/store/${store?.id}`);
                                        const btn = document.getElementById('copy-btn');
                                        if (btn) btn.innerText = '✅ Copied!';
                                        setTimeout(() => { if (btn) btn.innerText = '📋 Copy Link'; }, 2000);
                                    }}
                                    id="copy-btn"
                                    className="w-full py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-colors"
                                >
                                    📋 Copy Link
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Social Media Share Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>📱</span> Social Media
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Instantly share your store on popular social networks.
                            </p>
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <a
                                href={`https://twitter.com/intent/tweet?text=Check%20out%20${encodeURIComponent(store?.name || 'our store')}%20on%20Spendigo!&url=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-[#000000] hover:bg-gray-900 rounded-xl text-center text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                            >
                                𝕏 Post on X
                            </a>
                            <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-[#1877F2] hover:bg-[#1864D9] rounded-xl text-center text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md"
                            >
                                Share on Facebook
                            </a>
                        </div>
                    </div>

                    {/* 3. Printable QR Code Widget */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                        <div>
                            <h3 className="font-bold text-xl mb-2 flex items-center gap-2 text-[var(--text-main)]">
                                <span>🖨️</span> Store QR Code
                            </h3>
                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                Display this QR code at checkout for easy physical access.
                            </p>
                        </div>
                        
                        <div className="mt-auto">
                            <button
                                onClick={() => {
                                    if (isLocked) {
                                        addNotification({ type: 'alert', title: 'Actions Restricted', message: 'Campaign tools are disabled during the store deletion grace period.' });
                                        return;
                                    }
                                    window.print();
                                }}
                                disabled={isLocked}
                                className="w-full py-3 bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--glass-border)] rounded-xl text-base font-bold shadow-sm hover:bg-[var(--glass-border)] transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLocked ? '🚫 Actions Restricted' : '🖨️ Print High-Res Poster'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Push Campaign Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Send Campaign */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                        <h3 className="font-bold text-xl mb-1 flex items-center gap-2 text-[var(--text-main)]">
                            <span>📣</span> Send Push Campaign
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm mb-5">
                            Reach customers directly on their device with a targeted message.
                        </p>

                        <div className="space-y-4">
                            {hasActiveFlyer === false && (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <span className="text-lg shrink-0">📋</span>
                                    <div>
                                        <p className="font-bold">No active flyer</p>
                                        <p className="text-xs mt-0.5">You need an active flyer to send push campaigns. <a href="/merchant/flyers" className="underline font-semibold">Upload a flyer →</a></p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Audience</label>
                                <select
                                    value={campaignSegment}
                                    onChange={e => setCampaignSegment(e.target.value as Segment)}
                                    className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)] bg-white"
                                >
                                    {SEGMENTS.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    {SEGMENTS.find(s => s.value === campaignSegment)?.description}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Message</label>
                                <select
                                    value={campaignMessage}
                                    onChange={e => setCampaignMessage(e.target.value)}
                                    className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)] bg-white"
                                >
                                    <option value="">— Select a message —</option>
                                    {CAMPAIGN_MESSAGES.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleSendCampaign}
                                disabled={isSending || !campaignMessage || !hasActiveFlyer || isLocked}
                                className="w-full py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 shadow-md shadow-[var(--brand-primary)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSending ? <><span className="animate-spin">⏳</span> Sending...</> : isLocked ? '🚫 Actions Restricted' : '🚀 Send Campaign'}
                            </button>
                        </div>
                    </div>

                    {/* Recent Campaigns */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                        <h3 className="font-bold text-xl mb-1 flex items-center gap-2 text-[var(--text-main)]">
                            <span>📊</span> Recent Campaigns
                        </h3>
                        <p className="text-[var(--text-muted)] text-sm mb-5">Your last 5 push campaigns.</p>

                        {loadingLogs ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-14 bg-[var(--surface-1)] rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : recentCampaigns.length === 0 ? (
                            <div className="text-center py-10 text-[var(--text-muted)]">
                                <div className="text-3xl mb-2 opacity-40">📭</div>
                                <p className="text-sm">No campaigns sent yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {recentCampaigns.map(log => (
                                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)]">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold capitalize ${SEGMENT_COLORS[log.segment] || 'bg-gray-100 text-gray-600'}`}>
                                                    {SEGMENTS.find(s => s.value === log.segment)?.label || log.segment}
                                                </span>
                                                <span className="text-[10px] text-[var(--text-muted)]">
                                                    {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : '—'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--text-main)] truncate">{log.message}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-bold text-green-600">{log.sentCount} sent</div>
                                            {log.failedCount > 0 && <div className="text-xs text-red-400">{log.failedCount} failed</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MerchantMarketing;
