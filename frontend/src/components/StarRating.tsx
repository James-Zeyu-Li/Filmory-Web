import React from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

interface StarRatingProps {
  rating?: number;
  onChange: (rating: number | undefined) => void;
  size?: number;
  groupLabel: string;
  getStarLabel: (value: number) => string;
}

const STAR_VALUES = [1, 2, 3, 4, 5];

/** Click a star to set that rating; click the currently-set top star again to clear it. */
export const StarRating: React.FC<StarRatingProps> = ({ rating, onChange, size = 18, groupLabel, getStarLabel }) => (
  <div className="star-rating" role="group" aria-label={groupLabel}>
    {STAR_VALUES.map(value => (
      <button
        key={value}
        type="button"
        className="star-rating-button"
        onClick={(event) => {
          event.stopPropagation();
          onChange(rating === value ? undefined : value);
        }}
        aria-label={getStarLabel(value)}
        aria-pressed={(rating ?? 0) >= value}
      >
        <Star
          size={size}
          fill={(rating ?? 0) >= value ? 'var(--accent)' : 'none'}
          color={(rating ?? 0) >= value ? 'var(--accent)' : 'var(--text-muted)'}
        />
      </button>
    ))}
  </div>
);
