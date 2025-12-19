import React, { useState } from 'react';
import '../../styles/design-system.css';

const AdminSettings: React.FC = () => {
    const [settings, setSettings] = useState({
        maintenanceMode: false,
        allowNewRegistrations: true,
        platformFeePercentage: 5.0,
        supportEmail: 'support@spendigo.com',
        maxFlyerUploadSizeMB: 10
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        // Mock API call
        alert('Settings saved successfully!');
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
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">Maintenance Mode</p>
                                    <p className="text-xs text-[var(--text-muted)]">Disable access for all users except admins</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="maintenanceMode"
                                        checked={settings.maintenanceMode}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-primary)]"></div>
                                </label>
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
