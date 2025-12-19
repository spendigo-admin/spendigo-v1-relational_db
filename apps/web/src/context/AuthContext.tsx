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
    | 'admin:all'
    | 'admin:users'
    | 'admin:stores'
    | 'admin:audit';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    // Merchant Roles
    OWNER: ['products:write', 'orders:read', 'orders:write', 'flyers:write', 'deals:write', 'settings:write', 'team:manage'],
    MANAGER: ['products:write', 'orders:read', 'orders:write', 'flyers:write', 'deals:write', 'settings:write'],
    STAFF: ['orders:read', 'orders:write'],
    MARKETING: ['flyers:write', 'deals:write'],
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
}

type MerchantRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';
type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock Users Database
const MOCK_USERS: Record<string, User> = {
    'admin@spendigo.ca': {
        id: 'admin1',
        email: 'admin@spendigo.ca',
        name: 'System Admin',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        avatar: '🛡️'
    },
    'freshmart@store.com': { id: 'm1', email: 'freshmart@store.com', name: 'FreshMart Owner', role: 'merchant', storeId: '1', storeName: 'FreshMart', merchantRole: 'OWNER', avatar: '🥬' },
    'quick@pick.com': { id: 'm2', email: 'quick@pick.com', name: 'QuickPick Staff', role: 'merchant', storeId: '2', storeName: 'QuickPick', merchantRole: 'OWNER', avatar: '🏪' },
    'metro@express.com': { id: 'm3', email: 'metro@express.com', name: 'Metro Manager', role: 'merchant', storeId: '3', storeName: 'Metro Express', merchantRole: 'OWNER', avatar: '🛒' },
    'costco@biz.com': { id: 'm4', email: 'costco@biz.com', name: 'Costco Marketing', role: 'merchant', storeId: '4', storeName: 'Costco Business', merchantRole: 'OWNER', avatar: '📦' },
    'macs@corner.com': { id: 'm5', email: 'macs@corner.com', name: 'Mac Manager', role: 'merchant', storeId: '5', storeName: "Mac's Corner", merchantRole: 'OWNER', avatar: '🏪' },
    'hasty@mart.com': { id: 'm6', email: 'hasty@mart.com', name: 'Hasty Owner', role: 'merchant', storeId: '6', storeName: 'Hasty Mart', merchantRole: 'OWNER', avatar: '⚡' },
    'bodega@corner.com': { id: 'm7', email: 'bodega@corner.com', name: 'Bodega Boss', role: 'merchant', storeId: '7', storeName: 'Corner Bodega', merchantRole: 'OWNER', avatar: '🏬' },
    'green@valley.com': { id: 'm8', email: 'green@valley.com', name: 'Farmer Joe', role: 'merchant', storeId: '8', storeName: 'Green Valley Market', merchantRole: 'OWNER', avatar: '🌽' },
    'daily@loaf.com': { id: 'm9', email: 'daily@loaf.com', name: 'Baker Bob', role: 'merchant', storeId: '9', storeName: 'The Daily Loaf', merchantRole: 'OWNER', avatar: '🥖' },
    'butcher@block.com': { id: 'm10', email: 'butcher@block.com', name: 'Butcher Bill', role: 'merchant', storeId: '10', storeName: "The Butcher's Block", merchantRole: 'OWNER', avatar: '🥩' },
    'book@nook.com': { id: 'm11', email: 'book@nook.com', name: 'Librarian Linda', role: 'merchant', storeId: '11', storeName: 'The Book Nook', merchantRole: 'OWNER', avatar: '📚' },
    'shopper@example.com': {
        id: 'shop1',
        email: 'shopper@example.com',
        name: 'Alice Shopper',
        role: 'consumer',
        avatar: '🛒'
    }
};

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
        switchRole
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
