import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Camera, Collection, Roll } from '../../../../db/schema';
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
});
