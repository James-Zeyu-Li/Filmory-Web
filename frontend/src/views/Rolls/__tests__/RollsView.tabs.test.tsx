import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { RollsView } from '../RollsView';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { FeedbackProvider } from '../../../contexts/FeedbackContext';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { db } from '../../../db/schema';

const storage = new Map<string, string>();

const renderRollsView = (enableFilmMode = true) => render(
  <MemoryRouter>
    <ConfirmProvider>
      <FeedbackProvider>
        <CurrencyProvider>
          <RollsView enableFilmMode={enableFilmMode} />
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

    const tabButtons = screen.getAllByRole('button', { name: /^(全部拍摄记录|项目集|独立记录)$/ });
    expect(tabButtons.map(button => button.textContent)).toEqual(['全部拍摄记录', '项目集', '独立记录']);
    expect(screen.getByText('查看全部拍摄记录；项目集仅用于整理相关记录，不归入项目也能正常管理。')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: '独立记录' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '独立记录' })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: '新建拍摄记录' }).length).toBeGreaterThan(1);
  });

  it('shows both New collection and New roll CTAs in empty Collections', async () => {
    renderRollsView();

    fireEvent.click(screen.getByRole('button', { name: '项目集' }));

    await waitFor(() => {
      expect(screen.getByText('暂无项目集')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: '新建项目集' }).length).toBeGreaterThan(1);
    expect(screen.getAllByRole('button', { name: '新建拍摄记录' }).length).toBeGreaterThan(1);
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
