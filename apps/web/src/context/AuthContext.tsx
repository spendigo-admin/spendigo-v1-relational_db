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
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    register: (userData: Partial<User> & { password: string }) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock Users Database
const MOCK_USERS: Record<string, User> = {
    'admin@spendigo.ca': {
        id: 'admin1',
        email: 'admin@spendigo.ca',
        name: 'System Admin',
        role: 'admin',
        avatar: '🛡️'
    },
    'freshmart@store.com': { id: 'm1', email: 'freshmart@store.com', name: 'FreshMart Manager', role: 'merchant', storeId: '1', storeName: 'FreshMart', avatar: '🥬' },
    'quick@pick.com': { id: 'm2', email: 'quick@pick.com', name: 'QuickPick Owner', role: 'merchant', storeId: '2', storeName: 'QuickPick', avatar: '🏪' },
    'metro@express.com': { id: 'm3', email: 'metro@express.com', name: 'Metro Manager', role: 'merchant', storeId: '3', storeName: 'Metro Express', avatar: '🛒' },
    'costco@biz.com': { id: 'm4', email: 'costco@biz.com', name: 'Costco Admin', role: 'merchant', storeId: '4', storeName: 'Costco Business', avatar: '📦' },
    'macs@corner.com': { id: 'm5', email: 'macs@corner.com', name: 'Mac Manager', role: 'merchant', storeId: '5', storeName: "Mac's Corner", avatar: '🏪' },
    'hasty@mart.com': { id: 'm6', email: 'hasty@mart.com', name: 'Hasty Owner', role: 'merchant', storeId: '6', storeName: 'Hasty Mart', avatar: '⚡' },
    'bodega@corner.com': { id: 'm7', email: 'bodega@corner.com', name: 'Bodega Boss', role: 'merchant', storeId: '7', storeName: 'Corner Bodega', avatar: '🏬' },
    'green@valley.com': { id: 'm8', email: 'green@valley.com', name: 'Farmer Joe', role: 'merchant', storeId: '8', storeName: 'Green Valley Market', avatar: '🌽' },
    'daily@loaf.com': { id: 'm9', email: 'daily@loaf.com', name: 'Baker Bob', role: 'merchant', storeId: '9', storeName: 'The Daily Loaf', avatar: '🥖' },
    'butcher@block.com': { id: 'm10', email: 'butcher@block.com', name: 'Butcher Bill', role: 'merchant', storeId: '10', storeName: "The Butcher's Block", avatar: '🥩' },
    'book@nook.com': { id: 'm11', email: 'book@nook.com', name: 'Librarian Linda', role: 'merchant', storeId: '11', storeName: 'The Book Nook', avatar: '📚' },
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
                    storeName: userData.storeName
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

    const value = {
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loading
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
