import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { CompareView } from '../CompareView';

// Mock URL.createObjectURL since JSDOM doesn't support it natively
beforeAll(() => {
  global.URL.createObjectURL = vi.fn(() => 'mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

describe('CompareView (纯本地极速对比)', () => {
  it('renders empty state when no local images are dropped', async () => {
    render(<CompareView />);
    
    // 应当显示空状态
    expect(screen.getByText('等待载入对比图')).toBeInTheDocument();
    expect(screen.getByText(/请在上方分别放入需要对比的两张本地照片/)).toBeInTheDocument();
  });

  it('renders the dropzones correctly', async () => {
    render(<CompareView />);

    // 应该有两个 dropzone (A路 和 B路)
    const dropzones = screen.getAllByText(/拖拽本地原图到此处/);
    expect(dropzones.length).toBe(2);
  });
});
