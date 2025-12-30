import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireVerificationProps {
    children: React.ReactNode;
}

const RequireVerification: React.FC<RequireVerificationProps> = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg text-[var(--brand-primary)]"></span>
            </div>
        );
    }

    // 1. Check if logged in
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Check email verification
    // Google SSO users are automatically verified = true
    // Email/Password users start as false
    if (user.emailVerified === false) {
        return <Navigate to="/verify-email" replace />;
    }

    return <>{children}</>;
};

export default RequireVerification;
