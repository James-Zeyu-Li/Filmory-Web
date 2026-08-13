import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { DashboardView } from '../views/Dashboard/DashboardView';

const mockUseRolls = vi.fn();
const mockUseCameras = vi.fn();
const mockUseFilmStocks = vi.fn();
const mockUseFilmBacks = vi.fn();
const mockUseLenses = vi.fn();

vi.mock('../hooks/useData', () => ({
  useRolls: () => mockUseRolls(),
  useCameras: () => mockUseCameras(),
  useFilmStocks: () => mockUseFilmStocks(),
  useFilmBacks: () => mockUseFilmBacks(),
  useLenses: () => mockUseLenses(),
}));

describe('Dashboard metrics', () => {
  const onNavigate = vi.fn();

  it('removes extra stock chips and lets the stock card jump to detail', () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([]);
    mockUseFilmBacks.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([
      {
        id: 'film-135',
        brand: 'Kodak',
        name: 'Gold 200',
        iso: 200,
        colorType: 'color',
        format: '135',
        isSystem: 0,
        stockCount: 3,
        addedAt: 1,
      },
      {
        id: 'film-120',
        brand: 'Ilford',
        name: 'HP5 Plus',
        iso: 400,
        colorType: 'bw',
        format: '120',
        isSystem: 0,
        stockCount: 2,
        addedAt: 2,
      },
    ]);

    const { container } = render(
      <DashboardView enableFilmMode={true} onNavigate={onNavigate} />
    );

    expect(screen.getByText('库存胶卷')).toBeInTheDocument();
    expect(container.querySelectorAll('.metric-breakdown-row')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /库存胶卷/i }));
    expect(onNavigate).toHaveBeenCalledWith('gear?tab=filmStocks');
  });

  it('makes every workspace metric card a direct route to its related work', () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([]);
    mockUseFilmBacks.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([]);

    render(<DashboardView enableFilmMode={true} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /进行中/i }));
    fireEvent.click(screen.getByRole('button', { name: /使用中机器/i }));

    expect(onNavigate).toHaveBeenCalledWith('rolls');
    expect(onNavigate).toHaveBeenCalledWith('gear?tab=cameras');
  });

  it('hides loaded backs metric when the user has no 120 workflow', () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([
      {
        id: 'camera-135',
        userId: 'mock-user-id',
        name: 'Leica M6',
        type: 'film',
        format: '135',
        addedAt: 1,
      },
    ]);
    mockUseFilmBacks.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([
      {
        id: 'film-135',
        brand: 'Kodak',
        name: 'Gold 200',
        iso: 200,
        colorType: 'color',
        format: '135',
        isSystem: 0,
        stockCount: 2,
        addedAt: 1,
      },
    ]);

    render(
      <DashboardView enableFilmMode={true} onNavigate={onNavigate} />
    );

    expect(screen.queryByText('装片后背')).not.toBeInTheDocument();
  });

  it('shows loaded backs metric when the user uses 120 gear', () => {
    mockUseRolls.mockReturnValue([
      {
        id: 'roll-1',
        userId: 'mock-user-id',
        name: 'Portrait Session',
        cameraIds: ['camera-120'],
        lensIds: [],
        filmBackId: 'back-1',
        filmStockId: 'film-120',
        status: 'active',
        startDate: 1,
      },
    ]);
    mockUseCameras.mockReturnValue([
      {
        id: 'camera-120',
        userId: 'mock-user-id',
        name: 'Hasselblad 500CM',
        type: 'film',
        format: '120',
        cameraSystemId: 'system-1',
        backType: 'interchangeable',
        addedAt: 1,
      },
    ]);
    mockUseFilmBacks.mockReturnValue([
      {
        id: 'back-1',
        userId: 'mock-user-id',
        cameraSystemId: 'system-1',
        name: 'A12 Back',
        format: '120',
        addedAt: 1,
      },
    ]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([
      {
        id: 'film-120',
        brand: 'Kodak',
        name: 'Portra 400',
        iso: 400,
        colorType: 'color',
        format: '120',
        isSystem: 0,
        stockCount: 1,
        addedAt: 1,
      },
    ]);

    render(
      <DashboardView enableFilmMode={true} onNavigate={onNavigate} />
    );

    expect(screen.getByText('装片后背')).toBeInTheDocument();
    expect(screen.getByText('1 个')).toBeInTheDocument();
  });

  it('keeps analytics out of the dashboard workspace', () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([]);
    mockUseFilmBacks.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([]);

    render(
      <DashboardView enableFilmMode={true} onNavigate={onNavigate} />
    );

    expect(screen.queryByRole('heading', { name: '拍摄统计' })).not.toBeInTheDocument();
    expect(screen.queryByText('统计内容')).not.toBeInTheDocument();
  });

  it('offers a direct creation action when there are no active shooting records', () => {
    mockUseRolls.mockReturnValue([]);
    mockUseCameras.mockReturnValue([]);
    mockUseFilmBacks.mockReturnValue([]);
    mockUseLenses.mockReturnValue([]);
    mockUseFilmStocks.mockReturnValue([]);
    onNavigate.mockClear();

    render(<DashboardView enableFilmMode={true} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: '开始拍摄记录' }));
    expect(onNavigate).toHaveBeenCalledWith('rolls?newRoll=1', { skipPageTransition: true });
  });
});
