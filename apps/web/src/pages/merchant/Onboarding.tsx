import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import { BUSINESS_TYPES } from './Settings';
import { useAudit } from '../../context/AuditContext';

const MARKETPLACE_AGREEMENT_V1 = `
1. Relationship. You acknowledge that Spendigo is a Marketplace Facilitator platform.
2. Fees. Spendigo operates on a Subscription Model. We do not charge a percentage commission on your sales. You receive 100% of your revenue (minus standard payment processing fees).
3. Compliance & Privacy. You agree to comply with all applicable Canadian laws, including PIPEDA and Anti-Spam Legislation (CASL). You acknowledge and agree to handle personal data in accordance with our Privacy Policy.
4. Limitation of Liability. You agree that Spendigo provides the platform "as-is" and "as-available". To the maximum extent permitted by law, Spendigo shall not be liable for any indirect, incidental, or consequential damages, including loss of profits or data. You agree to indemnify and hold Spendigo harmless from any claims arising out of your merchant activities or breach of this agreement.
`.trim();

const MerchantOnboarding: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { addStore } = useMarketplace();
    const { logEvent } = useAudit();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    // Pre-fill form with data from User Profile (collected during registration)
    const [formData, setFormData] = useState({
        legalName: user?.storeName || '',
        address: (user as any)?.addresses?.[0]?.street || (user?.address?.split(',')[0] || ''),
        city: (user as any)?.addresses?.[0]?.city || '',
        province: (user as any)?.addresses?.[0]?.province || 'ON',
        postalCode: (user as any)?.addresses?.[0]?.postalCode || '',
        businessType: (user as any)?.businessType || 'Grocery Store',
        agreedToTerms: false
    });

    const { stores } = useMarketplace();
    const isLocked = user?.storeId ? stores[user.storeId]?.status === 'pending_deletion' : false;

    if (isLocked) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-orange-100">
                <div className="glass-panel w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">⚠️</div>
                    <h1 className="text-2xl font-bold text-orange-900 mb-2">Access Restricted</h1>
                    <p className="text-orange-800 mb-6">
                        This account is associated with a store that is pending deletion. 
                        Onboarding actions are disabled.
                    </p>
                    <button 
                        onClick={() => navigate('/merchant/dashboard')}
                        className="px-6 py-2 bg-orange-600 text-white rounded-lg font-bold"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }
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

            const defaultAssets = BUSINESS_TYPES[formData.businessType] || BUSINESS_TYPES['Grocery Store'];

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
                businessType: formData.businessType,
                products: [], // Empty inventory
                image: defaultAssets.cover,
                logoUrl: defaultAssets.logo,
                tagline: defaultAssets.tagline,
                // Legal metadata for law enforcement/audit compliance
                legal: {
                    agreementAccepted: true,
                    acceptedAt: new Date().toISOString(),
                    acceptedBy: user.id,
                    agreementVersion: '1.0',
                    agreementTextSnapshot: MARKETPLACE_AGREEMENT_V1
                }
            };

            await addStore(newStore);

            // 2. Log Legal Acceptance to the Immutable Audit Trail
            await logEvent('MERCHANT_AGREEMENT_ACCEPTANCE', {
                agreementVersion: '1.0',
                agreementText: MARKETPLACE_AGREEMENT_V1,
                legalName: formData.legalName,
                businessType: formData.businessType
            }, newStoreId);

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

                <h1 className="page-headline mb-2">Setup your Store</h1>
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
                                    {['ON', 'BC', 'AB', 'QC', 'MB', 'NS', 'NB', 'SK', 'NL', 'PE', 'YT', 'NT', 'NU'].map(p => (
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

                        <div>
                            <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Primary Business Type</label>
                            <select
                                required
                                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                value={formData.businessType}
                                onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                            >
                                {Object.keys(BUSINESS_TYPES).map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                ✨ This sets your store's default imagery and taglines. You can change this later in Settings to refresh your branding.
                            </p>
                        </div>

                        <button type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:bg-[var(--brand-primary-dark)] transition-transform active:scale-95">
                            Continue
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="p-4 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-sm text-[var(--text-muted)] h-48 overflow-y-auto whitespace-pre-wrap">
                            <h3 className="font-bold text-[var(--text-main)] mb-2">Marketplace Facilitator Agreement</h3>
                            {MARKETPLACE_AGREEMENT_V1}
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
