import React, { useState } from 'react';
import { useReviews } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';
import StarRating from './StarRating';
import { useNavigate } from 'react-router-dom';

interface ReviewFormProps {
    targetId: string;
    targetType: 'store' | 'shopper';
    onSubmitted?: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ targetId, targetType, onSubmitted }) => {
    const { addReview } = useReviews();
    const { user } = useAuth();
    const { orders } = useOrders();
    const navigate = useNavigate();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [orderId, setOrderId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Only show orders for this store that are delivered
    const relevantOrders = orders.filter(o => 
        o.storeId === targetId && 
        (o.status === 'delivered' || o.status === 'placed') // placed for demo/prototype flexibility
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (rating === 0) {
            setError('Please select a rating');
            return;
        }
        if (!comment.trim()) {
            setError('Please write a comment');
            return;
        }

        setSubmitting(true);
        try {
            await addReview({
                targetId,
                targetType,
                rating,
                comment,
                authorId: user?.id || '',
                orderId: orderId || undefined
            });
            setRating(0);
            setComment('');
            setOrderId('');
            if (onSubmitted) onSubmitted();
        } catch (err: any) {
            console.error(err);
            setError('Failed to submit review. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-sm text-blue-800 mb-2">Please log in to write a review.</p>
                <button
                    onClick={() => navigate('/login')}
                    className="text-xs font-bold text-blue-600 hover:underline"
                >
                    Log In
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3">Write a Review</h3>

            {error && <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}

            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rating</label>
                <StarRating rating={rating} editable onChange={setRating} size="lg" />
            </div>

            {relevantOrders.length > 0 && (
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                        🛒 Verified Purchase
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Earn Badge</span>
                    </label>
                    <select
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                        <option value="">Select an order to verify (optional)</option>
                        {relevantOrders.map(order => (
                            <option key={order.id} value={order.id}>
                                Order #{order.id.slice(-6).toUpperCase()} ({new Date(order.date).toLocaleDateString()}) - ${order.total.toFixed(2)}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Comment</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    rows={3}
                    placeholder="Share your experience..."
                />
            </div>

            <button
                type="submit"
                disabled={submitting}
                className={`w-full py-2 rounded-lg font-bold text-white text-sm transition-all ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand-primary)] hover:brightness-110'
                    }`}
            >
                {submitting ? 'Submitting...' : 'Post Review'}
            </button>
        </form>
    );
};

export default ReviewForm;
