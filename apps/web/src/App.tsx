import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from './components/ErrorFallback';
import NotFound from './pages/NotFound';

import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { CatalogProvider } from './context/CatalogContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { AuditProvider } from './context/AuditContext';
import { ReviewProvider } from './context/ReviewContext';
import { ConfirmationProvider } from './context/ConfirmationContext';
import { LocationProvider } from './context/LocationContext';

import ConsumerLayout from './layouts/ConsumerLayout';
import MerchantLayout from './layouts/MerchantLayout';
import AdminLayout from './layouts/AdminLayout';
import RequireVerification from './components/RequireVerification';

// Auth pages — small and needed immediately on load
import Login from './pages/consumer/Login';
import Register from './pages/consumer/Register';
import ForgotPassword from './pages/consumer/ForgotPassword';
import VerifyEmail from './pages/consumer/VerifyEmail';
import ResetPassword from './pages/consumer/ResetPassword';

// Wrapper to catch Vite 'failed to fetch dynamically imported module' (Chunk/Hash mismatches after deploy)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
    lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
        );

        try {
            const component = await componentImport();
            window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
            return component;
        } catch (error: any) {
            if (!pageHasAlreadyBeenForceRefreshed) {
                console.warn('Handling dynamic import failure (Stale chunks). Forcing page reload...');
                window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
                window.location.reload();
                return { default: () => null } as any; // Halt rendering while reloading
            }
            throw error;
        }
    });

// Consumer Pages — lazy loaded
const StoreList = lazyWithRetry(() => import('./pages/consumer/StoreList'));
const StoreDetail = lazyWithRetry(() => import('./pages/consumer/StoreDetail'));
const ProductDetail = lazyWithRetry(() => import('./pages/consumer/ProductDetail'));
const Cart = lazyWithRetry(() => import('./pages/consumer/Cart'));
const Checkout = lazyWithRetry(() => import('./pages/consumer/Checkout'));
const Profile = lazyWithRetry(() => import('./pages/consumer/Profile'));
const OrderTracking = lazyWithRetry(() => import('./pages/consumer/OrderTracking'));
const Notifications = lazyWithRetry(() => import('./pages/consumer/Notifications'));
const SmartCartWishlist = lazyWithRetry(() => import('./pages/consumer/SmartCartWishlist'));
const SmartCartPrototype = lazyWithRetry(() => import('./pages/consumer/SmartCartPrototype'));
const Search = lazyWithRetry(() => import('./pages/consumer/Search'));
const HowItWorks = lazyWithRetry(() => import('./pages/consumer/HowItWorks'));
const ConsumerSurveys = lazyWithRetry(() => import('./pages/consumer/Surveys'));
const Flyers = lazyWithRetry(() => import('./pages/consumer/Flyers'));
const Legal = lazyWithRetry(() => import('./pages/consumer/Legal'));
const PartnerWithUs = lazyWithRetry(() => import('./pages/consumer/PartnerWithUs'));
const MerchantRegister = lazyWithRetry(() => import('./pages/consumer/MerchantRegister'));
const Careers = lazyWithRetry(() => import('./pages/consumer/Careers'));
const CareerDetail = lazyWithRetry(() => import('./pages/consumer/CareerDetail'));
const CareerManagement = lazyWithRetry(() => import('./pages/admin/CareerManagement'));

// Merchant Pages — lazy loaded
const MerchantDashboard = lazyWithRetry(() => import('./pages/merchant/Dashboard'));
const MerchantOnboarding = lazyWithRetry(() => import('./pages/merchant/Onboarding'));
const MerchantProducts = lazyWithRetry(() => import('./pages/merchant/Products'));
const MerchantOrders = lazyWithRetry(() => import('./pages/merchant/Orders'));
const MerchantFlyers = lazyWithRetry(() => import('./pages/merchant/Flyers'));
const MerchantDeals = lazyWithRetry(() => import('./pages/merchant/Deals'));
const MerchantSettings = lazyWithRetry(() => import('./pages/merchant/Settings'));
const MerchantSubscription = lazyWithRetry(() => import('./pages/merchant/Subscription'));

