import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, updateDoc, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import '../../styles/design-system.css';

const AdminSettings: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const [settings, setSettings] = useState<any>({
        maintenanceMode: false,
        maintenanceRequest: null, // { requesterId, requesterName, targetState, timestamp }
        allowNewRegistrations: true,
        platformFeePercentage: 5.0,
        supportEmail: 'support@spendigo.ca',
        maxFlyerUploadSizeMB: 10
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
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 border-b border-[var(--glass-border)] pb-2">General Configuration</h2>
                        <div className="space-y-4">

                            {/* Maintenance Mode: Maker-Checker UI */}
                            <div className="flex items-start justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">Maintenance Mode 🛡️</p>
                                    <p className="text-xs text-[var(--text-muted)] mb-2">Disable access for all users except admins.</p>

                                    {/* Status Indicator */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`w-2 h-2 rounded-full ${settings.maintenanceMode ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                        <span className="text-xs font-bold uppercase">{settings.maintenanceMode ? 'System Offline' : 'System Online'}</span>
                                    </div>

                                    {/* Request Message */}
                                    {settings.maintenanceRequest && (
                                        <div className="mt-2 text-xs bg-yellow-100 text-yellow-800 p-2 rounded border border-yellow-200">
                                            <strong>Action Required:</strong> {settings.maintenanceRequest.requesterName} requested to
                                            <strong> {settings.maintenanceRequest.targetState ? 'ENABLE' : 'DISABLE'} </strong>
                                            Maintenance Mode.
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                    {/* No Pending Request */}
                                    {!settings.maintenanceRequest && (
                                        <button
                                            onClick={() => handleMaintenanceRequest(!settings.maintenanceMode)}
                                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors border ${settings.maintenanceMode
                                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' // Button to Disable
                                                : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' // Button to Enable
                                                }`}
                                        >
                                            {settings.maintenanceMode ? 'Request to Go Online' : 'Request Maintenance'}
                                        </button>
                                    )}

                                    {/* Request Exists */}
                                    {settings.maintenanceRequest && (
                                        <>
                                            {/* Approver (Different User) */}
                                            {user?.id !== settings.maintenanceRequest.requesterId ? (
                                                <button
                                                    onClick={handleApproveRequest}
                                                    className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md animate-pulse"
                                                >
                                                    Approve Change
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-500 italic">Waiting for approval...</span>
                                            )}

                                            {/* Cancel (Any Admin can cancel, usually requester or super admin) */}
                                            <button
                                                onClick={handleCancelRequest}
                                                className="text-xs text-gray-500 hover:text-red-600 underline"
                                            >
                                                Cancel Request
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">Allow New Registrations</p>
                                    <p className="text-xs text-[var(--text-muted)]">Control whether new users can sign up</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="allowNewRegistrations"
                                        checked={settings.allowNewRegistrations}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Financial & Limits */}
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 border-b border-[var(--glass-border)] pb-2 pt-4">Financial & Limits</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Platform Fee (%)</label>
                                <input
                                    type="number"
                                    name="platformFeePercentage"
                                    value={settings.platformFeePercentage}
                                    onChange={handleChange}
                                    step="0.1"
                                    className="w-full p-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg focus:border-[var(--brand-primary)] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Max Flyer Size (MB)</label>
                                <input
                                    type="number"
                                    name="maxFlyerUploadSizeMB"
                                    value={settings.maxFlyerUploadSizeMB}
                                    onChange={handleChange}
                                    className="w-full p-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg focus:border-[var(--brand-primary)] outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Support Email</label>
                                <input
                                    type="email"
                                    name="supportEmail"
                                    value={settings.supportEmail}
                                    onChange={handleChange}
                                    className="w-full p-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg focus:border-[var(--brand-primary)] outline-none"
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
    );
};

export default AdminSettings;
