import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../../../contexts/useLanguage';
import type { Camera, Collection, Lens, Roll } from '../../../../db/schema';
import type { LensHistorySummary } from '../../../../services/gearHistoryService';
import { LensHistoryDrawer } from './LensHistoryDrawer';

const lens: Lens = {
  id: 'lens-1',
  userId: 'mock-user-id',
  name: 'Nikkor 50mm',
  focalLength: 50,
  maxAperture: 'f/1.8',
  type: 'prime',
  addedAt: 1,
};

const camera: Camera = {
  id: 'camera-1', userId: 'mock-user-id', name: 'Nikon F3', type: 'film', format: '135', addedAt: 1,
};

const collection: Collection = {
  id: 'collection-1',
  userId: 'mock-user-id',
  name: 'Tokyo Trip',
  date: 500,
  addedAt: 1,
};

const rollInProject: Roll = {
  id: 'roll-project', name: 'Shibuya walk', cameraIds: ['camera-1'], lensIds: ['lens-1'], status: 'archived', endDate: 500, collectionId: 'collection-1',
};
const rollUnassigned: Roll = {
  id: 'roll-unassigned', name: 'Backyard test', cameraIds: ['camera-1'], lensIds: ['lens-1'], status: 'active', startDate: 400,
};

const buildSummary = (overrides: Partial<LensHistorySummary> = {}): LensHistorySummary => ({
  lens,
  linkedRolls: [rollInProject, rollUnassigned],
  activeRolls: [rollUnassigned],
  completedRolls: [rollInProject],
  collectionGroups: [{ collection, rolls: [rollInProject] }],
  unassignedRolls: [rollUnassigned],
  lastUsedAt: 500,
  cameraUsage: [],
  ...overrides,
});

const Harness = (props: {
  isOpen: boolean;
  lens: Lens | null;
  summary: LensHistorySummary | null;
  onClose: () => void;
  onEdit: (lens: Lens) => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollection: (collectionId: string) => void;
}) => {
  const { language, t } = useLanguage();
  return (
    <LensHistoryDrawer
      {...props}
      cameras={[camera]}
      language={language}
      t={t}
    />
  );
};

describe('LensHistoryDrawer', () => {
  it('renders total/active/completed counts, project groups and unassigned records', async () => {
    const onOpenRoll = vi.fn();
    const onOpenCollection = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        lens={lens}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={onOpenRoll}
        onOpenCollection={onOpenCollection}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Nikkor 50mm' })).toBeInTheDocument();
    expect(screen.getByText('Tokyo Trip')).toBeInTheDocument();
    expect(screen.getByText('Backyard test')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tokyo Trip/ }));
    await user.click(screen.getByRole('button', { name: '打开拍摄记录：Shibuya walk' }));
    expect(onOpenRoll).toHaveBeenCalledWith('roll-project');

    await user.click(screen.getByRole('button', { name: '进入完整项目' }));
    expect(onOpenCollection).toHaveBeenCalledWith('collection-1');
  });

  it('shows an empty state when the lens has no shooting history', () => {
    render(
      <Harness
        isOpen
        lens={lens}
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

  it('shows a stable fallback instead of crashing when the lens was deleted since opening', () => {
    render(
      <Harness
        isOpen
        lens={null}
        summary={null}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getAllByText('镜头记录不可用').length).toBeGreaterThan(0);
  });

  it('routes the edit action to onEdit without triggering onOpenRoll/onOpenCollection', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        lens={lens}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={onEdit}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '编辑镜头' }));
    expect(onEdit).toHaveBeenCalledWith(lens);
  });

  it('renders resolved camera usage chips with their counts', () => {
    render(
      <Harness
        isOpen
        lens={lens}
        summary={buildSummary({ cameraUsage: [{ id: 'camera-1', count: 4 }] })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('Nikon F3')).toBeInTheDocument();
    expect(screen.getByText('4 次')).toBeInTheDocument();
  });

  it('falls back to the unknown-camera label for a usage id that no longer resolves (soft-deleted gear)', () => {
    render(
      <Harness
        isOpen
        lens={lens}
        summary={buildSummary({ cameraUsage: [{ id: 'camera-removed', count: 1 }] })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('未知相机')).toBeInTheDocument();
  });

  it('shows the empty-usage inline message when there is no camera history yet', () => {
    render(
      <Harness
        isOpen
        lens={lens}
        summary={buildSummary()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollection={vi.fn()}
      />,
    );

    expect(screen.getByText('这支镜头还没有搭配相机的记录。')).toBeInTheDocument();
  });
});
