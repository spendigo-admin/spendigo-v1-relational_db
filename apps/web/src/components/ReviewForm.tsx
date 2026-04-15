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
            <div className="bg-gray-100 p-8 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                <p className="text-4xl mb-4 grayscale opacity-30">🔐</p>
                <p className="text-sm font-black text-gray-900 uppercase tracking-widest mb-3">Community Access Restricted</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mb-4">Please log in to share your voice with the community.</p>
                <button
                    onClick={() => navigate('/login')}
                    className="px-8 py-2.5 bg-gray-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95"
                >
                    Log In To Post
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border-2 border-gray-50 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-red-600 opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg m-0">Leave Your Mark</h3>
                <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 uppercase tracking-widest">Share Your Voice</span>
            </div>

            {error && <div className="mb-6 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">{error}</div>}

            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Rate Your Visit</label>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 inline-block">
                        <StarRating rating={rating} editable onChange={setRating} size="lg" />
                    </div>
                </div>

                {relevantOrders.length > 0 && (
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            🛒 Verify Purchase
                            <span className="text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-sm uppercase skew-x-[-12deg]">PRO STATUS</span>
                        </label>
                        <div className="relative">
                            <select
                                value={orderId}
                                onChange={(e) => setOrderId(e.target.value)}
                                className="w-full pl-4 pr-10 py-3.5 rounded-2xl border-2 border-gray-100 text-xs font-bold uppercase tracking-tight focus:ring-0 focus:border-red-600 outline-none bg-gray-50 appearance-none cursor-pointer transition-all"
                            >
                                <option value="">Optional Verification</option>
                                {relevantOrders.map(order => (
                                    <option key={order.id} value={order.id}>
                                        Order #{order.id.slice(-6).toUpperCase()}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-black text-sm">↓</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mb-8">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Your Feedback</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-6 rounded-3xl border-2 border-gray-100 text-sm font-medium focus:ring-0 focus:border-red-600 outline-none bg-gray-50 transition-all placeholder:text-gray-300 placeholder:italic"
                    rows={4}
                    placeholder="Tell the community how we did..."
                />
            </div>

            <button
                type="submit"
                disabled={submitting}
                className={`w-full py-4 rounded-2xl font-black text-white text-xs uppercase tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] ${submitting 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-black hover:shadow-2xl'
                    }`}
            >
                {submitting ? 'Transmitting Data...' : 'Broadcast Review'}
            </button>
        </form>
    );
};

export default ReviewForm;
