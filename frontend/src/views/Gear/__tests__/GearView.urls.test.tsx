import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { GearView } from '../GearView';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { FeedbackProvider } from '../../../contexts/FeedbackContext';
import { CurrencyProvider } from '../../../contexts/CurrencyContext';
import { db } from '../../../db/schema';

const storage = new Map<string, string>();
const OTHER_USER_ID = 'other-user-id';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location-probe">{`${location.pathname}${location.search}`}</output>;
};

const renderGearView = (initialEntry = '/gear?tab=cameras', enableFilmMode = true) => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <ConfirmProvider>
      <FeedbackProvider>
        <CurrencyProvider>
          <GearView enableFilmMode={enableFilmMode} />
          <LocationProbe />
        </CurrencyProvider>
      </FeedbackProvider>
    </ConfirmProvider>
  </MemoryRouter>,
);

const addCamera = (overrides: Partial<Parameters<typeof db.cameras.add>[0]> = {}) => db.cameras.add({
  name: 'Minolta X-700',
  type: 'film',
  format: '135',
  addedAt: Date.now(),
  userId: 'mock-user-id',
  ...overrides,
});

const addLens = (overrides: Partial<Parameters<typeof db.lenses.add>[0]> = {}) => db.lenses.add({
  name: 'MD 50mm f/1.7',
  focalLength: 50,
  maxAperture: 'f/1.7',
  type: 'prime',
  addedAt: Date.now(),
  userId: 'mock-user-id',
  ...overrides,
});

const addFilmStock = (overrides: Partial<Parameters<typeof db.filmStocks.add>[0]> = {}) => db.filmStocks.add({
  brand: 'Kodak',
  name: 'Gold 200',
  iso: 200,
  colorType: 'color',
  format: '135',
  isSystem: 0,
  addedAt: Date.now(),
  userId: 'mock-user-id',
  ...overrides,
});

const addEquipment = (overrides: Partial<Parameters<typeof db.otherEquipments.add>[0]> = {}) => db.otherEquipments.add({
  name: 'Kodak D-76',
  type: 'chemical',
  addedAt: Date.now(),
  userId: 'mock-user-id',
  ...overrides,
});

