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

// Consumer Pages — lazy loaded
const StoreList = lazy(() => import('./pages/consumer/StoreList'));
const StoreDetail = lazy(() => import('./pages/consumer/StoreDetail'));
const ProductDetail = lazy(() => import('./pages/consumer/ProductDetail'));
const Cart = lazy(() => import('./pages/consumer/Cart'));
const Checkout = lazy(() => import('./pages/consumer/Checkout'));
const Profile = lazy(() => import('./pages/consumer/Profile'));
const OrderTracking = lazy(() => import('./pages/consumer/OrderTracking'));
const Notifications = lazy(() => import('./pages/consumer/Notifications'));
const SmartCartWishlist = lazy(() => import('./pages/consumer/SmartCartWishlist'));
const Search = lazy(() => import('./pages/consumer/Search'));
const HowItWorks = lazy(() => import('./pages/consumer/HowItWorks'));
const ConsumerSurveys = lazy(() => import('./pages/consumer/Surveys'));

// Merchant Pages — lazy loaded
const MerchantDashboard = lazy(() => import('./pages/merchant/Dashboard'));
const MerchantOnboarding = lazy(() => import('./pages/merchant/Onboarding'));
const MerchantProducts = lazy(() => import('./pages/merchant/Products'));
const MerchantOrders = lazy(() => import('./pages/merchant/Orders'));
const MerchantFlyers = lazy(() => import('./pages/merchant/Flyers'));
const MerchantDeals = lazy(() => import('./pages/merchant/Deals'));
const MerchantSettings = lazy(() => import('./pages/merchant/Settings'));
const MerchantSubscription = lazy(() => import('./pages/merchant/Subscription'));

// Admin Pages — lazy loaded
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AdminStoreManagement = lazy(() => import('./pages/admin/StoreManagement'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminFlyerModeration = lazy(() => import('./pages/admin/FlyerModeration'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminMasterCatalog = lazy(() => import('./pages/admin/MasterCatalog'));
const AdminSeedUsers = lazy(() => import('./pages/admin/SeedUsers'));
const AdminAdManager = lazy(() => import('./pages/admin/AdManager'));
const AdminSurveyManager = lazy(() => import('./pages/admin/SurveyManager'));
const AdminSystemTools = lazy(() => import('./pages/admin/SystemTools'));

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import MaintenancePage from './pages/Maintenance';

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

function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.href = '/'}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                    <MaintenanceGuard>
                        <NotificationProvider>
                            <MarketplaceProvider>
                                <CatalogProvider>
                                    <ReviewProvider>
                                        <CartProvider>
                                            <WishlistProvider>
                                                <OrderProvider>
                                                    <ConfirmationProvider>
                                                        <Suspense fallback={<PageLoader />}>
                                                            <Routes>
                                                                {/* AUTH ROUTES (Fullscreen) */}
                                                                <Route path="/login" element={<Login />} />
                                                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                                                <Route path="/register" element={<Register />} />
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

                                                                    <Route path="/search" element={<Search />} />
                                                                    <Route path="/how-it-works" element={<HowItWorks />} />
                                                                    <Route path="/surveys" element={<ConsumerSurveys />} />
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
                                                                        <AuditProvider>
                                                                            <AdminLayout />
                                                                        </AuditProvider>
                                                                    </RequireVerification>
                                                                }>
                                                                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                                                                    <Route path="/admin/users" element={<AdminUserManagement />} />
                                                                    <Route path="/admin/stores" element={<AdminStoreManagement />} />
                                                                    <Route path="/admin/catalog" element={<AdminMasterCatalog />} />
                                                                    <Route path="/admin/seed" element={<AdminSeedUsers />} />
                                                                    <Route path="/admin/settings" element={<AdminSettings />} />
                                                                    <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                                                                    <Route path="/admin/ads" element={<AdminAdManager />} />
                                                                    <Route path="/admin/surveys" element={<AdminSurveyManager />} />
                                                                    <Route path="/admin/tools" element={<AdminSystemTools />} />
                                                                </Route>

                                                                {/* 404 Catch All */}
                                                                <Route path="*" element={<NotFound />} />
                                                            </Routes>
                                                        </Suspense>
                                                    </ConfirmationProvider>
                                                </OrderProvider>
                                            </WishlistProvider>
                                        </CartProvider>
                                    </ReviewProvider>
                                </CatalogProvider>
                            </MarketplaceProvider>
                        </NotificationProvider>
                    </MaintenanceGuard>
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
