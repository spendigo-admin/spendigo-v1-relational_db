import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Define User Types
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'consumer' | 'merchant' | 'admin';
    avatar?: string;
    // Merchant specific
    storeId?: string;
    storeName?: string;
    merchantRole?: 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';
    subscriptionTier?: 'free' | 'core' | 'growth';
    // Admin specific
    adminRole?: 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR';
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
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
    loginWithGoogle: (targetRole?: 'consumer' | 'merchant') => Promise<boolean>;
    loginWithFacebook: () => Promise<boolean>;
    logout: () => void;
    loading: boolean;
    can: (permission: Permission) => boolean;
    switchRole: (role: any) => void;
    updateSubscription: (tier: 'free' | 'core' | 'growth') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Bootstrap Auth Listener with Real-time Firestore Sync
    useEffect(() => {
        let unsubscribeProfile: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Set up real-time listener for the user profile
                const { onSnapshot, doc } = await import('firebase/firestore');
                unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
                    if (userDoc.exists()) {
                        await processUserData(firebaseUser.uid, userDoc.data());
                    } else {
                        console.error('User profile not found in Firestore');
                        setUser(null);
                        setLoading(false);
                    }
                }, (error) => {
                    console.error('Error listening to user profile:', error);
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

    const processUserData = async (uid: string, data: any) => {
        try {
            let finalRole = data.role || 'consumer';
            let finalAdminRole = data.adminRole;

            // --- ISOLATED STAFF CHECK ---
            const staffDoc = await getDoc(doc(db, 'staff', data.email.toLowerCase()));
            if (staffDoc.exists()) {
                const staffData = staffDoc.data();
                if (staffData.status === 'active') {
                    finalRole = 'admin';
                    finalAdminRole = staffData.role;
                }
            }

            // 1. Maintenance Mode Check
            if (finalRole !== 'admin') {
                const settingsDoc = await getDoc(doc(db, 'settings', 'platform'));
                if (settingsDoc.exists() && settingsDoc.data().maintenanceMode) {
                    await signOut(auth);
                    alert(`🚧 System is in Maintenance Mode. Please try again later.`);
                    setUser(null);
                    return;
                }
            }

            // 2. Security Check: If Merchant, verify Store Status
            if (finalRole === 'merchant' && data.storeId) {
                const storeDoc = await getDoc(doc(db, 'stores', data.storeId));
                if (storeDoc.exists()) {
                    const storeData = storeDoc.data();
                    if (storeData.status === 'suspended') {
                        await signOut(auth);
                        alert('Creating a safe and trusted marketplace is our priority. Your store has been suspended. Please contact support @spendigo.ca.');
                        setUser(null);
                        return;
                    }
                }
            }

            // 3. Status Check: Enforce User Suspension
            if (data.status === 'banned') {
                await signOut(auth);
                alert('Your account has been suspended due to a violation of our terms. Please contact support @spendigo.ca.');
                setUser(null);
                return;
            }

            const merchantRole = data.role === 'merchant' ? (data.merchantRole || 'OWNER') : undefined;

            setUser({
                ...data,
                id: uid,
                role: finalRole as 'consumer' | 'merchant' | 'admin',
                merchantRole: merchantRole,
                adminRole: finalAdminRole
            } as User);
        } catch (error) {
            console.error('Error processing user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserProfile = async (uid: string) => {
        // fetchUserProfile is now primarily handled by onSnapshot, but we keep the logic 
        // for initial loads if needed, though processUserData handles it now.
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            await processUserData(uid, userDoc.data());
        }
    };

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            setLoading(true);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            // Explicitly fetch profile here to ensure 'user' state is populated before login returns true
            await fetchUserProfile(userCredential.user.uid);

            // Re-check auth state (fetchUserProfile might have forced logout)
            if (!auth.currentUser) {
                return false; // Login blocked
            }

            return true;
        } catch (error) {
            console.error('Login failed:', error);
            alert('Login failed. Please check your email and password.');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, userData.email!, userData.password);
            const uid = userCredential.user.uid;

            // Create User Profile in Firestore
            // Firestore throws if any field is undefined. We must construct this carefully.
            const newUser: any = {
                id: uid,
                email: userData.email!,
                name: userData.name || 'New User',
                role: userData.role || 'consumer'
            };

            // Only add merchant fields if the user is a merchant
            if (userData.role === 'merchant') {
                newUser.merchantRole = 'OWNER';
                newUser.subscriptionTier = 'free';
                if (userData.storeName) newUser.storeName = userData.storeName;
            }

            await setDoc(doc(db, 'users', uid), newUser);
            setUser(newUser as User);
            return true;
        } catch (error: any) {
            console.error('Registration failed:', error);
            // Show more detailed error
            alert(`Registration failed: ${error.message}`);
            return false;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const loginWithGoogle = async (targetRole: 'consumer' | 'merchant' = 'consumer'): Promise<boolean> => {
        try {
            setLoading(true);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

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
                    joinedAt: new Date().toISOString()
                };

                if (targetRole === 'merchant') {
                    newUser.merchantRole = 'OWNER';
                    newUser.subscriptionTier = 'free';
                    newUser.storeName = `${newUser.name}'s Store`; // Default store name
                }

                await setDoc(userDocRef, newUser);
            }

            // Fetch profile (whether new or existing)
            await fetchUserProfile(user.uid);
            return true;
        } catch (error: any) {
            console.error('Google Login failed:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                return false;
            }
            alert(`Google Login failed: ${error.message}`);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const loginWithFacebook = async (): Promise<boolean> => {
        alert("🎵 Facebook login is incomplete,\nA feature that we've yet to meet.\nUse Google or Email to proceed,\nAnd get the savings that you need! 🎵");
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

    const updateSubscription = (tier: 'free' | 'core' | 'growth') => {
        if (!user || user.role !== 'merchant') return;
        const updatedUser: User = { ...user, subscriptionTier: tier };
        setUser(updatedUser);
        setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    };

    const value = {
        user,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGoogle,
        loginWithFacebook,
        logout,
        loading,
        can,
        switchRole,
        updateSubscription
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
