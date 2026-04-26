import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, updateDoc, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { useNotifications } from '../../context/NotificationContext';
import '../../styles/design-system.css';

const AdminSettings: React.FC = () => {
    const { user } = useAuth();
    const { logEvent } = useAudit();
    const { addNotification } = useNotifications();
    const [settings, setSettings] = useState<any>({
        maintenanceMode: false,
        maintenanceRequest: null, // { requesterId, requesterName, targetState, timestamp }
        allowShopperRegistrations: true,
        allowPartnerRegistrations: true,
        platformFeePercentage: 5.0,
        supportEmail: 'support@spendigo.ca',
        maxFlyerUploadSizeMB: 10,
        careersEnabled: true,
        flyerIngestionEnabled: true
    });

    // Load Settings
    useEffect(() => {
        const docRef = doc(db, 'settings', 'platform');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings((prev: any) => ({ ...prev, ...docSnap.data() }));
            }
        });
        return () => unsubscribe();
    }, []);

    const handleMaintenanceRequest = async (targetState: boolean) => {
        if (!user) return;

        // Create Request
        const request = {
            requesterId: user.id || 'admin',
            requesterName: user.name || 'Admin',
            targetState,
            timestamp: Date.now()
        };

        try {
            await setDoc(doc(db, 'settings', 'platform'), {
                ...settings,
                maintenanceRequest: request
            });

            // Trigger Email Notification via Extension
            await addDoc(collection(db, 'mail'), {
                to: settings.supportEmail || 'admin@spendigo.ca',
                message: {
                    subject: `[ACTION REQUIRED] Maintenance Mode Request`,
                    html: `
                        <h2>Maintenance Mode Request</h2>
                        <p><strong>Requester:</strong> ${request.requesterName} (${request.requesterId})</p>
                        <p><strong>Action:</strong> Request to set Maintenance Mode to <strong>${targetState}</strong></p>
                        <p>Please log in to the <a href="${window.location.origin}/admin/settings">Admin Console</a> to Approve or Deny.</p>
                        <p>Time: ${new Date(request.timestamp).toLocaleString()}</p>
                    `
                }
            });
            await logEvent('MAINTENANCE_REQUEST', { 
                targetState, 
                reason: `Requested by ${request.requesterName}` 
            }, 'system/maintenance');
            addNotification({ type: 'system', title: 'Request Submitted', message: 'Maintenance verification requested. Another admin must approve this change.' });
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to submit request.' });
        }
    };

    const handleApproveRequest = async () => {
        if (!settings.maintenanceRequest) return;

        try {
            // Apply the change
            await setDoc(doc(db, 'settings', 'platform'), {
                ...settings,
                maintenanceMode: settings.maintenanceRequest.targetState,
                maintenanceRequest: null // Clear request
            });
            await logEvent('MAINTENANCE_APPROVE', { 
                targetState: settings.maintenanceRequest.targetState, 
                requesterId: settings.maintenanceRequest.requesterId 
            }, 'system/maintenance');
            addNotification({ type: 'system', title: 'Maintenance Updated', message: `Maintenance Mode ${settings.maintenanceRequest.targetState ? 'ENABLED' : 'DISABLED'}.` });
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to approve request.' });
        }
    };

    const handleCancelRequest = async () => {
        try {
            await setDoc(doc(db, 'settings', 'platform'), {
                ...settings,
                maintenanceRequest: null
            });

            await logEvent('MAINTENANCE_CANCEL', { 
                cancelledBy: user?.email || 'admin' 
            }, 'system/maintenance');
            addNotification({ type: 'system', title: 'Cancelled', message: 'Request cancelled.' });
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to cancel request.' });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings((prev: any) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        try {
            // Save other settings, preserving maintenance state
            // ensuring we don't overwrite maintenance things improperly if they changed in background, 
            // but onSnapshot handles the state sync, so 'settings' should be fresh.
            await setDoc(doc(db, 'settings', 'platform'), settings);
            await logEvent('SYSTEM_SETTINGS_UPDATE', { settingsCount: Object.keys(settings).length }, 'system/settings');
            addNotification({ type: 'system', title: 'Saved', message: 'Settings saved successfully!' });
        } catch (err) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to save settings.' });
        }
    };



    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">Platform Settings</h1>

            <div className="glass-panel p-6 max-w-2xl">
                <div className="space-y-6">
                    {/* General Configuration */}
                <div className="space-y-8">
                    {/* System Controls */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-[var(--glass-border)] pb-2">
                            <span className="text-xl">🔒</span>
                            <h2 className="text-lg font-bold text-[var(--text-main)]">System Controls</h2>
                        </div>
                        <div className="space-y-6">

                            {/* Maintenance Mode: Maker-Checker UI */}
                            <div className="bg-[var(--surface-1)] p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                                            Maintenance Mode
                                            <span className={`w-2 h-2 rounded-full ${settings.maintenanceMode ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                                        </p>
                                        <p className="text-[10px] text-[var(--text-muted)] font-medium mb-3">Global lockout for non-admin sessions.</p>
                                        
                                        {/* Request Message */}
                                        {settings.maintenanceRequest && (
                                            <div className="mt-2 text-[10px] font-bold bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                                                <span className="animate-bounce">⚠️</span>
                                                <span>
                                                    {settings.maintenanceRequest.requesterName} requested to
                                                    {settings.maintenanceRequest.targetState ? ' ENABLE ' : ' DISABLE '} 
                                                    Maintenance.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        {!settings.maintenanceRequest && (
                                            <button
                                                onClick={() => handleMaintenanceRequest(!settings.maintenanceMode)}
                                                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border uppercase tracking-wider ${settings.maintenanceMode
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                                    }`}
                                            >
                                                {settings.maintenanceMode ? 'Go Online' : 'Go Offline'}
                                            </button>
                                        )}

                                        {settings.maintenanceRequest && (
                                            <div className="flex items-center gap-2">
                                                {user?.id !== settings.maintenanceRequest.requesterId ? (
                                                    <button
                                                        onClick={handleApproveRequest}
                                                        className="px-3 py-1.5 text-[10px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all"
                                                    >
                                                        APPROVE
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] text-[var(--text-muted)] font-bold italic uppercase">Pending Approval</span>
                                                )}
                                                <button
                                                    onClick={handleCancelRequest}
                                                    className="text-[9px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-tighter"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-main)]">Shopper Signup</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">Allow new registrations</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="allowShopperRegistrations"
                                            checked={settings.allowShopperRegistrations}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>

                                <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-main)]">Partner Signup</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">Allow merchant signups</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="allowPartnerRegistrations"
                                            checked={settings.allowPartnerRegistrations}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>

                                <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-main)]">Careers Section</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">Public job board visibility</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="careersEnabled"
                                            checked={settings.careersEnabled}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>

                                <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-[var(--text-main)]">Flyer Ingestion</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">Shopper comparison engine</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="flyerIngestionEnabled"
                                            checked={settings.flyerIngestionEnabled}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Platform Configuration */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-b border-[var(--glass-border)] pb-2">
                            <span className="text-xl">⚙️</span>
                            <h2 className="text-lg font-bold text-[var(--text-main)]">Platform Configuration</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)]">
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Platform Fee (%)</label>
                                <input
                                    type="number"
                                    name="platformFeePercentage"
                                    value={settings.platformFeePercentage}
                                    onChange={handleChange}
                                    step="0.1"
                                    className="w-full bg-white p-2 rounded border border-[var(--glass-border)] text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                                />
                            </div>
                            <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)]">
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Max Flyer Size (MB)</label>
                                <input
                                    type="number"
                                    name="maxFlyerUploadSizeMB"
                                    value={settings.maxFlyerUploadSizeMB}
                                    onChange={handleChange}
                                    className="w-full bg-white p-2 rounded border border-[var(--glass-border)] text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                                />
                            </div>
                            <div className="md:col-span-2 p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--glass-border)]">
                                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Global Support Email</label>
                                <input
                                    type="email"
                                    name="supportEmail"
                                    value={settings.supportEmail}
                                    onChange={handleChange}
                                    placeholder="e.g. support@spendigo.ca"
                                    className="w-full bg-white p-2 rounded border border-[var(--glass-border)] text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>





                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 transition-all shadow-md active:scale-95"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default AdminSettings;
