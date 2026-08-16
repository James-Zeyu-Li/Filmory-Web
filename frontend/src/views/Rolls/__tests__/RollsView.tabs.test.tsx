import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { RollsView } from '../RollsView';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { FeedbackProvider } from '../../../contexts/FeedbackContext';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { db } from '../../../db/schema';

const storage = new Map<string, string>();

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-probe">{`${location.pathname}${location.search}`}</output>;
};

const renderRollsView = (enableFilmMode = true, initialEntry = '/rolls') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <ConfirmProvider>
      <FeedbackProvider>
        <CurrencyProvider>
          <RollsView enableFilmMode={enableFilmMode} />
          <LocationProbe />
        </CurrencyProvider>
      </FeedbackProvider>
    </ConfirmProvider>
  </MemoryRouter>
);

describe('RollsView tabs and empty states', () => {
  beforeEach(async () => {
    storage.clear();

    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'grainfolio_user_id') return 'mock-user-id';
      return storage.get(key) ?? null;
    });
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });

    await db.collections.clear();
    await db.rolls.clear();
    await db.cameras.clear();
    await db.filmStocks.clear();
    await db.photoAssets.clear();
    await db.userProfiles.clear();
    await db.syncQueue.clear();
  });

  it('opens All shooting records by default and shows a centered New record CTA when empty', async () => {
    renderRollsView();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '全部拍摄记录' })).toBeInTheDocument();
    });

    const tabButtons = screen.getAllByRole('tab', { name: /^(全部拍摄记录|项目集|独立记录)$/ });
    expect(tabButtons.map(button => button.getAttribute('aria-label'))).toEqual(['全部拍摄记录', '项目集', '独立记录']);
    expect(screen.getByText('所有拍摄记录都在这里。')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '新建拍摄记录' }).length).toBeGreaterThan(1);
  });

  it('keeps the saved roll tab on reload when it is still visible', async () => {
    storage.set('grainfolio_rolls_library_view', 'loose');

    renderRollsView();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '独立记录' })).toBeInTheDocument();
    });

    expect(screen.getByText('尚未归入项目的独立拍摄记录；它们与项目内记录同样完整。')).toBeInTheDocument();
  });

  it('shows the same centered New record CTA in Independent records when empty', async () => {
    renderRollsView();

    fireEvent.click(screen.getByRole('tab', { name: '独立记录' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '独立记录' })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: '新建拍摄记录' }).length).toBeGreaterThan(1);
  });

  it('shows a New collection header action and a New record empty-state action in empty Collections', async () => {
    renderRollsView();

    fireEvent.click(screen.getByRole('tab', { name: '项目集' }));

    await waitFor(() => {
      expect(screen.getByText('暂无项目集')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: '新建项目集' }).length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: '新建拍摄记录' })).toBeInTheDocument();
  });

  it('switches the header primary action from a new shooting record to a new collection', async () => {
    const user = userEvent.setup();

    renderRollsView();
    const headerNewShoot = screen.getAllByRole('button', { name: '新建拍摄记录' })
      .find(button => button.closest('.rolls-view-header-actions'));
    expect(headerNewShoot).toHaveClass('primary');

    await user.click(screen.getByRole('tab', { name: '项目集' }));
    const headerNewCollection = screen.getAllByRole('button', { name: '新建项目集' })
      .find(button => button.closest('.rolls-view-header-actions'));
    expect(headerNewCollection).toHaveClass('primary');

    await user.click(headerNewCollection!);
    expect(await screen.findByRole('heading', { name: '新建项目集' })).toBeInTheDocument();
  });

  it('shows both record actions in an empty collection and opens their existing flows', async () => {
    const user = userEvent.setup();

    await db.collections.add({
      id: 'collection-empty', userId: 'mock-user-id', name: '东京散步', date: Date.now(), addedAt: Date.now(),
    });

    renderRollsView();
    await user.click(screen.getByRole('tab', { name: '项目集' }));
    await user.click(await screen.findByRole('button', { name: '东京散步 (0 卷)' }));

    const emptyState = await screen.findByText('暂无拍摄记录');
    const emptyStateActions = within(emptyState.closest('.premium-empty-state')!);

    await user.click(emptyStateActions.getByRole('button', { name: '从已有记录中添加' }));
    expect(await screen.findByRole('heading', { name: '从已有记录中添加' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(emptyStateActions.getByRole('button', { name: '新建拍摄记录' }));
    expect(await screen.findByRole('heading', { name: '新建拍摄记录' })).toBeInTheDocument();
  });

  it('assigns a new shooting record from a collection detail to that collection', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.collections.add({
      id: 'collection-context', userId: 'mock-user-id', name: '海边周末', date: now, addedAt: now,
    });
    await db.cameras.add({
      id: 'collection-camera', userId: 'mock-user-id', name: 'Nikon F3', type: 'film', format: '135', addedAt: now,
    });
    await db.userProfiles.add({
      id: 'mock-user-id', userId: 'mock-user-id', tier: 'regular', highResQuotaUsed: 0,
    });

    renderRollsView(false);
    await user.click(screen.getByRole('tab', { name: '项目集' }));
    await user.click(await screen.findByRole('button', { name: '海边周末 (0 卷)' }));

    const emptyState = await screen.findByText('暂无拍摄记录');
    await user.click(within(emptyState.closest('.premium-empty-state')!).getByRole('button', { name: '新建拍摄记录' }));
    await user.type(screen.getByLabelText('记录名称'), '海边第一卷');
    await user.click(screen.getByRole('button', { name: 'Nikon F3' }));
    const startLogging = await screen.findByRole('button', { name: '开始记录' });
    expect(startLogging).toBeEnabled();
    await user.click(startLogging);

    await waitFor(async () => {
      const roll = await db.rolls.where('name').equals('海边第一卷').first();
      expect(roll?.collectionId).toBe('collection-context');
    });
  });

  it('creates a standalone shooting record from the Collections overview', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.cameras.add({
      id: 'overview-camera', userId: 'mock-user-id', name: 'Leica M6', type: 'film', format: '135', addedAt: now,
    });
    await db.userProfiles.add({
      id: 'mock-user-id', userId: 'mock-user-id', tier: 'regular', highResQuotaUsed: 0,
    });

    renderRollsView(false);
    await user.click(screen.getByRole('tab', { name: '项目集' }));
    await user.click(await screen.findByRole('button', { name: '新建拍摄记录' }));
    await user.type(screen.getByLabelText('记录名称'), '独立记录');
    await user.click(screen.getByRole('button', { name: 'Leica M6' }));
    await user.click(await screen.findByRole('button', { name: '开始记录' }));

    await waitFor(async () => {
      const roll = await db.rolls.where('name').equals('独立记录').first();
      expect(roll?.collectionId).toBeUndefined();
    });
  });

  it('hides Collections and Independent records when Collections is turned off', async () => {
    storage.set('grainfolio_rolls_collections_tab_enabled', 'false');

    renderRollsView();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '全部拍摄记录' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: '项目集' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '独立记录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建项目集' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '新建拍摄记录' }).length).toBeGreaterThan(1);
  });

  it('lets users rename an existing shooting record from the drawer', async () => {
    const user = userEvent.setup();

    await db.cameras.add({
      id: 'camera-1',
      userId: 'mock-user-id',
      name: 'Leica M6',
      type: 'film',
      format: '135',
      addedAt: Date.now(),
    });

    await db.rolls.add({
      id: 'roll-1',
      userId: 'mock-user-id',
      name: '旧名称',
      cameraIds: ['camera-1'],
      filmStockId: 'film-stock-1',
      startDate: Date.now(),
      status: 'active',
    });

    renderRollsView(false);

    await user.click(await screen.findByText('旧名称'));

    const nameInput = await screen.findByDisplayValue('旧名称');
    await user.clear(nameInput);
    await user.type(nameInput, '东京街拍');
    await user.click(screen.getByRole('button', { name: '保存全部更改' }));

    await waitFor(async () => {
      expect((await db.rolls.get('roll-1'))?.name).toBe('东京街拍');
    });
  });

  it('keeps cover upload separate from the shooting record details action', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.cameras.add({
      id: 'camera-cover', userId: 'mock-user-id', name: 'Nikon F3', type: 'film', format: '135', addedAt: now,
    });
    await db.rolls.add({
      id: 'roll-cover', userId: 'mock-user-id', name: 'Cover test',
      currentCameraId: 'camera-cover', cameraIds: ['camera-cover'], status: 'active', startDate: now,
    });

    renderRollsView(false);

    const coverAction = await screen.findByRole('button', { name: '上传封面: Cover test' });
    expect(coverAction).toHaveClass('roll-card-cover-action');
    expect(screen.getByRole('button', { name: '打开拍摄记录：Cover test' })).toHaveClass('record-card-open-action');

    await user.click(coverAction);
    expect(screen.queryByRole('heading', { name: 'Cover test', level: 2 })).not.toBeInTheDocument();
  });

  it('opens a full cover preview from the shooting record drawer', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.rolls.add({
      id: 'roll-cover-preview', userId: 'mock-user-id', name: 'Rainy afternoon',
      cameraIds: [], coverPhotoId: 'cover-photo-1', status: 'active', startDate: now,
    });
    await db.photoAssets.add({
      id: 'cover-photo-1', rollId: 'roll-cover-preview', originalFileName: 'rain.jpg', fileSize: 1,
      previewUrl: 'https://example.test/rain.jpg', addedAt: now, isPinned: 1, userId: 'mock-user-id',
    });

    renderRollsView(false);
    await user.click(await screen.findByText('Rainy afternoon'));
    await user.click(await screen.findByText('查看封面'));

    expect(await screen.findByRole('img', { name: 'Rainy afternoon' })).toHaveAttribute('src', 'https://example.test/rain.jpg');
  });

  it('keeps the opened shooting record in the URL and closes back to the list', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.rolls.add({
      id: 'roll-url', userId: 'mock-user-id', name: 'URL record',
      cameraIds: [], status: 'active', startDate: now,
    });

    renderRollsView(false);
    await user.click(await screen.findByText('URL record'));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/rolls?tab=all&openRoll=roll-url');
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'URL record', level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/rolls');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('resolves a direct roll link after local data is available and rejects another user record', async () => {
    const now = Date.now();
    await db.rolls.bulkAdd([
      { id: 'roll-direct', userId: 'mock-user-id', name: 'Direct record', cameraIds: [], status: 'active', startDate: now },
      { id: 'roll-other-user', userId: 'other-user-id', name: 'Private record', cameraIds: [], status: 'active', startDate: now },
    ]);

    renderRollsView(false, '/rolls?openRoll=roll-direct');
    const directDialog = await screen.findByRole('dialog');
    expect(within(directDialog).getByRole('heading', { name: 'Direct record', level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/rolls?openRoll=roll-direct&tab=all');

    await userEvent.setup().click(screen.getByRole('button', { name: '取消' }));
    cleanup();
    renderRollsView(false, '/rolls?tab=all&openRoll=roll-other-user');
    expect(await screen.findByRole('heading', { name: '拍摄记录暂不可用' })).toBeInTheDocument();
    expect(screen.queryByText('Private record')).not.toBeInTheDocument();
  });

  it('records a confirmed camera transfer and updates the current camera', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    await db.cameras.bulkAdd([
      { id: 'camera-a', userId: 'mock-user-id', name: 'Leica M6', type: 'film', format: '135', addedAt: now },
      { id: 'camera-b', userId: 'mock-user-id', name: 'Nikon F3', type: 'film', format: '135', addedAt: now },
    ]);
    await db.rolls.add({
      id: 'roll-transfer', userId: 'mock-user-id', name: 'Weekend walk',
      currentCameraId: 'camera-a', cameraIds: ['camera-a'], status: 'active', startDate: now,
    });

    renderRollsView(false);
    await user.click(await screen.findByText('Weekend walk'));
    expect(screen.queryByRole('button', { name: '更换拍摄机身' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '展开' }));
    await user.click(screen.getByRole('button', { name: '更换拍摄机身' }));
    await user.selectOptions(screen.getByLabelText('接手机身'), 'camera-b');

    const confirmButton = screen.getByRole('button', { name: '确认更换机身' });
    expect(confirmButton).toBeDisabled();
    await user.click(screen.getByLabelText('我确认这卷胶片已安全转移，且不会同时装载在两台机身中。'));
    await user.click(confirmButton);

    await waitFor(async () => {
      expect(await db.rolls.get('roll-transfer')).toMatchObject({
        currentCameraId: 'camera-b',
        cameraIds: ['camera-a', 'camera-b'],
        cameraTransfers: [expect.objectContaining({ fromCameraId: 'camera-a', toCameraId: 'camera-b' })],
      });
    });
  });
});
