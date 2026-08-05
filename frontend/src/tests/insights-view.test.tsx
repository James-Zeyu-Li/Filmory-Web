import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { InsightsView } from '../views/Insights/InsightsView';

vi.mock('../views/Finance/FinanceView', () => ({
  FinanceView: () => <div data-testid="finance-view">finance content</div>,
}));

vi.mock('../views/Stats/StatsView', () => ({
  StatsView: () => <div data-testid="stats-view">stats content</div>,
}));

const renderInsights = (initialEntry = '/insights') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <InsightsView enableFilmMode={true} />
  </MemoryRouter>
);

describe('InsightsView', () => {
  it('defaults to shooting insights and keeps spending in a sibling tab', () => {
    renderInsights();

    expect(screen.getByRole('heading', { name: '洞察' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '拍摄' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stats-view')).toBeInTheDocument();
    expect(screen.queryByTestId('finance-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '花费' }));

    expect(screen.getByRole('tab', { name: '花费' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('finance-view')).toBeInTheDocument();
  });

  it('opens the spending tab from a direct URL', () => {
    renderInsights('/insights?tab=spending');

    expect(screen.getByRole('tab', { name: '花费' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('finance-view')).toBeInTheDocument();
  });
});
