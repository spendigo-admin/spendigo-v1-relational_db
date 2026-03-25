import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const MerchantOnboarding: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { addStore } = useMarketplace();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    // Pre-fill form with data from User Profile (collected during registration)
    const [formData, setFormData] = useState({
        legalName: user?.storeName || '',
        address: (user as any)?.addresses?.[0]?.street || (user?.address?.split(',')[0] || ''),
        city: (user as any)?.addresses?.[0]?.city || '',
        province: (user as any)?.addresses?.[0]?.province || 'ON',
        postalCode: (user as any)?.addresses?.[0]?.postalCode || '',
        agreedToTerms: false
    });

    const handleSubmitStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(step + 1);
    };

    const handleCreateStore = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Create Store Document
            const newStoreId = `store-${user.id}`; // Simple deterministic ID for 1-1 mapping

            let coordinates = null;
            try {
                const fullAddress = `${formData.address}, ${formData.city}, ${formData.province}, ${formData.postalCode}, Canada`;
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    coordinates = {
                        lat: parseFloat(data[0].lat),
                        lng: parseFloat(data[0].lon)
                    };
                }
            } catch (e) {
                console.warn("Geocoding failed during store onboarding", e);
            }

            const newStore = {
                id: newStoreId,
                name: user.storeName || `${user.name}'s Store`,
                merchantEmail: user.email,
                ownerId: user.id,
                address: formData.address,
                city: formData.city,
                province: formData.province,
                postalCode: formData.postalCode,
                coordinates: coordinates,
                status: 'pending', // Pending verification
                subscriptionTier: user.subscriptionTier || 'free',
                rating: 0,
                deliveryFee: 'Free', // Default
                deliveryTime: '45-60 min', // Default
                tags: ['New'],
                categories: ['All'],
                products: [], // Empty inventory
                image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&h=400&fit=crop' // Placeholder
            };

            await addStore(newStore);

            // 2. Link Store to User Profile
            const userRef = doc(db, 'users', user.id);
            await updateDoc(userRef, {
                storeId: newStoreId
            });

            // 3. Move to next step (Stripe Setup or Dashboard)
            setStep(3);
        } catch (error) {
            console.error("Failed to create store:", error);
            addNotification({ type: 'alert', title: 'Error', message: "Failed to initialize store. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleStripeConnect = () => {
        // In production, this call API. For now, we skip to dashboard.
        // window.location.href = '...';
        navigate('/merchant/dashboard');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[var(--surface-0)] to-[var(--surface-1)]">
            <div className="glass-panel w-full max-w-2xl p-8 md:p-12 relative overflow-hidden">
                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--surface-2)]">
                    <div
                        className="h-full bg-[var(--brand-primary)] transition-all duration-500"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>

                <h1 className="mb-2 text-3xl text-[var(--text-main)]">Setup your Store</h1>
                <p className="mb-8 text-[var(--text-muted)]">Join the Spendigo Marketplace Facilitator Platform.</p>

                {step === 1 && (
                    <form onSubmit={handleSubmitStep1} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Legal Business Name</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)] focus:outline-none focus:border-[var(--brand-primary)]"
                                placeholder="e.g. 1234 Ontario Inc."
                                value={formData.legalName}
                                onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Street Address</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">City</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Province</label>
                                <select
                                    required
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                    value={formData.province}
                                    onChange={e => setFormData({ ...formData, province: e.target.value })}
                                >
                                    {['ON', 'BC', 'AB', 'QC', 'MB', 'NS', 'NB', 'SK', 'NL', 'PE'].map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Postal Code</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                    placeholder="M5V 2H1"
                                    value={formData.postalCode}
                                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                                />
                            </div>
                        </div>

                        <button type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:bg-[var(--brand-primary-dark)] transition-transform active:scale-95">
                            Continue
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-sm text-[var(--text-muted)] h-48 overflow-y-auto">
                            <h3 className="font-bold text-[var(--text-main)] mb-2">Marketplace Facilitator Agreement</h3>
                            <p>1. Relationship. You acknowledge that Spendigo is a Marketplace Facilitator platform.</p>
                            <p className="mt-2">2. Fees. Spendigo operates on a **Subscription Model**. We do not charge a percentage commission on your sales. You receive 100% of your revenue (minus standard payment processing fees).</p>
                            <p className="mt-2">3. Compliance & Privacy. You agree to comply with all applicable Canadian laws, including PIPEDA and Anti-Spam Legislation (CASL). You acknowledge and agree to handle personal data in accordance with our Privacy Policy.</p>
                            {/* Truncated for brevity */}
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                required
                                className="w-5 h-5 accent-[var(--brand-primary)]"
                                checked={formData.agreedToTerms}
                                onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                            />
                            <span className="text-[var(--text-main)]">I verify I have authority to bind the entity and agree to the terms and Privacy Policy.</span>
                        </label>

                        <button
                            onClick={handleCreateStore}
                            disabled={!formData.agreedToTerms || loading}
                            className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                        >
                            {loading ? 'Creating Store...' : 'Accept & Create Store'}
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center space-y-6 animate-fade-in">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-2xl">✅</div>
                        <h2 className="text-xl font-bold">Store Created Successfully!</h2>
                        <div className="p-4 bg-[var(--surface-0)] rounded-xl border border-[var(--glass-border)] text-left">
                            <h3 className="font-bold text-sm text-[var(--text-muted)] uppercase mb-2">Next Step: Payouts</h3>
                            <p className="text-sm">Connect your bank account via Stripe to receive your payouts. You can do this later from Settings.</p>
                        </div>

                        <button
                            onClick={handleStripeConnect}
                            className="w-full py-4 rounded-[var(--radius-md)] bg-[#635BFF] text-white font-bold hover:brightness-110 flex items-center justify-center gap-2"
                        >
                            <span>Connect with</span>
                            <span className="font-bold italic">Stripe</span>
                        </button>

                        <button onClick={() => navigate('/merchant/dashboard')} className="text-sm text-[var(--text-muted)] hover:underline">
                            Skip for now, go to Dashboard
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MerchantOnboarding;
