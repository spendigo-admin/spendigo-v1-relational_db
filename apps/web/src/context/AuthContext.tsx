import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    loginWithGoogle: () => Promise<boolean>;
    loginWithFacebook: () => Promise<boolean>;
    logout: () => void;
    loading: boolean;
    can: (permission: Permission) => boolean;
    switchRole: (role: MerchantRole | AdminRole) => void;
    updateSubscription: (tier: 'free' | 'core' | 'growth') => void;
}

type MerchantRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';
type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define Stores Data
const STORES = [
    { id: '1', name: 'FreshMart', slug: 'freshmart', tier: 'growth' },
    { id: '2', name: 'QuickPick', slug: 'quickpick', tier: 'free' },
    { id: '3', name: 'Metro Express', slug: 'metro', tier: 'core' },
    { id: '4', name: 'Costco Business', slug: 'costco', tier: 'growth' },
    { id: '5', name: "Mac's Corner", slug: 'macs', tier: 'free' },
    { id: '6', name: 'Hasty Mart', slug: 'hasty', tier: 'core' },
    { id: '7', name: 'Corner Bodega', slug: 'bodega', tier: 'free' },
    { id: '8', name: 'Green Valley Market', slug: 'greenvalley', tier: 'core' },
    { id: '9', name: 'The Daily Loaf', slug: 'bakery', tier: 'free' },
    { id: '10', name: "The Butcher's Block", slug: 'butcher', tier: 'core' },
    { id: '11', name: 'The Book Nook', slug: 'books', tier: 'free' }
] as const;

// Generate Mock Users
const generateMockUsers = () => {
    const users: Record<string, User> = {
        'admin@spendigo.ca': {
            id: 'admin1',
            email: 'admin@spendigo.ca',
            name: 'System Admin',
            role: 'admin',
            adminRole: 'SUPER_ADMIN',
            avatar: '🛡️'
        },
        'shopper@example.com': {
            id: 'shop1',
            email: 'shopper@example.com',
            name: 'Alice Shopper',
            role: 'consumer',
            avatar: '🛒'
        },
        'family@spendigo.ca': {
            id: 'shop2',
            email: 'family@spendigo.ca',
            name: 'Sarah Family',
            role: 'consumer',
            avatar: '👨‍👩‍👧‍👦'
        },
        'student@spendigo.ca': {
            id: 'shop3',
            email: 'student@spendigo.ca',
            name: 'Steve Student',
            role: 'consumer',
            avatar: '🎓'
        },
        'chef@spendigo.ca': {
            id: 'shop4',
            email: 'chef@spendigo.ca',
            name: 'Chef Chris',
            role: 'consumer',
            avatar: '👨‍🍳'
        }
    };

    STORES.forEach(store => {
        // Owner
        users[`${store.slug}.owner@spendigo.ca`] = {
            id: `m-${store.id}-owner`,
            email: `${store.slug}.owner@spendigo.ca`,
            name: `${store.name} Owner`,
            role: 'merchant',
            storeId: store.id,
            storeName: store.name,
            merchantRole: 'OWNER',
            subscriptionTier: store.tier as any,
            avatar: '👔'
        };
        // Manager
        users[`${store.slug}.manager@spendigo.ca`] = {
            id: `m-${store.id}-manager`,
            email: `${store.slug}.manager@spendigo.ca`,
            name: `${store.name} Manager`,
            role: 'merchant',
            storeId: store.id,
            storeName: store.name,
            merchantRole: 'MANAGER',
            subscriptionTier: store.tier as any,
            avatar: '👩‍💼'
        };
        // Staff
        users[`${store.slug}.staff@spendigo.ca`] = {
            id: `m-${store.id}-staff`,
            email: `${store.slug}.staff@spendigo.ca`,
            name: `${store.name} Staff`,
            role: 'merchant',
            storeId: store.id,
            storeName: store.name,
            merchantRole: 'STAFF',
            subscriptionTier: store.tier as any,
            avatar: '🧢'
        };
    });

    // Legacy support (optional, can be removed if we want strictly new format)
    // mapping old emails to new format equivalent or just keeping them temporarily
    users['freshmart@store.com'] = users['freshmart.owner@spendigo.ca'];
    users['quick@pick.com'] = users['quickpick.staff@spendigo.ca']; // Note: Old QuickPick was Staff in description but Owner data

    return users;
};

