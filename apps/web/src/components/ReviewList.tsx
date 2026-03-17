import React, { useEffect } from 'react';
import { useReviews } from '../context/ReviewContext';
import StarRating from './StarRating';
import { formatDistanceToNow } from 'date-fns';

interface ReviewListProps {
    targetId: string;
    targetType: 'store' | 'shopper';
    limit?: number;
}

const ReviewList: React.FC<ReviewListProps> = ({ targetId, targetType, limit }) => {
    const { reviews, loading, fetchReviews, voteReview } = useReviews();

    useEffect(() => {
        fetchReviews(targetId, limit);
    }, [targetId, limit]);

    if (loading) return <div className="text-center py-4 text-gray-400">Loading reviews...</div>;

    if (reviews.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-2xl mb-2">📝</p>
                <p className="text-gray-500 font-medium">No reviews yet.</p>
                <p className="text-sm text-gray-400">Be the first to share your experience!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <div key={review.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-[var(--surface-2)] rounded-full flex items-center justify-center text-sm font-bold border border-[var(--glass-border)]">
                                {review.authorAvatar || '👤'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-gray-900">{review.authorName}</p>
                                    {review.orderId && (
                                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            ✓ Verified Purchase
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400">
                                    {review.timestamp?.seconds
                                        ? formatDistanceToNow(new Date(review.timestamp.seconds * 1000), { addSuffix: true })
                                        : 'Just now'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <StarRating rating={review.rating} size="sm" />
                        </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">{review.comment}</p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <button 
                            onClick={() => voteReview(review.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[var(--brand-primary)] transition-colors group"
                        >
                            <span className="group-hover:scale-120 transition-transform">👍</span>
                            Helpful {review.helpfulCount ? `(${review.helpfulCount})` : ''}
                        </button>
                        
                        <button className="text-[10px] text-gray-300 hover:text-red-400 transition-colors">
                            Report
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
