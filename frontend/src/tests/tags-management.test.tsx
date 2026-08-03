import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagsManagement } from '../views/Settings/TagsManagement';

const mocks = vi.hoisted(() => ({
  addTag: vi.fn(),
  deleteTag: vi.fn(),
  confirm: vi.fn(),
  notify: vi.fn(),
  requestImmediateSync: vi.fn(),
  tags: [] as Array<{ id: string; userId: string; name: string; color: string }>,
}));

vi.mock('../db/schema', () => ({
  db: { tagConfigs: { add: mocks.addTag } },
}));
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../contexts/useConfirm', () => ({ useConfirm: () => ({ confirm: mocks.confirm }) }));
vi.mock('../contexts/useFeedback', () => ({ useFeedback: () => ({ notify: mocks.notify }) }));
vi.mock('../contexts/useLanguage', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('../hooks/useData', () => ({ useTagConfigs: () => mocks.tags }));
vi.mock('../services/tagService', () => ({ deleteTagAndClearPhotoTags: mocks.deleteTag }));
vi.mock('../services/syncEvents', () => ({ requestImmediateSync: mocks.requestImmediateSync }));

describe('TagsManagement failure feedback', () => {
  beforeEach(() => {
    mocks.addTag.mockReset();
    mocks.deleteTag.mockReset();
    mocks.confirm.mockReset();
    mocks.notify.mockReset();
    mocks.requestImmediateSync.mockReset();
    mocks.tags.length = 0;
  });

  it('keeps the draft and shows a toast when creating a tag fails', async () => {
    mocks.addTag.mockRejectedValue(new Error('disk full'));
    render(<TagsManagement />);

    fireEvent.change(screen.getByPlaceholderText('如：人像 / 黑白 / 旅拍'), { target: { value: 'Portrait' } });
    fireEvent.click(screen.getByRole('button', { name: /创建标签/ }));

    await waitFor(() => {
      expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'settings.tagCreateFailedTitle',
        message: 'disk full',
      }));
    });
    expect(screen.getByDisplayValue('Portrait')).toBeInTheDocument();
  });

  it('shows a toast when deleting a tag fails', async () => {
    mocks.tags.push({ id: 'tag-1', userId: 'user-1', name: 'Portrait', color: '#3b82f6' });
    mocks.confirm.mockResolvedValue(true);
    mocks.deleteTag.mockRejectedValue(new Error('write failed'));
    render(<TagsManagement />);

    fireEvent.click(screen.getByTitle('删除标签'));

    await waitFor(() => {
      expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({
        type: 'error',
        title: 'settings.tagDeleteFailedTitle',
        message: 'write failed',
      }));
    });
    expect(screen.getByText('Portrait')).toBeInTheDocument();
  });
});
