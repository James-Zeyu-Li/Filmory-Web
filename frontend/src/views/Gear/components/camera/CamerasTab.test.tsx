import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Camera } from '../../../../db/schema';
import { CamerasTab } from './CamerasTab';

const camera: Camera = {
  id: 'camera-1', userId: 'mock-user-id', name: 'Nikon F3', type: 'film', format: '135', addedAt: 1,
};

const Harness = (props: {
  onView: (camera: Camera) => void;
  onEdit: (camera: Camera) => void;
  onDelete: (id: string) => void;
  onArchive: (camera: Camera) => void;
}) => {
  const { t } = useLanguage();
  return (
    <CamerasTab
      cameras={[camera]}
      cameraSystems={[]}
      filmBacks={[]}
      searchQuery=""
      sortBy="date"
      t={t}
      uploadingEntityId={null}
      onAdd={vi.fn()}
      onUpload={vi.fn()}
      onPreview={vi.fn()}
      {...props}
    />
  );
};

describe('CamerasTab', () => {
  it('opens the camera history view by default when the card is clicked', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} onArchive={vi.fn()} />);

    await user.click(screen.getByRole('heading', { name: 'Nikon F3' }));
    expect(onView).toHaveBeenCalledWith(camera);
  });

  it('opens history via the invisible full-card action button', async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} onArchive={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '查看履历：Nikon F3' }));
    expect(onView).toHaveBeenCalledWith(camera);
  });

  it('routes edit/archive/delete icon clicks to their own handlers without opening history', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onView={onView} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} />);

    await user.click(screen.getByRole('button', { name: '编辑相机' }));
    await user.click(screen.getByRole('button', { name: '售出/归档' }));
    await user.click(screen.getByRole('button', { name: '彻底删除' }));

    expect(onEdit).toHaveBeenCalledWith(camera);
    expect(onArchive).toHaveBeenCalledWith(camera);
    expect(onDelete).toHaveBeenCalledWith('camera-1');
    expect(onView).not.toHaveBeenCalled();
  });
});
