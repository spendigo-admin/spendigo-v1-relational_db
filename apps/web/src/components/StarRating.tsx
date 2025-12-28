import React from 'react';

interface StarRatingProps {
    rating: number; // 0-5
    editable?: boolean;
    onChange?: (rating: number) => void;
    size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({ rating, editable = false, onChange, size = 'md' }) => {
    const [hoverRating, setHoverRating] = React.useState(0);

    const handleClick = (index: number) => {
        if (editable && onChange) {
            onChange(index);
        }
    };

    const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

    return (
        <div className={`flex gap-1 ${sizeClass}`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    className={`cursor-${editable ? 'pointer' : 'default'} transition-colors ${(hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                    onClick={() => handleClick(star)}
                    onMouseEnter={() => editable && setHoverRating(star)}
                    onMouseLeave={() => editable && setHoverRating(0)}
                >
                    ★
                </span>
            ))}
        </div>
    );
};

export default StarRating;
