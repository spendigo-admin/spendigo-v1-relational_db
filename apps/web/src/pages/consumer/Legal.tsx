import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const Legal: React.FC = () => {
    const location = useLocation();
    const { t } = useTranslation();
    const isPrivacy = location.pathname.includes('/privacy');

    // MOCK DATA for boilerplate legal documents
    // Note: This should ideally be verified by a legal professional
    const privacyContent = (
        <>
            <h1 className="text-3xl font-bold mb-6 text-[var(--text-main)]">Privacy Policy</h1>
            <p className="text-sm text-[var(--text-muted)] mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">1. Information We Collect</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    Spendigo collects personal data when you register, place reservations, or interact with our platform. This includes:
                </p>
                <ul className="list-disc pl-6 text-[var(--text-muted)] space-y-2 mb-4">
                    <li><strong>Account Data:</strong> Name, email address, and encrypted passwords.</li>
                    <li><strong>Transactional Data:</strong> Order history, delivery addresses, and payment references (processed securely by Stripe).</li>
                    <li><strong>Usage Data:</strong> Pages visited, search queries, and device information to improve your experience.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">2. How We Use Your Data</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    We use your physical address to pair you with local merchants (i.e. SmartCart Optimizer). We share only your essential delivery details with the destination merchant to fulfill your order. Your email is used for account verification and critical service updates.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">3. Data Subject Access Requests (DSAR)</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    You have the right to access, rectify, or delete your personal data (the "Right to be Forgotten"). You can securely delete your entire account directly from your <strong>Profile Settings → Danger Zone</strong>.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">4. Cookies & Age Verification</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    We use essential cookies to maintain your login session. No third-party tracking cookies are used without your consent. For age-restricted items, you attest your age during checkout, but merchant partners are strictly required to verify physical ID upon delivery or pickup.
                </p>
            </section>
        </>
    );

    const termsContent = (
        <>
            <h1 className="text-3xl font-bold mb-6 text-[var(--text-main)]">Terms of Service</h1>
            <p className="text-sm text-[var(--text-muted)] mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">1. Platform Role</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    Spendigo acts strictly as a marketplace facilitator between Shoppers and independent Merchants. We do not manufacture, store, or physically deliver any goods directly. 
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">2. Checkout & Fulfillment</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    By confirming a reservation, you legally commit to purchasing the selected items from the specific merchant. Payment is typically finalized "at the door" unless an integrated Stripe checkout is used. The merchant retains the right to substitute or cancel items based on physical inventory.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">3. User Conduct</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    Accounts found engaging in fraudulent reservations, abusive reviews, or harassment of merchants will be permanently suspended.
                </p>
            </section>

             <section className="mb-8">
                <h2 className="text-xl font-bold mb-3 text-[var(--text-main)]">4. Liability</h2>
                <p className="text-[var(--text-muted)] leading-relaxed mb-4">
                    We make no warranty regarding the safety, quality, or legality of items sold by merchants on our platform. All disputes must be reasonably resolved with the merchant directly, although Spendigo support may intervene for systemic issues.
                </p>
            </section>
        </>
    );

    return (
        <div className="animate-fade-in pb-20 pt-8" style={{ minHeight: 'calc(100vh - 4rem)' }}>
            <SEO
                title={isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
                description={isPrivacy ? 'Read the Spendigo privacy policy. Learn how we protect your data.' : 'Read the Spendigo terms of service for shoppers and merchants.'}
                path={isPrivacy ? '/privacy' : '/terms'}
            />
            <div className="max-w-3xl mx-auto px-4">
                
                {/* Back button */}
                <Link to="/" className="inline-flex items-center text-sm font-bold text-[var(--brand-primary)] hover:underline mb-8">
                    ← Back to Home
                </Link>

                {/* Content Panel */}
                <div className="glass-panel p-8 rounded-2xl shadow-sm">
                    {isPrivacy ? privacyContent : termsContent}
                </div>

                {/* Navigating between docs */}
                <div className="mt-8 pt-8 border-t border-[var(--glass-border)] flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {!isPrivacy && (
                        <Link to="/privacy" className="text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:underline">
                            Read our Privacy Policy
                        </Link>
                    )}
                    {isPrivacy && (
                        <Link to="/terms" className="text-sm text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:underline">
                            Read our Terms of Service
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Legal;
