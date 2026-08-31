import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StatsView } from '../views/Stats/StatsView';

const mockUseRolls = vi.fn();
const mockUseCameras = vi.fn();
const mockUseLenses = vi.fn();
const mockUseFilmStocks = vi.fn();
const mockUsePhotoAssets = vi.fn();
const mockUseCollections = vi.fn();

vi.mock('../hooks/useData', () => ({
  useRolls: () => mockUseRolls(),
  useCameras: () => mockUseCameras(),
  useLenses: () => mockUseLenses(),
  useFilmStocks: () => mockUseFilmStocks(),
  usePhotoAssets: () => mockUsePhotoAssets(),
  useCollections: () => mockUseCollections(),
}));

const renderStatsView = () => render(
  <MemoryRouter>
    <StatsView enableFilmMode={true} />
  </MemoryRouter>,
);

describe('StatsView lens usage chart', () => {
  it('renders a lens usage card alongside camera usage, with its own empty state', () => {
    mockUseRolls.mockReturnValue([
      { id: 'roll-1', name: 'Roll 1', cameraIds: [], lensIds: [], status: 'archived', startDate: 1 },
    ]);
    mockUseCameras.mockReturnValue([]);
    mockUseLenses.mockReturnValue([
      { id: 'lens-1', name: 'Rokkor-X 50mm f/1.4', focalLength: 50, maxAperture: 'f/1.4', type: 'prime', addedAt: 1 },
    ]);
    mockUseFilmStocks.mockReturnValue([]);
    mockUsePhotoAssets.mockReturnValue([]);
    mockUseCollections.mockReturnValue([]);

    renderStatsView();

    expect(screen.getByText('相机使用排行')).toBeInTheDocument();
    expect(screen.getByText('镜头使用排行')).toBeInTheDocument();
    // No roll references lens-1, so the lens card falls back to its empty state
    // (ranking correctness itself is covered by lensUsageRankingService.test.ts,
    // since Recharts doesn't render meaningfully inside jsdom's 0-width container).
    expect(screen.getByText('暂无镜头使用记录')).toBeInTheDocument();
  });
});

describe('StatsView best frames', () => {
  const setBaseline = () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([]);
    mockUseCollections.mockReturnValue([]);
  };

  it('does not render the Best Frames section when no photo qualifies (rating < 4)', () => {
    setBaseline();
    mockUsePhotoAssets.mockReturnValue([
      { id: 'p1', rollId: 'roll-1', originalFileName: 'a.webp', fileSize: 1, addedAt: 1, isPinned: 0, rating: 3 },
    ]);

    renderStatsView();

    expect(screen.queryByText('精选照片')).not.toBeInTheDocument();
  });

  it('shows the qualifying count and a clickable tile for each rated photo', () => {
    setBaseline();
    mockUsePhotoAssets.mockReturnValue([
      { id: 'p1', rollId: 'roll-42', originalFileName: 'a.webp', fileSize: 1, addedAt: 1, isPinned: 0, rating: 5, thumbnailUrl: 'data:image/webp;base64,x' },
    ]);

    renderStatsView();

    expect(screen.getByText('精选照片')).toBeInTheDocument();
    expect(screen.getByText('共 1 张 4 星及以上的照片')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看所在拍摄记录' })).toBeInTheDocument();
  });
});
