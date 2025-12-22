import React, { useState } from 'react';
import '../../styles/design-system.css';

const MerchantOnboarding: React.FC = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        legalName: '',
        address: '',
        postalCode: '',
        agreedToTerms: false
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(step + 1);
    };

    const handleStripeConnect = () => {
        // In production, this calls our API to get the Stripe OAuth URL
        window.location.href = 'https://connect.stripe.com/express/oauth/authorize?client_id=ca_TEST&state=xyz';
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
                    <form onSubmit={handleSubmit} className="space-y-6">
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
                            <div>
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Business Address</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-0)] border border-[var(--glass-border)] text-[var(--text-main)]"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div>
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
                            <span className="text-[var(--text-main)]">I verify I have authority to bind the entity and agree to the terms.</span>
                        </label>

                        <button
                            onClick={() => formData.agreedToTerms && setStep(3)}
                            disabled={!formData.agreedToTerms}
                            className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Accept & Continue
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--surface-2)] flex items-center justify-center text-2xl">🏦</div>
                        <h2 className="text-xl font-bold">Setup Payouts</h2>
                        <p className="text-[var(--text-muted)]">Connect your bank account to receive 100% of your sales revenue.</p>

                        <button
                            onClick={handleStripeConnect}
                            className="w-full py-4 rounded-[var(--radius-md)] bg-[#635BFF] text-white font-bold hover:brightness-110 flex items-center justify-center gap-2"
                        >
                            <span>Connect with</span>
                            <span className="font-bold italic">Stripe</span>
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MerchantOnboarding;
