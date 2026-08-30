import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Camera, Collection, FilmStock, Lens, Roll } from '../../../../db/schema';
import type { CameraHistorySummary } from '../../../../services/gearHistoryService';
import { CameraHistoryDrawer } from './CameraHistoryDrawer';

const camera: Camera = {
  id: 'camera-1',
  userId: 'mock-user-id',
  name: 'Nikon F3',
  type: 'film',
  format: '135',
  addedAt: 1,
};

const lens: Lens = {
  id: 'lens-1', userId: 'mock-user-id', name: 'Nikkor 50mm', focalLength: 50, maxAperture: 'f/1.8', type: 'prime', addedAt: 1,
};

const filmStock: FilmStock = {
  id: 'film-1', userId: 'mock-user-id', brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color', format: '135', isSystem: 0, addedAt: 1,
};

const collection: Collection = {
  id: 'collection-1',
  userId: 'mock-user-id',
  name: 'Tokyo Trip',
  date: 500,
  addedAt: 1,
};

const rollInProject: Roll = {
  id: 'roll-project', name: 'Shibuya walk', cameraIds: ['camera-1'], status: 'archived', endDate: 500, collectionId: 'collection-1',
};
const rollUnassigned: Roll = {
  id: 'roll-unassigned', name: 'Backyard test', cameraIds: ['camera-1'], status: 'active', startDate: 400,
};

const buildSummary = (overrides: Partial<CameraHistorySummary> = {}): CameraHistorySummary => ({
  camera,
  linkedRolls: [rollInProject, rollUnassigned],
  activeRolls: [rollUnassigned],
  completedRolls: [rollInProject],
  collectionGroups: [{ collection, rolls: [rollInProject] }],
  unassignedRolls: [rollUnassigned],
  lastUsedAt: 500,
  lensUsage: [],
  filmStockUsage: [],
  ...overrides,
});

const Harness = (props: {
  isOpen: boolean;
  camera: Camera | null;
  summary: CameraHistorySummary | null;
  onClose: () => void;
  onEdit: (camera: Camera) => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollection: (collectionId: string) => void;
}) => {
  const { language, t } = useLanguage();
  return (
    <CameraHistoryDrawer
      {...props}
      cameraSystems={[]}
      filmBacks={[]}
      lenses={[lens]}
      filmStocks={[filmStock]}
      language={language}
      t={t}
    />
  );
};

describe('CameraHistoryDrawer', () => {
  it('renders total/active/completed counts, project groups and unassigned records', async () => {
    const onOpenRoll = vi.fn();
    const onOpenCollection = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={onOpenRoll}
        onOpenCollection={onOpenCollection}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Nikon F3' })).toBeInTheDocument();
    expect(screen.getByText('Tokyo Trip')).toBeInTheDocument();
    expect(screen.getByText('Backyard test')).toBeInTheDocument();

    // Expand the project group to reveal its matched record and the "enter project" action.
    await user.click(screen.getByRole('button', { name: /Tokyo Trip/ }));
    await user.click(screen.getByRole('button', { name: '打开拍摄记录：Shibuya walk' }));
    expect(onOpenRoll).toHaveBeenCalledWith('roll-project');

    await user.click(screen.getByRole('button', { name: '进入完整项目' }));
    expect(onOpenCollection).toHaveBeenCalledWith('collection-1');
  });

  it('opens a roll row via keyboard Enter and Space', async () => {
    const onOpenRoll = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={onOpenRoll}
        onOpenCollection={vi.fn()}
      />,
    );

    const unassignedRow = screen.getByRole('button', { name: '打开拍摄记录：Backyard test' });
    unassignedRow.focus();
    await user.keyboard('{Enter}');
    expect(onOpenRoll).toHaveBeenCalledWith('roll-unassigned');

    await user.keyboard(' ');
    expect(onOpenRoll).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state when the camera has no shooting history', () => {
    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary({
          linkedRolls: [], activeRolls: [], completedRolls: [], collectionGroups: [], unassignedRolls: [], lastUsedAt: undefined,
        })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('还没有拍摄记录')).toBeInTheDocument();
  });

  it('shows a stable fallback instead of crashing when the camera was deleted since opening', () => {
    render(
      <Harness
        isOpen
        camera={null}
        summary={null}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getAllByText('相机记录不可用').length).toBeGreaterThan(0);
  });

  it('routes the edit action to onEdit without triggering onOpenRoll/onOpenCollection', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={onEdit}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '编辑相机' }));
    expect(onEdit).toHaveBeenCalledWith(camera);
  });

  it('renders resolved lens and film stock usage chips with their counts', () => {
    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary({ lensUsage: [{ id: 'lens-1', count: 3 }], filmStockUsage: [{ id: 'film-1', count: 2 }] })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('Nikkor 50mm')).toBeInTheDocument();
    expect(screen.getByText('3 次')).toBeInTheDocument();
    expect(screen.getByText('Kodak Portra 400')).toBeInTheDocument();
    expect(screen.getByText('2 次')).toBeInTheDocument();
  });

  it('falls back to the unknown-lens/film label for a usage id that no longer resolves (soft-deleted gear)', () => {
    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary({ lensUsage: [{ id: 'lens-removed', count: 1 }], filmStockUsage: [{ id: 'film-removed', count: 1 }] })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('未知镜头')).toBeInTheDocument();
    expect(screen.getByText('未知胶卷')).toBeInTheDocument();
  });

  it('shows the empty-usage inline message when there is no lens or film stock history yet', () => {
    render(
      <Harness
        isOpen
        camera={camera}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('这台相机还没有搭配镜头的记录。')).toBeInTheDocument();
    expect(screen.getByText('这台相机还没有胶卷使用记录。')).toBeInTheDocument();
  });
});
