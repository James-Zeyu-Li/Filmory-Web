import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CompareView } from '../CompareView';

// Mock URL.createObjectURL since JSDOM doesn't support it natively
beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('CompareView', () => {
  it('renders empty state when no local images are dropped', async () => {
    render(<CompareView />);
    
    expect(screen.getByText('等待载入照片')).toBeInTheDocument();
    expect(screen.getByText(/请在上方分别放入需要对比的两张本地照片/)).toBeInTheDocument();
  });

  it('renders the dropzones correctly', async () => {
    render(<CompareView />);

    const dropzones = screen.getAllByText(/把照片拖到这里/);
    expect(dropzones.length).toBe(2);
  });

  it('expresses the selected comparison mode as a pressed segmented button', () => {
    render(<CompareView />);

    expect(screen.getByRole('group', { name: '对比方式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '滑尺对比' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '左右双列' })).toHaveAttribute('aria-pressed', 'false');
  });
});
