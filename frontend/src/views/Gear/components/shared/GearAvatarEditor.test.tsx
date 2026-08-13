import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GearAvatarEditor } from './GearAvatarEditor';

const t = (key: string) => ({
  'gear.coverTitle': '封面',
  'gear.coverCustom': '已上传封面',
  'gear.coverDefault': '尚未上传封面',
  'gear.previewCover': '点击预览大图',
  'gear.viewCover': '放大封面',
  'gear.uploadCover': '上传封面',
  'gear.changeCover': '更换封面',
  'gear.removeCover': '删除封面',
  'common.loading': '处理中',
}[key] || key) as never;

const defaultProps = {
  id: 'film-1',
  type: 'filmStocks' as const,
  label: 'Kodak Gold 200',
  placeholder: <span>Film placeholder</span>,
  uploading: false,
  t,
  onPreview: vi.fn(),
  onUpload: vi.fn(),
  onRemove: vi.fn(),
};

describe('GearAvatarEditor', () => {
  it('offers cover upload when no custom cover exists', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<GearAvatarEditor {...defaultProps} avatarUrl={null} onUpload={onUpload} />);

    await user.click(screen.getByRole('button', { name: '上传封面' }));

    expect(onUpload).toHaveBeenCalledWith('film-1', 'filmStocks');
    expect(screen.queryByRole('button', { name: '点击预览大图' })).not.toBeInTheDocument();
  });

  it('provides keyboard-accessible preview, replacement, and removal for an uploaded cover', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onUpload = vi.fn();
    const onRemove = vi.fn();
    render(<GearAvatarEditor {...defaultProps} avatarUrl="data:image/webp;base64,cover" onPreview={onPreview} onUpload={onUpload} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: '点击预览大图' }));
    await user.click(screen.getByRole('button', { name: '更换封面' }));
    await user.click(screen.getByRole('button', { name: '删除封面' }));

    expect(onPreview).toHaveBeenCalledWith('data:image/webp;base64,cover');
    expect(onUpload).toHaveBeenCalledWith('film-1', 'filmStocks');
    expect(onRemove).toHaveBeenCalledWith('film-1', 'filmStocks', 'Kodak Gold 200');
  });

  it('disables upload actions while processing a cover', () => {
    render(<GearAvatarEditor {...defaultProps} avatarUrl="data:image/webp;base64,cover" uploading />);

    expect(screen.getByRole('button', { name: '处理中' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '更换封面' })).toBeDisabled();
  });
});
