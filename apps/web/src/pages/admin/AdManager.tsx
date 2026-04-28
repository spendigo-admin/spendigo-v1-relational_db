import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAuth } from '../../context/AuthContext';
import { auditBridge } from '../../utils/auditBridge';

interface AdCampaign {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    mobileImageUrl?: string;
    linkUrl?: string;
    status: 'active' | 'draft' | 'archived';
    startDate: string;
    endDate: string;
    priority: number;
    views: number;
    clicks: number;
    createdAt?: any;
    scope?: 'global' | 'local';
    targetAddress?: string;
    targetLat?: number;
    targetLng?: number;
    targetRadius?: number;
}

const AdManager: React.FC = () => {
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const { uploadFile, uploading } = useFileUpload();
    const { user } = useAuth(); // for logging if needed

    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAd, setCurrentAd] = useState<Partial<AdCampaign>>({});
    const [showModal, setShowModal] = useState(false);

    // Reset local preview when modal closes
    useEffect(() => {
        if (!showModal) {
            setLocalPreview(null);
            setMobileLocalPreview(null);
        }
    }, [showModal]);

    // Fetch Ads
    useEffect(() => {
        const q = query(collection(db, 'ads'), orderBy('priority', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAds = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AdCampaign[];
            setAds(fetchedAds);
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!currentAd.imageUrl) {
            addNotification({ type: 'alert', title: 'Image Required', message: 'Please select and upload a banner image.' });
            return;
        }

        try {
            const adData = {
                title: currentAd.title || 'Untitled Ad',
                description: currentAd.description || '',
                imageUrl: currentAd.imageUrl || '',
                mobileImageUrl: currentAd.mobileImageUrl || '',
                linkUrl: currentAd.linkUrl || '',
                status: currentAd.status || 'draft',
                startDate: currentAd.startDate || new Date().toISOString().split('T')[0],
                endDate: currentAd.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                priority: currentAd.priority || 5,
                views: currentAd.views || 0,
                clicks: currentAd.clicks || 0,
                updatedAt: serverTimestamp(),
                scope: currentAd.scope || 'global',
                targetAddress: currentAd.targetAddress || '',
                targetLat: currentAd.targetLat || null,
                targetLng: currentAd.targetLng || null,
                targetRadius: currentAd.targetRadius || 10,
            };

            if (adData.scope === 'local' && adData.targetAddress) {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adData.targetAddress)}&countrycodes=ca`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        adData.targetLat = parseFloat(data[0].lat);
                        adData.targetLng = parseFloat(data[0].lon);
                    } else {
                        addNotification({ type: 'alert', title: 'Location Error', message: `Could not find coordinates for ${adData.targetAddress}` });
                        return;
                    }
                } catch (e) {
                    addNotification({ type: 'alert', title: 'Geocoding Error', message: 'Failed to verify location.' });
                    return;
                }
            }

            if (currentAd.id) {
                await updateDoc(doc(db, 'ads', currentAd.id), adData);
                auditBridge.emit('AD_UPDATE', {
                    adId: currentAd.id,
                    title: adData.title,
                    scope: adData.scope
                });
                addNotification({ type: 'system', title: 'Ad Updated', message: 'Campaign settings saved.' });
            } else {
                const docRef = await addDoc(collection(db, 'ads'), {
                    ...adData,
                    createdAt: serverTimestamp()
                });
                auditBridge.emit('AD_CREATE', {
                    adId: docRef.id,
                    title: adData.title,
                    scope: adData.scope
                });
                addNotification({ type: 'system', title: 'Ad Created', message: 'New campaign launched.' });
            }
            setShowModal(false);
            setCurrentAd({});
        } catch (error: any) {
            console.error(error);
            addNotification({ type: 'alert', title: 'Error', message: 'Could not save campaign.' });
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Ad Campaign?',
            message: 'Are you sure you want to delete this ad? This will permanently remove it from the consumer homepage.',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const ad = ads.find(a => a.id === id);
            await deleteDoc(doc(db, 'ads', id));
            auditBridge.emit('AD_DELETE', {
                adId: id,
                title: ad?.title || 'Unknown Ad'
            });
            addNotification({ type: 'system', title: 'Ad Deleted', message: 'Campaign removed.' });
        } catch (error) {
            addNotification({ type: 'alert', title: 'Error', message: 'Delete failed.' });
        }
    };

    const [localPreview, setLocalPreview] = useState<{ url: string, type: string } | null>(null);
    const [mobileLocalPreview, setMobileLocalPreview] = useState<{ url: string, type: string } | null>(null);

    const isAssetVideo = (url?: string, localType?: string) => {
        if (localType) return localType.startsWith('video/');
        if (!url) return false;
        return url.toLowerCase().endsWith('.mp4') || url.includes('.mp4?') || url.includes('mp4?');
    };

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'desktop' | 'mobile') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            
            // Show local preview immediately
            const objectUrl = URL.createObjectURL(file);
            if (type === 'desktop') setLocalPreview({ url: objectUrl, type: file.type });
            else setMobileLocalPreview({ url: objectUrl, type: file.type });
            
            const path = `ads/${Date.now()}_${file.name}`;
            try {
                const url = await uploadFile(file, path, 20); // Increase to 20MB for video support
                if (url) {
                    setCurrentAd(prev => ({ ...prev, [type === 'desktop' ? 'imageUrl' : 'mobileImageUrl']: url }));
                } else {
                    if (type === 'desktop') setLocalPreview(null);
                    else setMobileLocalPreview(null);
                }
            } catch (err) {
                console.error("Upload error:", err);
                if (type === 'desktop') setLocalPreview(null);
                else setMobileLocalPreview(null);
            }
        }
    };

    return (
        <div className="p-6 animate-fade-in max-w-7xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-main)]">Carousel Ad Manager</h1>
                    <p className="text-[var(--text-muted)]">Manage sponsored banners on the Consumer Homepage.</p>
                </div>
                <button
                    onClick={() => { setCurrentAd({ status: 'draft', priority: 5 }); setIsEditing(false); setShowModal(true); }}
                    className="bg-black text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                >
                    + New Campaign
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.map(ad => (
                    <div key={ad.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm hover:shadow-md transition-all group">
                        {/* Image Preview */}
                        <div className="h-40 bg-gray-100 relative overflow-hidden">
                            {ad.imageUrl ? (
                                <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No Image</div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded shadow-sm backdrop-blur-md ${ad.status === 'active' ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white'}`}>
                                    {ad.status.toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            <h3 className="font-bold text-lg mb-1 truncate">{ad.title}</h3>
                            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-3">
                                <span>Priority: {ad.priority}</span>
                                <span>{ad.startDate} → {ad.endDate}</span>
                            </div>
                            
                            <div className="flex gap-2 items-center mb-3">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${ad.scope === 'local' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {ad.scope === 'local' ? '📍 LOCAL' : '🌎 GLOBAL'}
                                </span>
                                {ad.scope === 'local' && <span className="text-xs text-[var(--text-muted)] truncate">{ad.targetAddress} ({ad.targetRadius}km)</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-[var(--surface-1)] p-2 rounded-lg mb-4 text-center">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Views</div>
                                    <div className="font-bold">{ad.views.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Clicks</div>
                                    <div className="font-bold">{ad.clicks.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setCurrentAd(ad); setIsEditing(true); setShowModal(true); }}
                                    className="flex-1 py-2 text-sm font-bold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(ad.id)}
                                    className="px-3 py-2 text-sm font-bold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <h2 className="text-2xl font-bold mb-4">{currentAd.id ? 'Edit Campaign' : 'New Campaign'}</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold mb-1">Campaign Title</label>
                                    <input
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.title || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, title: e.target.value })}
                                        placeholder="e.g. Summer Coke Promotion"
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold mb-1">Desktop Banner (Wide)</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="w-full h-24 bg-gray-100 rounded border overflow-hidden flex-shrink-0 relative">
                                            {(localPreview || currentAd.imageUrl) ? (
                                                isAssetVideo(currentAd.imageUrl, localPreview?.type) ? (
                                                    <video src={localPreview?.url || currentAd.imageUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                                                ) : (
                                                    <img src={localPreview?.url || currentAd.imageUrl} className="w-full h-full object-cover" />
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-400 uppercase font-bold">1920 x 500</div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*,video/mp4"
                                            onChange={(e) => handleAssetUpload(e, 'desktop')}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold mb-1">Mobile Banner (Vertical/Square)</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="w-full h-24 bg-gray-100 rounded border overflow-hidden flex-shrink-0 relative">
                                            {(mobileLocalPreview || currentAd.mobileImageUrl) ? (
                                                isAssetVideo(currentAd.mobileImageUrl, mobileLocalPreview?.type) ? (
                                                    <video src={mobileLocalPreview?.url || currentAd.mobileImageUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                                                ) : (
                                                    <img src={mobileLocalPreview?.url || currentAd.mobileImageUrl} className="w-full h-full object-cover" />
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-400 uppercase font-bold">1080 x 1350</div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*,video/mp4"
                                            onChange={(e) => handleAssetUpload(e, 'mobile')}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                                {uploading && <div className="md:col-span-2 text-center text-xs text-blue-600 font-bold animate-pulse">Uploading high-resolution assets...</div>}

                                <div>
                                    <label className="block text-sm font-bold mb-1">Click Link (Optional)</label>
                                    <input
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.linkUrl || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, linkUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">Priority (1-10)</label>
                                    <input
                                        type="number" min="1" max="10"
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.priority || 5}
                                        onChange={e => setCurrentAd({ ...currentAd, priority: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.startDate || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, startDate: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">End Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.endDate || ''}
                                        onChange={e => setCurrentAd({ ...currentAd, endDate: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">Status</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.status || 'draft'}
                                        onChange={e => setCurrentAd({ ...currentAd, status: e.target.value as any })}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold mb-1">Scope</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={currentAd.scope || 'global'}
                                        onChange={e => setCurrentAd({ ...currentAd, scope: e.target.value as any })}
                                    >
                                        <option value="global">Global (Everywhere)</option>
                                        <option value="local">Local (Proximity Based)</option>
                                    </select>
                                </div>

                                {currentAd.scope === 'local' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Target Location</label>
                                            <input
                                                required
                                                className="w-full p-2 border rounded-lg"
                                                value={currentAd.targetAddress || ''}
                                                onChange={e => setCurrentAd({ ...currentAd, targetAddress: e.target.value })}
                                                placeholder="e.g. Cornwall, ON or Postal Code"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-1">Radius (km)</label>
                                            <select
                                                className="w-full p-2 border rounded-lg"
                                                value={currentAd.targetRadius || 10}
                                                onChange={e => setCurrentAd({ ...currentAd, targetRadius: Number(e.target.value) })}
                                            >
                                                <option value={5}>5 km</option>
                                                <option value={10}>10 km</option>
                                                <option value={20}>20 km</option>
                                                <option value={50}>50 km</option>
                                                <option value={100}>100 km</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-6 py-2 bg-black text-white font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Campaign'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdManager;
