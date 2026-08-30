import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

    render(<StatsView enableFilmMode={true} />);

    expect(screen.getByText('相机使用排行')).toBeInTheDocument();
    expect(screen.getByText('镜头使用排行')).toBeInTheDocument();
    // No roll references lens-1, so the lens card falls back to its empty state
    // (ranking correctness itself is covered by lensUsageRankingService.test.ts,
    // since Recharts doesn't render meaningfully inside jsdom's 0-width container).
    expect(screen.getByText('暂无镜头使用记录')).toBeInTheDocument();
  });
});
