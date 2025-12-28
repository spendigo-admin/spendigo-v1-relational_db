import React, { useState } from 'react';
import { useReviews } from '../context/ReviewContext';
import { useAuth } from '../context/AuthContext';
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
    const navigate = useNavigate();

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

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
                // Note: authorName/avatar handled in context for security typically, but passed here if needed or handled by context
            });
            setRating(0);
            setComment('');
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
