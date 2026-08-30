import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './StarRating';

const getStarLabel = (value: number) => `Rate ${value} stars`;

describe('StarRating', () => {
  it('fills stars up to the current rating', () => {
    render(<StarRating rating={3} onChange={vi.fn()} groupLabel="Rate this photo" getStarLabel={getStarLabel} />);

    const filled = screen.getByRole('button', { name: 'Rate 3 stars' });
    expect(filled).toHaveAttribute('aria-pressed', 'true');
    const unfilled = screen.getByRole('button', { name: 'Rate 4 stars' });
    expect(unfilled).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets the rating when a star is clicked', () => {
    const onChange = vi.fn();
    render(<StarRating rating={undefined} onChange={onChange} groupLabel="Rate this photo" getStarLabel={getStarLabel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clears the rating when the currently-set top star is clicked again', () => {
    const onChange = vi.fn();
    render(<StarRating rating={4} onChange={onChange} groupLabel="Rate this photo" getStarLabel={getStarLabel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not propagate the click to an ancestor click handler', () => {
    const onChange = vi.fn();
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <StarRating rating={undefined} onChange={onChange} groupLabel="Rate this photo" getStarLabel={getStarLabel} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rate 2 stars' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
