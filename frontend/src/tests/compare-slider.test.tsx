import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompareView } from '../views/Compare/CompareView';

vi.mock('../contexts/useLanguage', () => ({
  useLanguage: () => ({
    t: (key: string, values?: Record<string, string>) => values?.target ? `${key} ${values.target}` : key,
  }),
}));

describe('photo comparison slider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the split position to keyboard users and supports fine adjustment', () => {
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:photo-a')
      .mockReturnValueOnce('blob:photo-b');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });

    const { container } = render(<CompareView />);
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const image = new File(['image'], 'sample.jpg', { type: 'image/jpeg' });

    fireEvent.change(inputs[0], { target: { files: [image] } });
    fireEvent.change(inputs[1], { target: { files: [image] } });

    expect(screen.getByAltText('compare.imageAlt A')).toHaveAttribute('src', 'blob:photo-a');
    expect(screen.getByAltText('compare.imageAlt B')).toHaveAttribute('src', 'blob:photo-b');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    const slider = screen.getByRole('slider', { name: 'compare.splitPosition' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '55');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    fireEvent.click(screen.getByRole('button', { name: 'compare.sideBySide' }));
    expect(document.querySelector('.compare-side-by-side')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('compare.clearPhoto A'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:photo-a');
    expect(screen.getByAltText('compare.previewAlt B')).toHaveAttribute('src', 'blob:photo-b');
  });
});
