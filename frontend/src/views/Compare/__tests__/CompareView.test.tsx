import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { CompareView } from '../CompareView';

// Mock URL.createObjectURL since JSDOM doesn't support it natively
beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('CompareView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no local images are dropped', async () => {
    const { container } = render(<CompareView />);
    
    expect(screen.getByText('等待载入照片')).toBeInTheDocument();
    expect(screen.getByText(/请在上方分别放入需要对比的两张本地照片/)).toBeInTheDocument();
    expect(container.querySelector('.premium-empty-state')).toBeInTheDocument();
  });

  it('renders the dropzones correctly', async () => {
    render(<CompareView />);

    const dropzones = screen.getAllByText(/把照片拖到这里/);
    expect(dropzones.length).toBe(2);
  });

  it('provides keyboard-focusable native file controls', async () => {
    const user = userEvent.setup();
    render(<CompareView />);

    const inputA = screen.getByLabelText('选择照片 A');
    const inputB = screen.getByLabelText('选择照片 B');

    expect(inputA).toHaveAttribute('type', 'file');
    expect(inputB).toHaveAttribute('type', 'file');
    await user.tab();
    expect(inputA).toHaveFocus();
  });

  it('announces invalid files without replacing either photo', () => {
    render(<CompareView />);

    const invalidFile = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('选择照片 A'), { target: { files: [invalidFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent('A 位置只能选择图片文件');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('announces image read failures and restores the affected uploader', () => {
    render(<CompareView />);

    const image = new File(['broken'], 'broken.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('选择照片 A'), { target: { files: [image] } });
    fireEvent.error(screen.getByAltText('预览 A'));

    expect(screen.getByRole('alert')).toHaveTextContent('无法读取 A 位置的照片');
    expect(screen.getByLabelText('选择照片 A')).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
  });

  it('expresses the selected comparison mode as a pressed segmented button', () => {
    render(<CompareView />);

    expect(screen.getByRole('group', { name: '对比方式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '滑尺对比' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '左右双列' })).toHaveAttribute('aria-pressed', 'false');
  });
});
