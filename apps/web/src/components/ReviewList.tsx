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

    if (loading) return <div className="text-center py-10 text-gray-400 font-black animate-pulse uppercase tracking-widest text-xs">Fetching Reviews...</div>;

    if (reviews.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-3xl border-4 border-dashed border-gray-100 flex flex-col items-center justify-center">
                <span className="text-5xl mb-4 grayscale opacity-20">💬</span>
                <p className="text-gray-400 font-bold uppercase tracking-widest italic leading-none">Silent Aisle</p>
                <p className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter mt-1">Be the first to leave a voice!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {reviews.map((review) => (
                <div key={review.id} className="group bg-white p-6 rounded-3xl border-2 border-gray-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                                {typeof review.authorAvatar === 'string' && review.authorAvatar.length > 2 
                                    ? <img src={review.authorAvatar} alt="" className="w-full h-full object-cover rounded-2xl" />
                                    : (review.authorName?.charAt(0) || '👤')}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{review.authorName}</p>
                                    {review.orderId && (
                                        <span className="text-[9px] bg-red-600 text-white font-black px-2 py-0.5 rounded skew-x-[-12deg] shadow-sm flex items-center gap-0.5 uppercase">
                                            Verified Shopper
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                    {review.timestamp?.seconds
                                        ? formatDistanceToNow(new Date(review.timestamp.seconds * 1000), { addSuffix: true })
                                        : 'Just now'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-2 py-1 rounded-lg">
                            <StarRating rating={review.rating} size="sm" />
                        </div>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute -left-2 -top-2 text-4xl text-gray-100 font-serif leading-none italic select-none">“</span>
                        <p className="text-gray-700 text-sm md:text-base leading-relaxed mb-6 pl-4 font-medium italic relative z-10">
                            {review.comment}
                        </p>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t-2 border-gray-50">
                        <button 
                            onClick={() => voteReview(review.id)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-600 transition-all group/btn"
                        >
                            <span className="bg-gray-50 group-hover/btn:bg-red-50 p-1.5 rounded-lg transition-colors">
                                <svg className="w-3 h-3 group-hover/btn:scale-125 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 10h4.708C19.746 10 20.5 10.957 20.5 12.083c0 .356-.052.703-.153 1.02l-2.618 8.182A2.083 2.083 0 0115.741 22.75H5.083c-1.15 0-2.083-.933-2.083-2.083V10.25c0-1.15.933-2.083 2.083-2.083h1.25M14 10V5.25A2.25 2.25 0 109.5 5.25V10.25" />
                                </svg>
                            </span>
                            Helpful {review.helpfulCount ? <span className="text-red-600">({review.helpfulCount})</span> : ''}
                        </button>
                        
                        <button className="text-[9px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-600 transition-colors">
                            Flag Post
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
