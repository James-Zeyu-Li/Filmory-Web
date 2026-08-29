import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLanguage } from '../../contexts/useLanguage';
import type { Collection, FilmStock, Roll } from '../../db/schema';
import type { FilmUsageSummary } from '../../services/filmInsightsService';
import { FilmUsageDetailDrawer } from './FilmUsageDetailDrawer';

const film: FilmStock = {
  id: 'film-1', userId: 'mock-user-id', brand: 'Kodak', name: 'Portra 400', iso: 400, colorType: 'color', format: '135', isSystem: 0, stockCount: 3, addedAt: 1,
};

const collection: Collection = {
  id: 'collection-1', userId: 'mock-user-id', name: 'Spring Rolls', date: 500, addedAt: 1,
};

const rollInProject: Roll = {
  id: 'roll-project', name: 'Cherry blossoms', cameraIds: [], filmStockId: 'film-1', status: 'archived', endDate: 500, collectionId: 'collection-1',
};
const rollUnassigned: Roll = {
  id: 'roll-unassigned', name: 'Test frame', cameraIds: [], filmStockId: 'film-1', status: 'active', startDate: 400,
};

const buildSummary = (overrides: Partial<FilmUsageSummary> = {}): FilmUsageSummary => ({
  film,
  activeRolls: [rollUnassigned],
  completedRolls: [rollInProject],
  collectionGroups: [{ collection, rolls: [rollInProject] }],
  unassignedRolls: [rollUnassigned],
  lastUsedAt: 500,
  ...overrides,
});

const Harness = (props: {
  isOpen: boolean;
  summary: FilmUsageSummary | null;
  onClose: () => void;
  onOpenRoll: (rollId: string) => void;
  onOpenCollections: () => void;
  onCreateRoll: () => void;
}) => {
  const { language, t } = useLanguage();
  return <FilmUsageDetailDrawer {...props} language={language} t={t} />;
};

describe('FilmUsageDetailDrawer', () => {
  it('renders active/history sections plus the involved-projects and unassigned groups', async () => {
    const onOpenRoll = vi.fn();
    const onOpenCollections = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        summary={buildSummary()}
        onClose={vi.fn()}
        onOpenRoll={onOpenRoll}
        onOpenCollections={onOpenCollections}
        onCreateRoll={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Kodak Portra 400' })).toBeInTheDocument();
    expect(screen.getByText('涉及项目')).toBeInTheDocument();
    expect(screen.getByText('Spring Rolls')).toBeInTheDocument();
    expect(screen.getByText('未归入项目')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Spring Rolls/ }));
    const projectSection = screen.getByText('涉及项目').closest('section')!;
    await user.click(within(projectSection).getByRole('button', { name: '打开拍摄记录：Cherry blossoms' }));
    expect(onOpenRoll).toHaveBeenCalledWith('roll-project');

    await user.click(screen.getByRole('button', { name: '进入完整项目' }));
    expect(onOpenCollections).toHaveBeenCalledTimes(1);
  });

  it('opens a roll row via keyboard Enter and Space', async () => {
    const onOpenRoll = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        summary={buildSummary()}
        onClose={vi.fn()}
        onOpenRoll={onOpenRoll}
        onOpenCollections={vi.fn()}
        onCreateRoll={vi.fn()}
      />,
    );

    const unassignedSection = screen.getByText('未归入项目').closest('section')!;
    const row = within(unassignedSection).getByRole('button', { name: '打开拍摄记录：Test frame' });
    row.focus();
    await user.keyboard('{Enter}');
    expect(onOpenRoll).toHaveBeenCalledWith('roll-unassigned');

    await user.keyboard(' ');
    expect(onOpenRoll).toHaveBeenCalledTimes(2);
  });

  it('shows a zero-usage empty state with a new-shooting-record entry point', async () => {
    const onCreateRoll = vi.fn();
    const user = userEvent.setup();

    render(
      <Harness
        isOpen
        summary={buildSummary({
          activeRolls: [], completedRolls: [], collectionGroups: [], unassignedRolls: [], lastUsedAt: undefined,
        })}
        onClose={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollections={vi.fn()}
        onCreateRoll={onCreateRoll}
      />,
    );

    expect(screen.getByText('这款胶卷还没有拍摄记录')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新建拍摄记录' }));
    expect(onCreateRoll).toHaveBeenCalledTimes(1);
  });

  it('shows a stable fallback instead of a blank drawer when the film record is unavailable', () => {
    render(
      <Harness
        isOpen
        summary={null}
        onClose={vi.fn()}
        onOpenRoll={vi.fn()}
        onOpenCollections={vi.fn()}
        onCreateRoll={vi.fn()}
      />,
    );

    expect(screen.getByText('还没有可分析的胶卷')).toBeInTheDocument();
  });
});
