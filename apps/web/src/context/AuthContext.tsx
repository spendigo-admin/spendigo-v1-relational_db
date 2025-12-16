import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { UserRole, UserProfile, AuthContextType } from '../../../../packages/shared/src/auth/types';

// Mock function to simulate fetching extended profile from DB (Role, Ban status)
// In production, this would call our API.
async function fetchUserProfile(firebaseUser: User): Promise<UserProfile> {
    // Simulate API latency
    // await new Promise(r => setTimeout(r, 500)); 

    // LOGIC: In a real app, we fetch the 'users' table row here.
    // For now, valid logic:
    // 1. If email contains 'spendigo.admin', role = ADMIN
    // 2. If email contains 'store', role = MERCHANT
    // 3. Else CONSUMER

    let role = UserRole.CONSUMER;
    if (firebaseUser.email?.includes('admin')) role = UserRole.ADMIN;
    else if (firebaseUser.email?.includes('store')) role = UserRole.MERCHANT;

    return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        role,
        isBanned: false, // Default to false until DB integrated
        emailVerified: firebaseUser.emailVerified,
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
        displayName: firebaseUser.displayName || undefined
    };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            if (firebaseUser) {
                try {
                    const profile = await fetchUserProfile(firebaseUser);
                    if (profile.isBanned) {
                        await signOut(auth);
                        setError("Account suspended. Contact support.");
                        setUser(null);
                    } else {
                        setUser(profile);
                        setError(null);
                    }
                } catch (err) {
                    console.error("Profile fetch error:", err);
                    setError("Failed to load user profile.");
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            setError(null);
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message || "Login failed");
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
        } catch (err: any) {
            setError(err.message || "Logout failed");
        }
    };

    const checkRole = (requiredRole: UserRole): boolean => {
        if (!user) return false;
        if (user.role === UserRole.ADMIN) return true; // Admin accesses everything
        return user.role === requiredRole;
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            isAuthenticated: !!user,
            login,
            logout,
            checkRole
        }}>
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
