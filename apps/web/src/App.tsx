import React from 'react';
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

import ConsumerLayout from './layouts/ConsumerLayout';
import MerchantLayout from './layouts/MerchantLayout';
import AdminLayout from './layouts/AdminLayout';

// Consumer Pages
import StoreList from './pages/consumer/StoreList';
import StoreDetail from './pages/consumer/StoreDetail';
import ProductDetail from './pages/consumer/ProductDetail';
import Cart from './pages/consumer/Cart';
import Checkout from './pages/consumer/Checkout';
import Login from './pages/consumer/Login';
import Register from './pages/consumer/Register';
import Profile from './pages/consumer/Profile';
import Search from './pages/consumer/Search';
import OrderTracking from './pages/consumer/OrderTracking';
import Notifications from './pages/consumer/Notifications';
import SmartCartWishlist from './pages/consumer/SmartCartWishlist';
import HowItWorks from './pages/consumer/HowItWorks';

// Merchant Pages
import MerchantDashboard from './pages/merchant/Dashboard';
import MerchantOnboarding from './pages/merchant/Onboarding';
import MerchantProducts from './pages/merchant/Products';
import MerchantOrders from './pages/merchant/Orders';
import MerchantFlyers from './pages/merchant/Flyers';
import MerchantDeals from './pages/merchant/Deals';
import MerchantSettings from './pages/merchant/Settings';
import MerchantSubscription from './pages/merchant/Subscription';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminUserManagement from './pages/admin/UserManagement';
import AdminStoreManagement from './pages/admin/StoreManagement';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminFlyerModeration from './pages/admin/FlyerModeration';
import AdminSettings from './pages/admin/Settings';
import SeedUsers from './pages/admin/SeedUsers';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import MaintenancePage from './pages/Maintenance';

function MaintenanceGuard({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'platform'), (doc) => {
            setMaintenanceMode(doc.data()?.maintenanceMode || false);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    // Admin Bypass
    if (user?.role === 'admin') return <>{children}</>;

    // Login Page Bypass (to allow admins to log in during maintenance)
    // We check window.location because Router isn't mounted yet? 
    // Wait, Router IS mounted outside this in App usually, but here MaintenanceGuard is INSIDE Router but OUTSIDE Routes.
    // So we can use useLocation.

    // Actually, checking window.location.pathname is safer if outside Routes match
    if (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/admin')) {
        // Allow access to login page so admins can actually sign in
        // /admin is protected by AuthContext anyway, so if they aren't logged in, they hit login.
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
                        <AuditProvider>
                            <CatalogProvider>
                                <MarketplaceProvider>
                                    <ReviewProvider>
                                        <CartProvider>
                                            <OrderProvider>
                                                <NotificationProvider>
                                                    <WishlistProvider>
                                                        <Routes>
                                                            {/* AUTH ROUTES (Fullscreen) */}
                                                            <Route path="/login" element={<Login />} />
                                                            <Route path="/register" element={<Register />} />

                                                            {/* CONSUMER ROUTES wrapped in Layout */}
                                                            <Route element={<ConsumerLayout />}>
                                                                <Route path="/" element={<StoreList />} />
                                                                <Route path="/store/:id" element={<StoreDetail />} />
                                                                <Route path="/product/:id" element={<ProductDetail />} />
                                                                <Route path="/cart" element={<Cart />} />
                                                                <Route path="/checkout" element={<Checkout />} />
                                                                <Route path="/profile" element={<Profile />} />
                                                                <Route path="/search" element={<Search />} />
                                                                <Route path="/order/:id" element={<OrderTracking />} />
                                                                <Route path="/notifications" element={<Notifications />} />
                                                                <Route path="/smartcart" element={<SmartCartWishlist />} />
                                                                <Route path="/how-it-works" element={<HowItWorks />} />
                                                                <Route path="/consumer" element={<Navigate to="/" replace />} />
                                                            </Route>

                                                            {/* MERCHANT ROUTES with Layout */}
                                                            <Route element={<MerchantLayout />}>
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
                                                            <Route element={<AdminLayout />}>
                                                                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                                                                <Route path="/admin/users" element={<AdminUserManagement />} />
                                                                <Route path="/admin/stores" element={<AdminStoreManagement />} />
                                                                <Route path="/admin/settings" element={<AdminSettings />} />
                                                                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                                                            </Route>

                                                            {/* TEMP: Public Seed Route for Migration */}
                                                            <Route path="/admin/seed" element={<SeedUsers />} />

                                                            {/* 404 Catch All */}
                                                            <Route path="*" element={<NotFound />} />
                                                        </Routes>
                                                    </WishlistProvider>
                                                </NotificationProvider>
                                            </OrderProvider>
                                        </CartProvider>
                                    </ReviewProvider>
                                </MarketplaceProvider>
                            </CatalogProvider>
                        </AuditProvider>
                    </MaintenanceGuard>
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
