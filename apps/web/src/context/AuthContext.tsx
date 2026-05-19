import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail, // Added sendPasswordResetEmail
    User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { auditBridge } from '../utils/auditBridge';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Define User Types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'consumer' | 'merchant' | 'admin';
    phoneNumber?: string;
    avatar?: string;
    // Merchant specific
    storeId?: string;
    storeName?: string;
    businessRegistrationNumber?: string;
    businessType?: string;
    merchantRole?: 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';
    subscriptionTier?: 'free' | 'core' | 'growth' | 'pro';
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid';
    subscriptionEnd?: string; // ISO String
    // Admin specific
    adminRole?: 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR';
    emailVerified?: boolean;
    mfaEnrolled?: boolean;
    // Consumer specific
    address?: string;
    postalCode?: string;
    coordinates?: { lat: number; lng: number };
    // Consent
    consent?: {
        termsVersion: string;
        privacyVersion: string;
        acceptedAt: string;
        userAgent: string;
    };
    marketingConsent?: boolean;
}

export interface ConsentData {
    termsVersion: string;
    privacyVersion: string;
    marketingConsent?: boolean;
}

export type Permission =
    | 'products:write'
    | 'orders:read'
    | 'orders:write'
    | 'flyers:write'
    | 'deals:write'
    | 'settings:write'
    | 'team:manage'
    | 'delivery:manage'
    | 'analytics:read'
    | 'admin:all'
    | 'admin:users'
    | 'admin:stores'
    | 'admin:audit';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    // Merchant Roles
    OWNER: ['products:write', 'orders:read', 'orders:write', 'flyers:write', 'deals:write', 'settings:write', 'team:manage', 'delivery:manage', 'analytics:read'],
    MANAGER: ['products:write', 'orders:read', 'orders:write', 'flyers:write', 'deals:write', 'settings:write', 'delivery:manage', 'analytics:read'],
    STAFF: ['orders:read', 'orders:write', 'delivery:manage'],
    MARKETING: ['flyers:write', 'deals:write', 'analytics:read'],
    // Admin Roles
    SUPER_ADMIN: ['admin:all', 'admin:users', 'admin:stores', 'admin:audit'],
    MODERATOR: ['admin:users', 'admin:stores'],
    SUPPORT: ['admin:users'],
    AUDITOR: ['admin:audit']
};

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    consentRequired: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<User> & { password: string }, consent?: ConsentData) => Promise<boolean>;
    loginWithGoogle: (targetRole?: 'consumer' | 'merchant') => Promise<boolean>;
    loginWithFacebook: () => Promise<boolean>;
    logout: () => void;
    resetPassword: (email: string, settings?: any) => Promise<void>;
    loading: boolean;
    can: (permission: Permission) => boolean;
    switchRole: (role: any) => void;
    updateSubscription: (tier: 'free' | 'core' | 'growth') => void;
    acceptConsent: (consent: ConsentData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [consentRequired, setConsentRequired] = useState(false);

    // Bootstrap Auth Listener with Real-time Firestore Sync
    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Set up real-time listener for the user profile
                const { onSnapshot, doc } = await import('firebase/firestore');
                unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (userDoc) => {
                    if (userDoc.exists()) {
                        processUserData(firebaseUser.uid, userDoc.data(), firebaseUser.emailVerified)
                            .catch((err) => { Sentry.captureException(err); setLoading(false); });
                    } else {
                        // Only set user to null if we are NOT in the middle of a login action
                        // This prevents race conditions where the listener fires before setDoc completes
                        console.warn('[AuthContext] Profile snapshot empty for UID:', firebaseUser.uid);
                        // We don't call setUser(null) here to avoid flickering during registration
                        setLoading(false);
                    }
                }, (error) => {
                    console.error('[AuthContext] Snapshot error:', error);
                    setLoading(false);
                });
            } else {
                // User is signed out
                if (unsubscribeProfile) unsubscribeProfile();
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const processUserData = async (uid: string, data: any, emailVerified: boolean) => {
        try {
            let finalRole = data.role || 'consumer';
            let mfaEnrolled = false;
            let finalAdminRole = data.adminRole;

            // --- ISOLATED STAFF CHECK ---
            // Must run first because it can promote role to 'admin', which gates subsequent checks
            const staffDoc = await getDoc(doc(db, 'staff', data.email.toLowerCase()));
            if (staffDoc.exists()) {
                const staffData = staffDoc.data();
                if (staffData.status === 'active') {
                    finalRole = 'admin';
                    finalAdminRole = staffData.role;
                }
            }

            if (finalRole === 'admin') {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const { multiFactor } = await import('firebase/auth');
                    mfaEnrolled = multiFactor(currentUser).enrolledFactors.length > 0;
                }
            }

            // Fetch settings and store doc in parallel (both may be needed based on role)
            const [settingsDoc, storeDoc] = await Promise.all([
                finalRole !== 'admin' ? getDoc(doc(db, 'settings', 'platform')) : Promise.resolve(null),
                finalRole === 'merchant' && data.storeId ? getDoc(doc(db, 'stores', data.storeId)) : Promise.resolve(null)
            ]);

            const platformSettings = settingsDoc?.exists() ? settingsDoc.data() : null;

            // 1. Maintenance Mode Check
            if (platformSettings?.maintenanceMode) {
                await signOut(auth);
                setUser(null);
                return;
            }

            // 2. Re-consent check: compare stored consent versions against current platform versions
            // Only applies to consumer/merchant roles; admins are exempt
            if (finalRole !== 'admin' && platformSettings) {
                const currentTermsVersion = platformSettings.currentTermsVersion;
                const currentPrivacyVersion = platformSettings.currentPrivacyVersion;
                if (currentTermsVersion && currentPrivacyVersion) {
                    if (
                        !data.consent ||
                        data.consent.termsVersion !== currentTermsVersion ||
                        data.consent.privacyVersion !== currentPrivacyVersion
                    ) {
                        setConsentRequired(true);
                    } else {
                        setConsentRequired(false);
                    }
                }
            }

            // 2. Security Check: If Merchant, verify Store Status
            // REMOVED: Allow merchants to login even if suspended so they can see suspension details.
            /*
            if (storeDoc && storeDoc.exists()) {
                if (storeDoc.data()?.status === 'suspended') {
                    await signOut(auth);
                    setUser(null);
                    return;
                }
            }
            */

            // 3. Status Check: Enforce User Suspension
            if (data.status === 'banned') {
                await signOut(auth);
                setUser(null);
                return;
            }

            // 4. Auto-Activate Invitees
            if (data.status === 'pending_invite') {
                try {
                    await updateDoc(doc(db, 'users', uid), {
                        status: 'active',
                        lastLogin: new Date().toISOString()
                    });
                    data.status = 'active'; // Local update
                } catch (e) {
                    console.error("Failed to activate user:", e);
                }
            }

            const merchantRole = data.role === 'merchant' ? (data.merchantRole || 'OWNER') : undefined;

            // 5. Final State Update
            const finalUserData = {
                ...data,
                id: uid,
                role: finalRole as 'consumer' | 'merchant' | 'admin',
                merchantRole: merchantRole,
                adminRole: finalAdminRole,
                emailVerified: emailVerified,
                mfaEnrolled: mfaEnrolled
            } as User;

            console.log('[AuthContext] Setting user state:', uid, finalRole);
            setUser(finalUserData);
            Sentry.setUser({ id: finalUserData.id, email: finalUserData.email, role: finalUserData.role });
        } catch (error) {
            console.error('[AuthContext] Critical error in processUserData:', error);
            // Fallback: Set basic user data so app doesn't hang
            setUser({ id: uid, email: data?.email, role: 'consumer' } as any);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            
            // 1. Log forensic success immediately after handshake
            await auditBridge.emit({ action: 'AUTH_LOGIN_SUCCESS', metadata: { email } });

            // 2. Process profile and internal state
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userDoc.exists()) {
                await processUserData(userCredential.user.uid, userDoc.data(), userCredential.user.emailVerified);
            }

            // Re-check auth state (processUserData might have forced logout for banned/suspended users)
            if (!auth.currentUser) {
                await auditBridge.emit({ action: 'AUTH_LOGIN_BLOCKED', metadata: { email, reason: 'account_status' } });
                return false; // Login blocked
            }

            return true;
        } catch (error: any) {
            if (error.code === 'auth/multi-factor-auth-required') {
                await auditBridge.emit({ action: 'AUTH_MFA_REQUIRED', metadata: { email } });
                throw error;
            }
            console.error('Login failed:', error);
            await auditBridge.emit({ action: 'AUTH_LOGIN_FAILURE', metadata: { email, error: error.code } });
            return false;
        }
    };

    const register = async (userData: Partial<User> & { password: string; street?: string; city?: string; province?: string; postalCode?: string; businessRegistrationNumber?: string; businessType?: string }, consent?: ConsentData): Promise<boolean> => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email!, userData.password);
            const uid = userCredential.user.uid;

            // Send email verification
            const { sendEmailVerification } = await import('firebase/auth');
            await sendEmailVerification(userCredential.user, {
                url: `${window.location.origin}/`,
                handleCodeInApp: false,
            });

            // Format phone number (Default to +1 for 10 digits)
            let formattedPhone = userData.phoneNumber || null;
            if (formattedPhone) {
                const digits = formattedPhone.replace(/\D/g, '');
                if (digits.length === 10) formattedPhone = `+1${digits}`;
                else if (digits.length === 11 && digits.startsWith('1')) formattedPhone = `+${digits}`;
            }

            // Create User Profile in Firestore
            const newUser: any = {
                id: uid,
                email: userData.email!,
                name: userData.name || 'New User',
                role: (userData.role || 'consumer') as 'consumer' | 'merchant' | 'admin',
                phoneNumber: formattedPhone,
                emailVerified: false,
            };

            // Store consent data if provided
            if (consent) {
                newUser.consent = {
                    termsVersion: consent.termsVersion,
                    privacyVersion: consent.privacyVersion,
                    acceptedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                };
                newUser.marketingConsent = consent.marketingConsent ?? false;
            }

            // Only add merchant fields if the user is a merchant
            if (userData.role === 'merchant') {
                newUser.merchantRole = 'OWNER';
                newUser.subscriptionTier = 'free';
                if (userData.storeName) newUser.storeName = userData.storeName;
                if (userData.businessRegistrationNumber) newUser.businessRegistrationNumber = userData.businessRegistrationNumber;
                if (userData.businessType) newUser.businessType = userData.businessType;
            }

            // Common Address Processing (Consumer & Merchant)
            if (userData.street) {
                const fullAddress = `${userData.street}, ${userData.city}, ${userData.province}, ${userData.postalCode}`;
                newUser.address = fullAddress; // Legacy/Simple access

                // Populate addresses array with structured data
                newUser.addresses = [{
                    id: `addr-${Date.now()}`,
                    label: userData.role === 'merchant' ? 'Store' : 'Home',
                    street: userData.street,
                    city: userData.city || '',
                    province: userData.province || '',
                    postalCode: userData.postalCode || '',
                    isDefault: true
                }];

                // Attempt Geocoding
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        newUser.coordinates = {
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        };
                    }
                } catch (e) {
                    console.warn("Geocoding failed during registration:", e);
                }
            }

            await setDoc(doc(db, 'users', uid), newUser);
            setUser(newUser as User);

            // Write immutable consent log entry
            if (consent) {
                try {
                    await addDoc(collection(db, 'consent_logs'), {
                        userId: uid,
                        email: userData.email!,
                        termsVersion: consent.termsVersion,
                        privacyVersion: consent.privacyVersion,
                        marketingConsent: consent.marketingConsent ?? false,
                        userAgent: navigator.userAgent,
                        acceptedAt: new Date().toISOString(),
                        type: 'registration',
                    });
                } catch (e) {
                    console.warn('[AuthContext] Failed to write consent_log:', e);
                }
                await auditBridge.emit({
                    action: 'CONSUMER_CONSENT_ACCEPTED',
                    metadata: { termsVersion: consent.termsVersion, privacyVersion: consent.privacyVersion, email: userData.email }
                });
            } else {
                await auditBridge.emit({ action: 'AUTH_REGISTER_SUCCESS', metadata: { role: newUser.role } });
            }

            // Redirect to verification page
            window.location.href = '/verify-email';

            return true;
        } catch (error: any) {
            console.error('Registration failed:', error);
            throw error; // Throw error so Register component can display it
        }
    };

    const logout = async () => {
        const email = user?.email;
        try {
            await signOut(auth);
            setUser(null); // Explicitly set user to null on logout
            Sentry.setUser(null);
            await auditBridge.emit({ action: 'AUTH_LOGOUT', metadata: { email } });
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const resetPassword = async (email: string, settings?: any) => {
        try {
            await sendPasswordResetEmail(auth, email, settings);
            // Alert replaced by UI feedback in ForgotPassword.tsx (Caller needs to handle success)
        } catch (error: any) {
            console.error('Password reset failed:', error);
            throw error;
        }
    };


    const loginWithGoogle = async (targetRole: 'consumer' | 'merchant' = 'consumer'): Promise<boolean> => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            let userCredential;

            if (Capacitor.isNativePlatform()) {
                // Ensure the plugin is initialized before every sign-in attempt.
                // On Android, DEVELOPER_ERROR (code 10) crashes the app when the plugin
                // isn't initialized or the SHA-1 fingerprint isn't registered in Firebase.
                try {
                    await GoogleAuth.initialize({
                        clientId: '1012948918368-m29pbhj6nqvdpeda77vd19t6et3thn2u.apps.googleusercontent.com',
                        scopes: ['profile', 'email'],
                        grantOfflineAccess: true,
                    });
                } catch (initErr) {
                    // initialize() may throw if already initialized — safe to ignore
                    console.log('[AuthContext] GoogleAuth.initialize skipped:', initErr);
                }

                console.log('[AuthContext] Initiating Native Google Sign-In');
                const googleUser = await GoogleAuth.signIn();
                console.log('[AuthContext] Native Google Sign-In result:', googleUser);

                if (!googleUser || !googleUser.authentication || !googleUser.authentication.idToken) {
                    throw new Error('Google Auth failed: Missing idToken');
                }

                const idToken = googleUser.authentication.idToken;
                const credential = GoogleAuthProvider.credential(idToken);
                const { signInWithCredential } = await import('firebase/auth');
                userCredential = await signInWithCredential(auth, credential);
            } else {
                // Web Flow
                userCredential = await signInWithPopup(auth, provider);
            }

            const user = userCredential.user;

            // Check if user exists in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // New User: Create Profile with selected role
                const newUser: any = {
                    id: user.uid,
                    email: user.email!,
                    name: user.displayName || 'New User',
                    role: targetRole,
                    phoneNumber: user.phoneNumber || null,
                    joinedAt: new Date().toISOString()
                };

                if (targetRole === 'merchant') {
                    newUser.merchantRole = 'OWNER';
                    newUser.subscriptionTier = 'free';
                    newUser.storeName = `${newUser.name}'s Store`;
                }

                await setDoc(userDocRef, newUser);
            }

            await auditBridge.emit({ action: 'AUTH_SOCIAL_LOGIN_SUCCESS', metadata: { email: user.email, provider: 'google' } });

            const finalUserDoc = userDoc.exists() ? userDoc : await getDoc(userDocRef);
            if (finalUserDoc.exists()) {
                await processUserData(user.uid, finalUserDoc.data(), user.emailVerified);
            }

            return true;
        } catch (error: any) {
            console.error('Google Login failed:', error);
            // Catch native DEVELOPER_ERROR (code 10) — usually means SHA-1 not registered in Firebase Console
            const message = error?.message || '';
            const nativeCode = error?.errorDetails?.errorCode ?? error?.errorCode ?? '';
            if (String(nativeCode) === '10' || message.includes('DEVELOPER_ERROR')) {
                console.error('[AuthContext] DEVELOPER_ERROR: SHA-1 fingerprint not registered in Firebase Console');
            }
            await auditBridge.emit({ action: 'AUTH_SOCIAL_LOGIN_FAILURE', metadata: { provider: 'google', error: error.code ?? error.message } });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const loginWithFacebook = async (): Promise<boolean> => {
        // alert("🎵 Facebook login is incomplete...");
        console.log("Facebook login not implemented yet");
        return false;
    };

    const can = (permission: Permission): boolean => {
        if (!user) return false;
        if (user.role === 'admin' && user.adminRole) {
            const perms = ROLE_PERMISSIONS[user.adminRole] || [];
            return perms.includes(permission) || perms.includes('admin:all');
        }
        if (user.role === 'merchant' && user.merchantRole) {
            const perms = ROLE_PERMISSIONS[user.merchantRole] || [];
            return perms.includes(permission);
        }
        return false;
    };

    const switchRole = (role: any) => {
        // In a real DB, we'd update Firestore
        if (!user) return;
        const updatedUser = { ...user };
        if (user.role === 'merchant') updatedUser.merchantRole = role;
        if (user.role === 'admin') updatedUser.adminRole = role;

        setUser(updatedUser);
        // Persist change to Firestore (Optimistic UI)
        setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    };

    const updateSubscription = async (tier: 'free' | 'core' | 'growth') => {
        if (!user || user.role !== 'merchant') return;
        const updatedUser: User = { ...user, subscriptionTier: tier };
        setUser(updatedUser);
        await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });

        // Also update the STORE document so public consumers can see the tier
        if (user.storeId) {
            await setDoc(doc(db, 'stores', user.storeId), { subscriptionTier: tier }, { merge: true });
        }
    };

    const acceptConsent = async (consent: ConsentData): Promise<void> => {
        if (!user) return;
        const consentRecord = {
            termsVersion: consent.termsVersion,
            privacyVersion: consent.privacyVersion,
            acceptedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
        };
        await updateDoc(doc(db, 'users', user.id), { consent: consentRecord, marketingConsent: consent.marketingConsent ?? user.marketingConsent ?? false });
        try {
            await addDoc(collection(db, 'consent_logs'), {
                userId: user.id,
                email: user.email,
                ...consentRecord,
                marketingConsent: consent.marketingConsent ?? false,
                type: 're-consent',
            });
        } catch (e) {
            console.warn('[AuthContext] Failed to write consent_log:', e);
        }
        await auditBridge.emit({
            action: 'CONSUMER_CONSENT_ACCEPTED',
            metadata: { termsVersion: consent.termsVersion, privacyVersion: consent.privacyVersion, email: user.email, type: 're-consent' }
        });
        setUser({ ...user, consent: consentRecord });
        setConsentRequired(false);
    };

    const value = {
        user,
        isAuthenticated: !!user,
        consentRequired,
        login,
        register,
        loginWithGoogle,
        loginWithFacebook,
        logout,
        resetPassword,
        loading,
        can,
        switchRole,
        updateSubscription,
        acceptConsent
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
