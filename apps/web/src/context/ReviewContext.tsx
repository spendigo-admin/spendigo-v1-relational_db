import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    increment,
    getDoc,
    serverTimestamp,
    limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface Review {
    id: string;
    targetId: string;
    targetType: 'store' | 'shopper';
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    rating: number; // 1-5
    comment: string;
    timestamp: any;
    orderId?: string; // Optional, for verified purchase context
}

interface ReviewContextType {
    reviews: Review[];
    loading: boolean;
    fetchReviews: (targetId: string, limitCount?: number) => void;
    addReview: (review: Omit<Review, 'id' | 'timestamp' | 'authorName' | 'authorAvatar'>) => Promise<void>;
    getAverageRating: (targetId: string) => Promise<{ rating: number, count: number }>;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

export const ReviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(false);

    // Just a placeholder for subscription cleanup if needed
    const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

    const fetchReviews = (targetId: string, limitCount: number = 20) => {
        if (unsubscribe) unsubscribe();

        setLoading(true);
        const q = query(
            collection(db, 'reviews'),
            where('targetId', '==', targetId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const fetchedReviews: Review[] = [];
            snapshot.forEach(doc => {
                fetchedReviews.push({ id: doc.id, ...doc.data() } as Review);
            });
            setReviews(fetchedReviews);
            setLoading(false);
        });

        setUnsubscribe(() => unsub);
    };

    const addReview = async (reviewData: Omit<Review, 'id' | 'timestamp' | 'authorName' | 'authorAvatar'>) => {
        if (!user) throw new Error("Must be logged in to review");

        const newReview = {
            ...reviewData,
            authorId: user.id,
            authorName: user.name,
            authorAvatar: user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
            timestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, 'reviews'), newReview);

        // Update Aggregate Rating on Target (Simulated for this prototype)
        // In a real app, this should be done via Cloud Functions to ensure consistency
        const targetCollection = reviewData.targetType === 'store' ? 'stores' : 'users';
        const targetRef = doc(db, targetCollection, reviewData.targetId);

        // We do a simple increment here. For perfect averages, we need to read-modify-write or use distributed counters.
        // Simplified: Fetch current, calc new avg, update.
        // Note: This is prone to race conditions but acceptable for prototype.

        try {
            const targetDoc = await getDoc(targetRef);
            if (targetDoc.exists()) {
                const data = targetDoc.data();
                const currentCount = data.reviewCount || 0;
                const currentRating = data.rating || 0;

                const newCount = currentCount + 1;
                const newRating = ((currentRating * currentCount) + reviewData.rating) / newCount;

                updateDoc(targetRef, {
                    rating: parseFloat(newRating.toFixed(1)), // Keep it to 1 decimal
                    reviewCount: newCount
                });
            }
        } catch (e) {
            console.error("Failed to update aggregate rating", e);
        }
    };

    const getAverageRating = async (targetId: string) => {
        // Implementation note: This function might be redundant if we store aggregations on the target object.
        // But useful if we want to calc on the fly.
        // For efficiency, we'll return what's in the stores/users collection usually.
        // But here, let's just return 0 if not needed, or implement full query if strict.
        return { rating: 0, count: 0 };
    };

    return (
        <ReviewContext.Provider value={{
            reviews,
            loading,
            fetchReviews,
            addReview,
            getAverageRating
        }}>
            {children}
        </ReviewContext.Provider>
    );
};

export const useReviews = () => {
    const context = useContext(ReviewContext);
    if (context === undefined) {
        throw new Error('useReviews must be used within a ReviewProvider');
    }
    return context;
};
