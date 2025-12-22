import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorFallback from './components/ErrorFallback';
import NotFound from './pages/NotFound';

import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { AuditProvider } from './context/AuditContext';

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

function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.href = '/'}>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                    <AuditProvider>
                        <MarketplaceProvider>
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
                        </MarketplaceProvider>
                    </AuditProvider>
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
