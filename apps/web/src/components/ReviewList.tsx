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
    const { reviews, loading, fetchReviews } = useReviews();

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
                <div key={review.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs">
                                {review.authorAvatar || '👤'}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900">{review.authorName}</p>
                                <p className="text-xs text-gray-400">
                                    {review.timestamp?.seconds
                                        ? formatDistanceToNow(new Date(review.timestamp.seconds * 1000), { addSuffix: true })
                                        : 'Just now'}
                                </p>
                            </div>
                        </div>
                        <StarRating rating={review.rating} size="sm" />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
