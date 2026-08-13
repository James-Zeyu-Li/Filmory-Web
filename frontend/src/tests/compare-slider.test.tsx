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
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const { container } = render(<CompareView />);
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const image = new File(['image'], 'sample.jpg', { type: 'image/jpeg' });

    fireEvent.change(inputs[0], { target: { files: [image] } });
    fireEvent.change(inputs[1], { target: { files: [image] } });

    const slider = screen.getByRole('slider', { name: 'compare.splitPosition' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '55');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });
});