// Admin Pages — lazy loaded
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/Dashboard'));
const AdminUserManagement = lazyWithRetry(() => import('./pages/admin/UserManagement'));
const AdminStoreManagement = lazyWithRetry(() => import('./pages/admin/StoreManagement'));
const AdminAuditLogs = lazyWithRetry(() => import('./pages/admin/AuditLogs'));
const AdminFlyerModeration = lazyWithRetry(() => import('./pages/admin/FlyerModeration'));
const AdminSettings = lazyWithRetry(() => import('./pages/admin/Settings'));
const AdminMasterCatalog = lazyWithRetry(() => import('./pages/admin/MasterCatalog'));
const AdminAdManager = lazyWithRetry(() => import('./pages/admin/AdManager'));
const AdminSurveyManager = lazyWithRetry(() => import('./pages/admin/SurveyManager'));
const AdminSystemTools = lazyWithRetry(() => import('./pages/admin/SystemTools'));

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import MaintenancePage from './pages/Maintenance';
import ThemeSwitcher from './components/ThemeSwitcher';

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center">Loading...</div>
);

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'platform'), (doc) => {
            setMaintenanceMode(doc.data()?.maintenanceMode || false);
            setLoading(false);
        }, (error) => {
            console.error("Maintenance check failed:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading || authLoading) return <PageLoader />;

    // Admin Bypass
    if (user?.role === 'admin') return <>{children}</>;

    if (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/admin')) {
        return <>{children}</>;
    }

    if (maintenanceMode) {
        return <MaintenancePage />;
    }

    return <>{children}</>;
}

import { trackVisit } from './lib/analytics';

function App() {
    useEffect(() => {
        trackVisit();
    }, []);

    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.href = '/'}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                    <AuditProvider>
                        <MaintenanceGuard>
                            <NotificationProvider>
                                <MarketplaceProvider>
                                <CatalogProvider>
                                    <ReviewProvider>
                                        <CartProvider>
                                            <WishlistProvider>
                                                <OrderProvider>
                                                    <LocationProvider>
                                                        <ConfirmationProvider>
                                                            <Suspense fallback={<PageLoader />}>
                                                            <Routes>
                                                                {/* AUTH ROUTES (Fullscreen) */}
                                                                <Route path="/login" element={<Login />} />
                                                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                                                <Route path="/register" element={<Register />} />
                                                                <Route path="/register/business" element={<MerchantRegister />} />
                                                                <Route path="/verify-email" element={<VerifyEmail />} />
                                                                <Route path="/reset-password" element={<ResetPassword />} />

                                                                {/* CONSUMER ROUTES wrapped in Layout */}
                                                                <Route element={<ConsumerLayout />}>
                                                                    <Route path="/" element={<StoreList />} />
                                                                    <Route path="/store/:id" element={<StoreDetail />} />
                                                                    <Route path="/product/:id" element={<ProductDetail />} />
                                                                    <Route path="/cart" element={<Cart />} />

                                                                    {/* Protected Consumer Routes - Require Email Verification */}
                                                                    <Route path="/checkout" element={<RequireVerification><Checkout /></RequireVerification>} />
                                                                    <Route path="/profile" element={<RequireVerification><Profile /></RequireVerification>} />
                                                                    <Route path="/order/:id" element={<RequireVerification><OrderTracking /></RequireVerification>} />
                                                                    <Route path="/notifications" element={<RequireVerification><Notifications /></RequireVerification>} />
                                                                    <Route path="/smartcart" element={<RequireVerification><SmartCartWishlist /></RequireVerification>} />
                                                                    <Route path="/smartcart/prototype" element={<SmartCartPrototype />} />

                                                                    <Route path="/search" element={<Search />} />
                                                                    <Route path="/how-it-works" element={<HowItWorks />} />
                                                                    <Route path="/privacy" element={<Legal />} />
                                                                    <Route path="/terms" element={<Legal />} />
                                                                    <Route path="/partner" element={<PartnerWithUs />} />
                                                                    <Route path="/careers" element={<Careers />} />
                                                                    <Route path="/careers/:id" element={<CareerDetail />} />
                                                                    <Route path="/surveys" element={<ConsumerSurveys />} />
                                                                    <Route path="/flyers" element={<Flyers />} />
                                                                    <Route path="/consumer" element={<Navigate to="/" replace />} />
                                                                </Route>

                                                                {/* MERCHANT ROUTES with Layout */}
                                                                <Route element={
                                                                    <RequireVerification>
                                                                        <MerchantLayout />
                                                                    </RequireVerification>
                                                                }>
                                                                    <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
                                                                    <Route path="/merchant/onboarding" element={<MerchantOnboarding />} />
                                                                    <Route path="/merchant/products" element={<MerchantProducts />} />
                                                                    <Route path="/merchant/orders" element={<MerchantOrders />} />
                                                                    <Route path="/merchant/flyers" element={<MerchantFlyers />} />
                                                                    <Route path="/merchant/deals" element={<MerchantDeals />} />
                                                                    <Route path="/merchant/settings" element={<MerchantSettings />} />
                                                                    <Route path="/merchant/subscription" element={<MerchantSubscription />} />
                                                                </Route>

                                                                {/* ADMIN ROUTES with Layout */}
                                                                <Route element={
                                                                    <RequireVerification>
                                                                        <AdminLayout />
                                                                    </RequireVerification>
                                                                }>
                                                                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                                                                    <Route path="/admin/users" element={<AdminUserManagement />} />
                                                                    <Route path="/admin/stores" element={<AdminStoreManagement />} />
                                                                    <Route path="/admin/catalog" element={<AdminMasterCatalog />} />
                                                                    <Route path="/admin/settings" element={<AdminSettings />} />
                                                                    <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                                                                    <Route path="/admin/ads" element={<AdminAdManager />} />
                                                                    <Route path="/admin/surveys" element={<AdminSurveyManager />} />
                                                                    <Route path="/admin/tools" element={<AdminSystemTools />} />
                                                                    <Route path="/admin/careers" element={<CareerManagement />} />
                                                                </Route>

                                                                    {/* 404 Catch All */}
                                                                <Route path="*" element={<NotFound />} />
                                                            </Routes>
                                                        </Suspense>
                                                    </ConfirmationProvider>
                                                </LocationProvider>
                                            </OrderProvider>
                                            </WishlistProvider>
                                        </CartProvider>
                                    </ReviewProvider>
                                </CatalogProvider>
                            </MarketplaceProvider>
                        </NotificationProvider>
                    </MaintenanceGuard>
                    </AuditProvider>
                </AuthProvider>
                <ThemeSwitcher />
            </Router>
        </ErrorBoundary>
    );
}

export default App;
