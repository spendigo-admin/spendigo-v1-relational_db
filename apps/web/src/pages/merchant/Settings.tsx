import React, { useState } from 'react';
import '../../styles/design-system.css';

const MerchantSettings: React.FC = () => {
    const [storeInfo, setStoreInfo] = useState({
        name: 'FreshMart Queen St',
        phone: '416-555-0123',
        email: 'merchant@freshmart.ca',
        address: '123 Queen St W, Toronto, ON',
        description: 'Your local source for fresh produce and daily essentials.',
        deliveryRadiusKm: 5,
        minOrder: 15.00
    });

    const [hours, setHours] = useState([
        { day: 'Monday', open: '09:00', close: '21:00', closed: false },
        { day: 'Tuesday', open: '09:00', close: '21:00', closed: false },
        { day: 'Wednesday', open: '09:00', close: '21:00', closed: false },
        { day: 'Thursday', open: '09:00', close: '21:00', closed: false },
        { day: 'Friday', open: '09:00', close: '22:00', closed: false },
        { day: 'Saturday', open: '10:00', close: '22:00', closed: false },
        { day: 'Sunday', open: '10:00', close: '18:00', closed: false },
    ]);

    const handleSave = () => {
        // In a real app, save to backend
        alert('Settings saved successfully!');
    };

    return (
        <div className="p-6 animate-fade-in max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-[var(--text-main)] mb-6">Store Settings</h1>

            <div className="space-y-6">
                {/* General Info */}
                <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                    <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">General Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Store Name</label>
                            <input
                                type="text"
                                value={storeInfo.name}
                                onChange={e => setStoreInfo({ ...storeInfo, name: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Phone Number</label>
                            <input
                                type="tel"
                                value={storeInfo.phone}
                                onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email</label>
                            <input
                                type="email"
                                value={storeInfo.email}
                                onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Address</label>
                            <input
                                type="text"
                                value={storeInfo.address}
                                onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Description</label>
                            <textarea
                                value={storeInfo.description}
                                onChange={e => setStoreInfo({ ...storeInfo, description: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg h-24 resize-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Operations */}
                <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                    <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Operations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Delivery Radius (km)</label>
                            <input
                                type="number"
                                value={storeInfo.deliveryRadiusKm}
                                onChange={e => setStoreInfo({ ...storeInfo, deliveryRadiusKm: Number(e.target.value) })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Minimum Order ($)</label>
                            <input
                                type="number"
                                value={storeInfo.minOrder}
                                onChange={e => setStoreInfo({ ...storeInfo, minOrder: Number(e.target.value) })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            />
                        </div>
                    </div>
                </section>

                {/* Business Hours */}
                <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                    <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Business Hours</h2>
                    <div className="space-y-2">
                        {hours.map((day, idx) => (
                            <div key={idx} className="flex items-center gap-4 py-2 border-b border-[var(--surface-1)] last:border-0 hover:bg-[var(--surface-1)] px-2 rounded-lg transition-colors">
                                <div className="w-32 font-medium text-[var(--text-main)]">{day.day}</div>
                                <div className="flex-1 flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={day.closed}
                                            onChange={e => {
                                                const newHours = [...hours];
                                                newHours[idx].closed = e.target.checked;
                                                setHours(newHours);
                                            }}
                                            className="accent-[var(--brand-primary)]"
                                        />
                                        <span className="text-sm text-[var(--text-muted)]">Closed</span>
                                    </label>

                                    {!day.closed && (
                                        <>
                                            <input
                                                type="time"
                                                value={day.open}
                                                onChange={e => {
                                                    const newHours = [...hours];
                                                    newHours[idx].open = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-2 border border-[var(--glass-border)] rounded-md text-sm"
                                            />
                                            <span className="text-[var(--text-muted)]">-</span>
                                            <input
                                                type="time"
                                                value={day.close}
                                                onChange={e => {
                                                    const newHours = [...hours];
                                                    newHours[idx].close = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-2 border border-[var(--glass-border)] rounded-md text-sm"
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="flex justify-end gap-3 pt-4">
                    <button className="px-6 py-3 bg-[var(--surface-2)] text-[var(--text-main)] font-medium rounded-lg hover:brightness-95 transition-all">
                        Discard Changes
                    </button>
                    <button onClick={handleSave} className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-lg shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 transition-all">
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MerchantSettings;