const MOCK_USERS = generateMockUsers();

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize from localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem('spendigo_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email: string, _password: string): Promise<boolean> => {
        // Simulate API call
        return new Promise((resolve) => {
            setTimeout(() => {
                // Check if it's a known mock user
                const mockUser = MOCK_USERS[email];

                if (mockUser) {
                    // Success for known users
                    setUser(mockUser);
                    localStorage.setItem('spendigo_user', JSON.stringify(mockUser));
                    resolve(true);
                } else {
                    // Default fallback for unknown credentials (treat as consumer for demo)
                    // In a real app, this would be an error
                    const fallbackUser: User = {
                        id: `u-${Date.now()}`,
                        email,
                        name: email.split('@')[0],
                        role: 'consumer',
                        avatar: '👤'
                    };
                    setUser(fallbackUser);
                    localStorage.setItem('spendigo_user', JSON.stringify(fallbackUser));
                    resolve(true);
                }
            }, 800);
        });
    };

    const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const newUser: User = {
                    id: `u-${Date.now()}`,
                    email: userData.email || '',
                    name: userData.name || 'New User',
                    role: userData.role || 'consumer',
                    avatar: userData.role === 'merchant' ? '🏪' : '👤',
                    merchantRole: userData.role === 'merchant' ? 'OWNER' : undefined,
                    storeName: userData.storeName
                };

                setUser(newUser);
                localStorage.setItem('spendigo_user', JSON.stringify(newUser));
                resolve(true);
            }, 800);
        });
    };

    const loginWithGoogle = async (): Promise<boolean> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const newUser: User = {
                    id: `u-google-${Date.now()}`,
                    email: `google_user_${Date.now()}@gmail.com`,
                    name: 'Google User',
                    role: 'consumer',
                    avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c' // Placeholder
                };
                setUser(newUser);
                localStorage.setItem('spendigo_user', JSON.stringify(newUser));
                resolve(true);
            }, 800);
        });
    };

    const loginWithFacebook = async (): Promise<boolean> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const newUser: User = {
                    id: `u-fb-${Date.now()}`,
                    email: `fb_user_${Date.now()}@facebook.com`,
                    name: 'Facebook User',
                    role: 'consumer',
                    avatar: 'https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=12345&height=100&width=100&ext=12345' // Placeholder
                };
                setUser(newUser);
                localStorage.setItem('spendigo_user', JSON.stringify(newUser));
                resolve(true);
            }, 800);
        });
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('spendigo_user');
        // Optional: Redirect to login or home
        window.location.href = '/login';
    };

    const can = (permission: Permission): boolean => {
        if (!user) return false;

        // Admin permissions
        if (user.role === 'admin' && user.adminRole) {
            const perms = ROLE_PERMISSIONS[user.adminRole] || [];
            return perms.includes(permission) || perms.includes('admin:all');
        }

        // Merchant permissions
        if (user.role === 'merchant' && user.merchantRole) {
            const perms = ROLE_PERMISSIONS[user.merchantRole] || [];
            return perms.includes(permission);
        }

        return false;
    };

    const switchRole = (role: MerchantRole | AdminRole) => {
        if (!user) return;
        const updatedUser = { ...user };
        if (user.role === 'merchant') {
            updatedUser.merchantRole = role as MerchantRole;
        } else if (user.role === 'admin') {
            updatedUser.adminRole = role as AdminRole;
        }
        setUser(updatedUser);
        localStorage.setItem('spendigo_user', JSON.stringify(updatedUser));
    };

    const updateSubscription = (tier: 'free' | 'core' | 'growth') => {
        if (!user || user.role !== 'merchant') return;

        const updatedUser: User = { ...user, subscriptionTier: tier };
        setUser(updatedUser);
        localStorage.setItem('spendigo_user', JSON.stringify(updatedUser));
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
