export enum UserRole {
    CONSUMER = 'consumer',
    MERCHANT = 'merchant',
    ADMIN = 'admin',
}

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    isBanned: boolean;
    emailVerified: boolean;
    storeId?: string; // If role is merchant
    displayName?: string;
    createdAt: string;
}

export interface AuthState {
    user: UserProfile | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
    login: () => Promise<void>; // This will trigger the provider's logic (e.g. Google Popup)
    logout: () => Promise<void>;
    checkRole: (requiredRole: UserRole) => boolean;
}