describe('GearView edit modal URL contract', () => {
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

    await db.cameras.clear();
    await db.lenses.clear();
    await db.filmStocks.clear();
    await db.otherEquipments.clear();
    await db.syncQueue.clear();
  });

  it('opens the camera edit modal from a deep link', async () => {
    const cameraId = await addCamera();
    renderGearView(`/gear?tab=cameras&edit=${cameraId}`);
    await screen.findByRole('heading', { name: '编辑相机' });
  });

  it('opens the lens edit modal from a deep link', async () => {
    const lensId = await addLens();
    renderGearView(`/gear?tab=lenses&edit=${lensId}`);
    await screen.findByRole('heading', { name: '编辑镜头' });
  });

  it('opens the film stock edit modal from a deep link', async () => {
    const filmId = await addFilmStock();
    renderGearView(`/gear?tab=filmStocks&edit=${filmId}`);
    await screen.findByRole('heading', { name: '编辑胶卷库存' });
  });

  it('opens the other-equipment edit modal from a deep link', async () => {
    const equipmentId = await addEquipment();
    renderGearView(`/gear?tab=otherEquipments&edit=${equipmentId}`);
    await screen.findByRole('heading', { name: '编辑器材' });
  });

  it('does not open a modal when the edit id belongs to a different tab', async () => {
    const cameraId = await addCamera();
    renderGearView(`/gear?tab=lenses&edit=${cameraId}`);

    await screen.findByRole('heading', { name: '镜头' });
    expect(screen.queryByRole('heading', { name: '编辑相机' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '编辑镜头' })).not.toBeInTheDocument();
  });

  it('does not open a modal for a nonexistent id', async () => {
    renderGearView('/gear?tab=cameras&edit=00000000-0000-0000-0000-000000000000');

    await screen.findByRole('heading', { name: '相机设备' });
    expect(screen.queryByRole('heading', { name: '编辑相机' })).not.toBeInTheDocument();
  });

  it('does not open a modal for another user\'s record even if the id is guessed', async () => {
    const otherCameraId = await addCamera({ userId: OTHER_USER_ID });
    renderGearView(`/gear?tab=cameras&edit=${otherCameraId}`);

    await screen.findByRole('heading', { name: '相机设备' });
    expect(screen.queryByRole('heading', { name: '编辑相机' })).not.toBeInTheDocument();
  });

  it('updates the URL when opening from the list, and a fresh mount of that exact URL (simulating a refresh) restores the same modal', async () => {
    const user = userEvent.setup();
    const lensId = await addLens();
    const firstRender = renderGearView('/gear?tab=lenses');

    await screen.findByText('MD 50mm f/1.7');
    await user.click(screen.getByTitle('编辑镜头'));
    await screen.findByRole('heading', { name: '编辑镜头' });
    let producedUrl = '';
    await waitFor(() => {
      producedUrl = screen.getByTestId('location-probe').textContent ?? '';
      expect(producedUrl).toBe(`/gear?tab=lenses&edit=${lensId}`);
    });

    // A real refresh discards the whole page (and its history-state markers),
    // so unmount before mounting a brand new tree at that exact URL — a
    // second overlapping instance without unmounting the first wouldn't prove
    // anything about a fresh mount recovering the state from the URL alone.
    firstRender.unmount();
    renderGearView(producedUrl);
    await screen.findByRole('heading', { name: '编辑镜头' });
  });

  it('closing (Cancel) an edit opened from the list returns to that list URL without an edit param', async () => {
    const user = userEvent.setup();
    const equipmentId = await addEquipment();
    renderGearView('/gear?tab=otherEquipments');

    await user.click(await screen.findByRole('button', { name: '编辑器材: Kodak D-76' }));
    await screen.findByRole('heading', { name: '编辑器材' });
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(`/gear?tab=otherEquipments&edit=${equipmentId}`);
    });

    await user.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '编辑器材' })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/gear?tab=otherEquipments');
    expect(screen.getByTestId('location-probe')).not.toHaveTextContent('edit=');
  });

  it('canonicalizes a tab value outside the known set (unlike a missing tab, this also clears edit)', async () => {
    const cameraId = await addCamera();
    renderGearView(`/gear?tab=not-a-real-tab&edit=${cameraId}`);

    await screen.findByRole('heading', { name: '相机设备' });
    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      expect(probe).toContain('tab=cameras');
      expect(probe).not.toContain('edit=');
    });
    expect(screen.queryByRole('heading', { name: '编辑相机' })).not.toBeInTheDocument();
  });

  it('closing without a list-origin marker replaces the URL back to the canonical tab (no edit param)', async () => {
    const user = userEvent.setup();
    const filmId = await addFilmStock();
    renderGearView(`/gear?tab=filmStocks&edit=${filmId}`);

    await screen.findByRole('heading', { name: '编辑胶卷库存' });
    await user.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '编辑胶卷库存' })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/gear?tab=filmStocks');
    expect(screen.getByTestId('location-probe')).not.toHaveTextContent('edit=');
  });

  it('switching tabs while an edit modal is open clears the edit param and updates tab', async () => {
    const user = userEvent.setup();
    const equipmentId = await addEquipment();
    renderGearView(`/gear?tab=otherEquipments&edit=${equipmentId}`);

    await screen.findByRole('heading', { name: '编辑器材' });
    await user.click(screen.getByRole('tab', { name: /相机库/ }));

    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      expect(probe).toContain('tab=cameras');
      expect(probe).not.toContain('edit=');
    });
    expect(screen.queryByRole('heading', { name: '编辑器材' })).not.toBeInTheDocument();
  });

  it('canonicalizes a bare edit param without a tab to the currently active tab', async () => {
    const cameraId = await addCamera();
    storage.set('grainfolio_gear_sub_tab', 'cameras');
    renderGearView(`/gear?edit=${cameraId}`);

    await screen.findByRole('heading', { name: '编辑相机' });
    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      expect(probe).toContain('tab=cameras');
      expect(probe).toContain(`edit=${cameraId}`);
    });
  });

  it('switching tabs always replaces the URL, even with no edit modal open', async () => {
    const user = userEvent.setup();
    renderGearView('/gear?tab=cameras');

    await screen.findByRole('heading', { name: '相机设备' });
    await user.click(screen.getByRole('tab', { name: /镜头库/ }));

    await screen.findByRole('heading', { name: '镜头' });
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/gear?tab=lenses');
    });
  });

  it('canonicalizes a tab that is hidden by enableFilmMode and drops its edit param', async () => {
    const filmId = await addFilmStock();
    renderGearView(`/gear?tab=filmStocks&edit=${filmId}`, false);

    await screen.findByRole('heading', { name: '相机设备' });
    await waitFor(() => {
      const probe = screen.getByTestId('location-probe').textContent ?? '';
      expect(probe).toContain('tab=cameras');
      expect(probe).not.toContain('edit=');
    });
    expect(screen.queryByRole('heading', { name: '编辑胶卷库存' })).not.toBeInTheDocument();
  });
});
